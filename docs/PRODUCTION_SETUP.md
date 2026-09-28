# Authenticated deployment foundation

This replaces the single-founder, trusted-LAN architecture. The code is implemented
locally; no database migration, cloud deployment, OAuth registration, or iOS build
has been performed for you. This is not yet a verified production release.

## What changed

- Email-code accounts through Supabase Auth. Native sessions use Keychain/Keystore;
  browser sessions are memory-only. Every API request verifies the token with
  Supabase, rather than trusting an owner ID sent by the app.
- App profiles, clip references, generation jobs, caption preferences, Favorites,
  and launch-plan drafts are durable and scoped to the authenticated owner.
  Changing accounts unmounts the previous workspace. Profiles and launch plans
  currently use last-write-wins snapshots, not collaborative/realtime merging.
- Private video paths are `users/<user-id>/demo|creator|final/<filename>`. Playback
  uses one-hour signed URLs. These URLs are bearer links: do not log or publish them.
  Operator-approved reusable creators alone live under `shared/creator/`.
- Internal database tables have RLS enabled and no client-role access. The backend
  service role explicitly filters owner IDs; it must never be embedded in the app.
- A background worker resumes durable jobs without phone polling. A renewable
  database lease elects one worker across backend replicas. Ambiguous paid submissions
  still stop for manual review; this is not a provider-side exactly-once guarantee.
- Per-account API/generation limits and a paid-generation kill switch are included.
  These are safety caps, not credit billing, global spend limits, or abuse protection
  against someone creating many accounts.
- Your App / onboarding account controls support sign-out and account deletion.
  Deletion blocks new work, removes owned cloud files and records, revokes connected
  YouTube access, and removes the Auth account. Active work must finish first;
  a partial failure can be retried. Published platform videos, exported Photos files,
  provider-retained data, and backups are outside this cleanup operation.
- Optional YouTube connections are encrypted per user with AES-256-GCM. The iPhone
  opens the provider consent screen and returns to `hypejuice://connections`.
  **Uploading and scheduling YouTube videos are not implemented by this change.**

## 1. Configure Supabase

Use a separate staging project first. Keep the existing prototype bucket/data intact.

1. Apply `supabase/migrations/202609280001_production_foundation.sql` once using your
   migration workflow or the project's SQL editor. Do not apply it from the app.
   The migration creates server-only tables/RPCs and deletion guards; it has not yet
   been executed against your hosted database.
2. Enable email authentication. Configure the confirmation and magic-link email
   templates to show `{{ .Token }}` so the app receives a code, not just a link.
   Set up your own SMTP provider and reasonable signup/OTP limits before inviting
   users. See [email templates](https://supabase.com/docs/guides/auth/auth-email-templates)
   and [production SMTP](https://supabase.com/docs/guides/auth/auth-smtp).
3. Create a **private** `growthbanana-studio` bucket (or your configured name).
   Allow video MP4/WebM uploads, with a size limit matching your plan and the app's
   250 MB ceiling. Remove any broad public/authenticated read or write policies;
   the server owns storage access. Review existing policies rather than assuming
   the new SQL changes an existing bucket's permissions.
4. Upload your licensed reusable clips to `shared/creator/<filename>.mp4`. The
   catalog in `server/creator-library.json` continues to specify `creator/<filename>.mp4`;
   authenticated mode adds `shared/` when reading this operator-managed catalog.
   Update the catalog to match your actual uploads. Ordinary users' Studio clips
   are never automatically added to this shared pool.

Legacy `.studio-data/` files, old unscoped cloud files, and local prototype profiles
are **not automatically assigned to the first account**. They are preserved. A
separate, explicitly reviewed import is needed if you want to migrate them.

## 2. Deploy the API and worker

Use an always-running container host with HTTPS termination, outbound HTTPS access,
and enough CPU, RAM, and temporary disk for FFmpeg and uploads. Do not use a
short-lived request-only function host or scale all worker instances to zero.
Choose/configure the host before trying to use this from a release build.

The included `Dockerfile` uses Node 24, installs FFmpeg/ffprobe, and runs as a
non-root user. `.dockerignore` excludes `.env*`, credentials, and local job data.
Build with `docker build -t hypejuice-api .` and deploy that image through your
host's normal workflow. The host must inject secrets at runtime, not build time.

Required server settings (see `.env.example`):

| Setting | Value |
| --- | --- |
| `NODE_ENV` | `production` |
| `AUTH_MODE` | `supabase` |
| `STUDIO_ALLOW_UNAUTHENTICATED` | `false` |
| `PUBLIC_API_URL` | Your externally reachable `https://...` backend origin |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Server project URL and server-only service credential |
| `SUPABASE_STUDIO_BUCKET` | Your private bucket name |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | Caption/brief provider configuration |
| `HF_CREDENTIALS` | Required when enabling paid Studio creator generation |
| `ENABLE_PAID_GENERATION` | Start with `false`; enable deliberately after verification |
| `RUN_GENERATION_WORKER` | `true` on at least one always-running instance |
| `WEB_ORIGINS` | Exact browser origins, comma-separated; no wildcard |
| `PORT` | Host-assigned port, default `8787` |

Native clients do not need CORS origins. Configure the reverse proxy's upload-size
and request-timeout limits for your clip sizes. Disable query-string logging on
OAuth callbacks and redact Authorization headers and signed media URLs everywhere.
Use host-level rate limiting as well as the authenticated API quotas. Restrict
outbound access to internal/cloud-metadata networks at the infrastructure level.

`GET /health` is liveness; `GET /ready` checks database access, not every provider,
storage permission, worker health, or FFmpeg capability. Add host monitoring and
alerts for restarts, lease loss, stalled jobs, storage usage, and provider spend.
Schedule cleanup of expired `gb_oauth_states` and old `gb_usage` windows, and set
a documented media-retention/backups policy. No automatic retention task ships yet.

## 3. Configure and build the iPhone app

Only these public values belong in your Expo/EAS app environment:

```ini
EXPO_PUBLIC_AUTH_MODE=supabase
EXPO_PUBLIC_API_URL=https://your-api.example
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_public_publishable_key
```

Never add the service-role key, provider credentials, or encryption key to an
`EXPO_PUBLIC_` variable. Release builds reject a non-HTTPS API and cannot enable
the local authentication bypass. Your existing `.env` was not changed; add these
values locally when the matching backend/database is ready, then restart Expo.

`eas.json` includes development, preview, and production profiles. Link your own
Expo project, configure the corresponding EAS environment variables, and confirm
the bundle identifier belongs to you. Build with
`npx eas-cli build --platform ios --profile development` for device testing, or
`--profile production` for distribution. These commands require your own Expo and
Apple setup; they have not been run. EAS cloud builds do not require local Xcode.
Once the development build is installed, run `npm run start:dev-client` locally.
OAuth redirects require a custom development/distribution build, not Expo Go;
see [Expo's authentication guidance](https://docs.expo.dev/guides/authentication/).

## 4. Optional channel connection

Create a Google **Web application** OAuth client with the exact authorized redirect:
`https://your-api.example/oauth/youtube/callback`. Enable YouTube Data API v3 and
configure the consent screen/test users. Server settings are `YOUTUBE_CLIENT_ID`,
`YOUTUBE_CLIENT_SECRET`, and `CONNECTION_ENCRYPTION_KEY`. Generate the last once
with `openssl rand -base64 32`; store it in your host's secret manager. Keep it
stable and backed up: losing/changing it makes existing connections unreadable.
Key rotation/migration is not implemented yet.

Connect under Your App → account controls → Connected channels. The backend uses
hashed, single-use, expiring state bound to the signed-in account; the return link
contains only success/failure, never tokens. Credentials remain encrypted on the
server. Google testing/verification and later YouTube upload audit requirements
are separate from Apple's App Store review. No publishing is enabled here.

## Essential staging acceptance checks

1. Create two accounts. Analyze an app, upload a small demo, and complete one reused-
   footage batch. Verify account B cannot access A's jobs, media IDs, profile,
   Favorites, feedback, or channel connection—even using A's known IDs.
2. Verify direct database/storage access using the public client key cannot read
   internal tables or private files. Do not test with the service-role key.
3. Restart the API during a safe FFmpeg job; it should resume without the phone.
   Try a second replica and confirm only one worker owns the lease.
4. Reload/sign out/in on iPhone; verify profile, demos, Library and launch drafts
   return to the correct account. Check offline/error/retry states.
5. Test connect, cancel, expired/replayed callback, disconnect, and account deletion
   using staging accounts. Confirm deletion cannot remove another user's files.

Local TypeScript checks, 28 focused tests, and an iOS JavaScript bundle export passed.
The tests cover mocked ownership boundaries, encrypted-token binding,
and existing generation/upload behavior. They do not prove live SQL policies,
provider OAuth, container execution, or device behavior. Docker and cloud deployment
still need validation; Docker/Postgres are not installed in the local environment.
The JavaScript export is not a signed native build or an iPhone runtime test.
Package installation currently reports 16 moderate npm
advisories; review reachability/upgrades before release. Local Node 23 is outside
the supported app range; use Node 24.3+ (the container uses Node 24).

Before App Store submission: add your real privacy policy/support links, data-
collection disclosures and consent for sending content to AI providers; review
provider licensing, backups/deletion retention, operational monitoring, and any
future subscription/IAP implementation. App Store approval is not guaranteed by
this architecture. See [Apple's account-deletion guidance](https://developer.apple.com/support/offering-account-deletion-in-your-app)
and [Supabase's production checklist](https://supabase.com/docs/guides/deployment/going-into-prod).

## Explicit local prototype mode (development only)

For isolated trusted-LAN development only, set `AUTH_MODE=local`,
`STUDIO_ALLOW_UNAUTHENTICATED=true`, and `EXPO_PUBLIC_AUTH_MODE=local`.
This retains file journals and session-reset behavior for existing prototype tests.
Never expose that mode publicly. Production startup refuses it.
