-- Run through Supabase migrations, never from the mobile client.
create table public.gb_accounts (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'deleting'))
);
alter table public.gb_accounts enable row level security;
revoke all on public.gb_accounts from anon, authenticated;
grant all on public.gb_accounts to service_role;
create table public.gb_records (
  owner_id uuid not null references auth.users(id) on delete cascade,
  key text not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (owner_id, key)
);
create index gb_records_pending on public.gb_records ((data->>'status'));
alter table public.gb_records enable row level security;
-- These documents can include provider internals; authenticated clients cannot query them directly.
revoke all on public.gb_records from anon, authenticated;
grant all on public.gb_records to service_role;

create table public.gb_usage (
  owner_id uuid not null references auth.users(id) on delete cascade,
  action text not null, window_start bigint not null, used integer not null,
  primary key (owner_id, action, window_start)
);
alter table public.gb_usage enable row level security;
revoke all on public.gb_usage from anon, authenticated;
grant all on public.gb_usage to service_role;
create function public.gb_consume_allowance(p_owner uuid, p_action text, p_maximum integer, p_seconds integer)
returns boolean language plpgsql security definer set search_path = '' as $$
declare amount integer;
begin
  if p_maximum < 1 or p_seconds < 1 then return false; end if;
  insert into public.gb_usage(owner_id, action, window_start, used)
  values(p_owner, p_action, floor(extract(epoch from now()) / p_seconds)::bigint, 1)
  on conflict(owner_id, action, window_start) do update set used = public.gb_usage.used + 1
  where public.gb_usage.used < p_maximum returning used into amount;
  return amount is not null;
end $$;
revoke all on function public.gb_consume_allowance(uuid,text,integer,integer) from public, anon, authenticated;
grant execute on function public.gb_consume_allowance(uuid,text,integer,integer) to service_role;

-- A single renewable lease covers API-driven and background generation operations.
create table public.gb_worker_lease (name text primary key, holder uuid not null, expires_at timestamptz not null);
alter table public.gb_worker_lease enable row level security;
revoke all on public.gb_worker_lease from anon, authenticated;
grant all on public.gb_worker_lease to service_role;
create function public.gb_worker_lock(p_holder uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare claimed uuid;
begin
  insert into public.gb_worker_lease values('generation', p_holder, now() + interval '90 seconds')
  on conflict(name) do update set holder = excluded.holder, expires_at = excluded.expires_at
  where public.gb_worker_lease.expires_at < now() or public.gb_worker_lease.holder = p_holder
  returning holder into claimed;
  return claimed = p_holder;
end $$;
revoke all on function public.gb_worker_lock(uuid) from public, anon, authenticated;
grant execute on function public.gb_worker_lock(uuid) to service_role;

create table public.gb_oauth_states (
  state_hash text primary key, owner_id uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null
);
alter table public.gb_oauth_states enable row level security;
revoke all on public.gb_oauth_states from anon, authenticated;
grant all on public.gb_oauth_states to service_role;
-- Keep the studio bucket PRIVATE. No broad authenticated storage policies are needed:
-- the server validates ownership and issues short-lived signed URLs for users/<uid>/... .

create function public.gb_guard_record_write() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.owner_id::text, 0));
  if not exists(select 1 from public.gb_accounts where owner_id = new.owner_id and status = 'active') then
    raise exception 'Account is unavailable or deleting';
  end if;
  return new;
end $$;
create trigger gb_record_write_guard before insert or update on public.gb_records for each row execute function public.gb_guard_record_write();
create function public.gb_begin_deletion(p_owner uuid) returns boolean language plpgsql security definer set search_path = '' as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_owner::text, 0));
  if exists(select 1 from public.gb_records where owner_id = p_owner and (
    data->>'status' in ('queued','writing','writing_post','rendering','generating','assembling_local','saving','submitting_creator','submitting_render')
    or (data->>'status' = 'uploading' and updated_at > now() - interval '15 minutes')
  )) then return false; end if;
  update public.gb_accounts set status = 'deleting' where owner_id = p_owner;
  return found;
end $$;
revoke all on function public.gb_guard_record_write() from public, anon, authenticated;
revoke all on function public.gb_begin_deletion(uuid) from public, anon, authenticated;
grant execute on function public.gb_begin_deletion(uuid) to service_role;
