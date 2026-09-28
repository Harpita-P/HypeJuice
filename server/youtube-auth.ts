import { randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { chmod, mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { studioDirectory } from "./studio-jobs.js";
import { mediaConfig } from "./studio-providers.js";
import type { YouTubeConfig, YouTubeConnection } from "../shared/youtube.js";

const SCOPES = ["https://www.googleapis.com/auth/youtube.upload", "https://www.googleapis.com/auth/youtube.readonly"];
type Credentials = { connection: YouTubeConnection; accessToken: string; refreshToken: string; expiresAt: number; clientId: string };
const credentialPath = () => join(studioDirectory(), "youtube-connection.json");
export const youtubeRedirect = () => process.env.YOUTUBE_REDIRECT_URI || "http://localhost:8787/api/youtube/callback";
export const schedulingEnabled = () => process.env.YOUTUBE_PUBLIC_SCHEDULING_ENABLED === "true";

export async function writeYouTubeFile(path: string, data: unknown) {
  await mkdir(studioDirectory(), { recursive: true, mode: 0o700 });
  const temporary = `${path}.${randomUUID()}.tmp`;
  await writeFile(temporary, JSON.stringify(data), { mode: 0o600 });
  await rename(temporary, path);
}
async function credentials(): Promise<Credentials | null> {
  try { return JSON.parse(await readFile(credentialPath(), "utf8")); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return null; throw error; }
}
export async function youtubeConfig(): Promise<YouTubeConfig> {
  const missing = [...mediaConfig().missing];
  for (const key of ["YOUTUBE_CLIENT_ID", "YOUTUBE_CLIENT_SECRET"]) if (!process.env[key] || /your_|placeholder/.test(process.env[key]!)) missing.push(key);
  let connectUrl = "";
  try {
    const redirect = new URL(youtubeRedirect());
    // This self-hosted prototype intentionally connects in the API computer's browser.
    if (redirect.protocol !== "http:" || !["localhost", "127.0.0.1"].includes(redirect.hostname) || redirect.pathname !== "/api/youtube/callback" || redirect.search || redirect.hash || redirect.username || redirect.password) throw new Error();
    connectUrl = new URL("/api/youtube/connect", redirect).href;
  } catch { missing.push("YOUTUBE_REDIRECT_URI must be http://localhost:<port>/api/youtube/callback (or 127.0.0.1)"); }
  const saved = await credentials();
  return { ready: !missing.length, missing, connectUrl, schedulingEnabled: schedulingEnabled(),
    connection: saved?.clientId === process.env.YOUTUBE_CLIENT_ID ? saved.connection : null };
}

// One-time state + browser cookie prevents callback substitution/login CSRF.
const pending = new Map<string, { browser: string; expires: number }>();
export function beginYouTubeAuth() {
  for (const [key, value] of pending) if (value.expires < Date.now()) pending.delete(key);
  if (pending.size >= 50) throw new Error("Too many pending connections. Try again in ten minutes.");
  const state = randomBytes(32).toString("hex"); const browser = randomBytes(32).toString("hex");
  pending.set(state, { browser, expires: Date.now() + 10 * 60_000 });
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({ client_id: process.env.YOUTUBE_CLIENT_ID!, redirect_uri: youtubeRedirect(), response_type: "code",
    scope: SCOPES.join(" "), access_type: "offline", prompt: "consent", state }).toString();
  return { url: url.href, browser };
}
export function consumeYouTubeState(state?: string, browser?: string) {
  const entry = state ? pending.get(state) : undefined;
  if (state) pending.delete(state);
  if (!entry || entry.expires < Date.now() || !browser || browser.length !== entry.browser.length || !timingSafeEqual(Buffer.from(browser), Buffer.from(entry.browser))) throw new Error("Connection expired or browser mismatch. Start Connect YouTube again on your Mac.");
}
async function tokenRequest(params: Record<string, string>) {
  const response = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: process.env.YOUTUBE_CLIENT_ID!, client_secret: process.env.YOUTUBE_CLIENT_SECRET!, ...params }), signal: AbortSignal.timeout(30000), redirect: "error" });
  if (!response.ok) throw new Error("Google authorization failed or expired. Reconnect YouTube on your Mac.");
  const result = await response.json();
  if (typeof result.access_token !== "string" || !Number.isFinite(result.expires_in)) throw new Error("Google returned incomplete credentials. Reconnect YouTube.");
  return result as { access_token: string; expires_in: number; refresh_token?: string; scope?: string };
}
let authTail: Promise<unknown> = Promise.resolve();
function serialized<T>(work: () => Promise<T>): Promise<T> {
  const next = authTail.then(work); authTail = next.catch(() => {}); return next;
}
export async function finishYouTubeAuth(code: string) {
  return serialized(async () => {
    const tokens = await tokenRequest({ code, redirect_uri: youtubeRedirect(), grant_type: "authorization_code" });
    if (!tokens.refresh_token || !SCOPES.every((scope) => tokens.scope?.split(" ").includes(scope))) throw new Error("Approve both YouTube permissions, then reconnect. Offline access is required.");
    const response = await fetch("https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true", {
      headers: { Authorization: `Bearer ${tokens.access_token}` }, signal: AbortSignal.timeout(30000), redirect: "error" });
    if (!response.ok) throw new Error("Couldn’t read your channel. Enable YouTube Data API v3 and approve channel access.");
    const result = await response.json();
    if (result.items?.length !== 1 || !result.items[0]?.id) throw new Error("Choose one Google/Brand account with an existing YouTube channel, then reconnect.");
    const connection: YouTubeConnection = { id: randomUUID(), channelId: result.items[0].id, channelTitle: result.items[0].snippet.title };
    await writeYouTubeFile(credentialPath(), { connection, clientId: process.env.YOUTUBE_CLIENT_ID, accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token, expiresAt: Date.now() + tokens.expires_in * 1000 } satisfies Credentials);
    await chmod(credentialPath(), 0o600);
  });
}
export function youtubeAccessToken(connectionId: string): Promise<string> {
  return serialized(async () => {
    const saved = await credentials();
    if (!saved || saved.connection.id !== connectionId || saved.clientId !== process.env.YOUTUBE_CLIENT_ID) throw new Error("The connected channel changed. Check the channel before approving another upload.");
    if (saved.expiresAt < Date.now() + 60_000) {
      const tokens = await tokenRequest({ refresh_token: saved.refreshToken, grant_type: "refresh_token" });
      saved.accessToken = tokens.access_token; saved.expiresAt = Date.now() + tokens.expires_in * 1000;
      if (tokens.refresh_token) saved.refreshToken = tokens.refresh_token;
      await writeYouTubeFile(credentialPath(), saved);
    }
    return saved.accessToken;
  });
}
export function disconnectYouTube() {
  // Local disconnect: don't silently revoke other installations using this Google project.
  return serialized(async () => { try { await unlink(credentialPath()); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; } });
}
