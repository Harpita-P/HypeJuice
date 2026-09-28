import { AsyncLocalStorage } from "node:async_hooks";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const identities = new AsyncLocalStorage<{ userId: string }>();
export const authenticatedMode = () => process.env.AUTH_MODE !== "local" && !(process.env.NODE_ENV === "test" && !process.env.AUTH_MODE);
export function ownerId() {
  if (!authenticatedMode()) return "local";
  const id = identities.getStore()?.userId;
  if (!id) throw new Error("Authenticated user context required.");
  return z.uuid().parse(id);
}
export const asUser = <T>(userId: string, work: () => T) => identities.run({ userId: z.uuid().parse(userId) }, work);
export const ownedKey = (key: string) => `${ownerId()}:${key}`;
export function adminDb() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("Server Supabase credentials missing.");
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => fetch(input, { ...init, signal: init?.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(10000)]) : AbortSignal.timeout(10000) }) } });
}
export async function verifiedUser(token: string) {
  const { data, error } = await adminDb().auth.getUser(token);
  if (error || !data.user || data.user.is_anonymous) throw new Error("Sign in again.");
  return z.uuid().parse(data.user.id);
}
export async function accountActive() {
  if (!authenticatedMode()) return true;
  const { data, error } = await adminDb().from("gb_accounts").select("status").eq("owner_id", ownerId()).maybeSingle();
  if (error) throw new Error("Account state unavailable."); return data?.status === "active";
}
export async function allowance(action: string, maximum: number, seconds = 86400) {
  if (!authenticatedMode()) return;
  const { data, error } = await adminDb().rpc("gb_consume_allowance", { p_owner: ownerId(), p_action: action, p_maximum: maximum, p_seconds: seconds });
  if (error || data !== true) throw new Error("Usage limit reached or usage service unavailable. Try again later.");
}
export function storagePath(path: string, write = false) {
  if (!/^(?:shared\/)?(?:demo|creator|final)\/[a-zA-Z0-9_-]+\.(mp4|webm)$/.test(path)) throw new Error("Invalid media path.");
  if (!authenticatedMode()) return path;
  if (path.startsWith("shared/")) {
    if (write || !path.startsWith("shared/creator/")) throw new Error("Shared media is operator-managed.");
    ownerId(); return path;
  }
  return `users/${ownerId()}/${path}`;
}
