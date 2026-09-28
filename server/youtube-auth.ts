import { createHash, randomBytes, randomUUID, createCipheriv, createDecipheriv } from "node:crypto";
import type { YouTubeConfig, YouTubeConnection } from "../shared/youtube.js";
import { adminDb, asUser, authenticatedMode, ownerId } from "./identity.js";
import { readRecord, saveRecord, deleteRecord } from "./records.js";

const SCOPES = ["https://www.googleapis.com/auth/youtube.upload", "https://www.googleapis.com/auth/youtube.readonly"];
type Credentials = { connection: YouTubeConnection; accessToken: string; refreshToken: string; expiresAt: number; clientId: string };
export const schedulingEnabled = () => process.env.YOUTUBE_PUBLIC_SCHEDULING_ENABLED === "true";
export const youtubeRedirect = () => (process.env.PUBLIC_API_URL || "").replace(/\/$/, "") + "/oauth/youtube/callback";
export const mobileRedirect = () => "hypejuice://connections";
function encryptionKey() {
  const key = Buffer.from(process.env.CONNECTION_ENCRYPTION_KEY || "", "base64");
  if (key.length !== 32) throw new Error("CONNECTION_ENCRYPTION_KEY must be a base64-encoded 32-byte key."); return key;
}
export function encryptConnection(value: unknown) {
  const iv = randomBytes(12); const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  cipher.setAAD(Buffer.from("youtube:" + ownerId()));
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return { version: 1, iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64"), ciphertext: encrypted.toString("base64") };
}
export function decryptConnection(value: ReturnType<typeof encryptConnection>): Credentials {
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(value.iv, "base64"));
  decipher.setAAD(Buffer.from("youtube:" + ownerId())); decipher.setAuthTag(Buffer.from(value.tag, "base64"));
  return JSON.parse(Buffer.concat([decipher.update(Buffer.from(value.ciphertext, "base64")), decipher.final()]).toString("utf8"));
}
async function credentials() {
  const saved = await readRecord<ReturnType<typeof encryptConnection>>("youtube-connection.json");
  return saved ? decryptConnection(saved) : null;
}
export async function youtubeConfig(): Promise<YouTubeConfig> {
  const missing: string[] = [];
  if (!authenticatedMode()) missing.push("Authenticated account mode");
  for (const key of ["YOUTUBE_CLIENT_ID", "YOUTUBE_CLIENT_SECRET"]) if (!process.env[key] || /your_|placeholder/.test(process.env[key]!)) missing.push(key);
  try { if (new URL(process.env.PUBLIC_API_URL || "").protocol !== "https:") throw new Error(); } catch { missing.push("PUBLIC_API_URL (HTTPS)"); }
  try { encryptionKey(); } catch { missing.push("CONNECTION_ENCRYPTION_KEY (32-byte base64)"); }
  const saved = authenticatedMode() && !missing.includes("CONNECTION_ENCRYPTION_KEY (32-byte base64)") ? await credentials() : null;
  return { ready: !missing.length, missing, connectUrl: "", schedulingEnabled: schedulingEnabled(), connection: saved?.clientId === process.env.YOUTUBE_CLIENT_ID ? saved.connection : null };
}
export async function beginYouTubeAuth() {
  const config = await youtubeConfig(); if (!config.ready) throw new Error("YouTube server configuration is incomplete.");
  const state = randomBytes(32).toString("hex");
  const { error } = await adminDb().from("gb_oauth_states").insert({ state_hash: createHash("sha256").update(state).digest("hex"), owner_id: ownerId(), expires_at: new Date(Date.now() + 10 * 60_000).toISOString() });
  if (error) throw new Error("Couldn’t start the connection.");
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({ client_id: process.env.YOUTUBE_CLIENT_ID!, redirect_uri: youtubeRedirect(), response_type: "code", scope: SCOPES.join(" "), access_type: "offline", prompt: "consent", state }).toString();
  return { url: url.href };
}
async function tokenRequest(params: Record<string, string>) {
  const response = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: process.env.YOUTUBE_CLIENT_ID!, client_secret: process.env.YOUTUBE_CLIENT_SECRET!, ...params }), signal: AbortSignal.timeout(30000), redirect: "error" });
  if (!response.ok) throw new Error("Google authorization expired or failed. Reconnect YouTube.");
  const value = await response.json();
  if (typeof value.access_token !== "string" || !Number.isFinite(value.expires_in)) throw new Error("Google returned incomplete credentials.");
  return value as { access_token: string; expires_in: number; refresh_token?: string; scope?: string };
}
export async function finishYouTubeAuth(state: string, code?: string) {
  if (!/^[a-f0-9]{64}$/.test(state)) throw new Error("Invalid connection state.");
  const { data, error } = await adminDb().from("gb_oauth_states").delete().eq("state_hash", createHash("sha256").update(state).digest("hex")).gt("expires_at", new Date().toISOString()).select("owner_id").maybeSingle();
  if (error || !data || !code) throw new Error("Connection expired or cancelled. Start again from the app.");
  await asUser(data.owner_id, async () => {
    const tokens = await tokenRequest({ code, redirect_uri: youtubeRedirect(), grant_type: "authorization_code" });
    if (!tokens.refresh_token || !SCOPES.every((scope) => tokens.scope?.split(" ").includes(scope))) throw new Error("Approve both YouTube permissions and reconnect.");
    const response = await fetch("https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true", { headers: { Authorization: "Bearer " + tokens.access_token }, signal: AbortSignal.timeout(30000), redirect: "error" });
    if (!response.ok) throw new Error("Couldn’t read your YouTube channel.");
    const channels = await response.json();
    if (channels.items?.length !== 1 || !channels.items[0]?.id) throw new Error("Select an account with one YouTube channel.");
    const connection: YouTubeConnection = { id: randomUUID(), channelId: channels.items[0].id, channelTitle: channels.items[0].snippet.title };
    await saveRecord("youtube-connection.json", encryptConnection({ connection, clientId: process.env.YOUTUBE_CLIENT_ID!, accessToken: tokens.access_token, refreshToken: tokens.refresh_token, expiresAt: Date.now() + tokens.expires_in * 1000 } satisfies Credentials));
  });
}
export async function disconnectYouTube() {
  const saved = await credentials();
  if (saved) {
    const response = await fetch("https://oauth2.googleapis.com/revoke", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ token: saved.refreshToken }), signal: AbortSignal.timeout(30000), redirect: "error" });
    if (!response.ok && response.status !== 400) throw new Error("Google could not revoke access. Please retry disconnecting.");
  }
  await deleteRecord("youtube-connection.json");
}
