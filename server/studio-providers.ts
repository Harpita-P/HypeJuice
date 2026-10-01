import { createClient } from "@supabase/supabase-js";
import { createHiggsfieldClient } from "@higgsfield/client/v2";
import { STUDIO_MODEL, type StudioVideoInput } from "../shared/studio.js";
import { creatorRequest, renderScript } from "./studio-render.js";
import { MissingRenderIdError, ProviderHttpError } from "./studio-errors.js";
import { authenticatedMode, storagePath } from "./identity.js";
import { publicCreatorUrl } from "./public-creator-media.js";

const REQUIRED = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];
export function mediaConfig() {
  const missing = REQUIRED.filter((key) => !process.env[key] || /your_|placeholder/i.test(process.env[key]!));
  // Explicit operator opt-in, not authentication. Never enable on a public server.
  if (!authenticatedMode() && process.env.STUDIO_ALLOW_UNAUTHENTICATED !== "true") missing.push("STUDIO_ALLOW_UNAUTHENTICATED=true (trusted local testing only)");
  if (!authenticatedMode() && process.env.NODE_ENV === "production") missing.push("Unauthenticated mode is forbidden in production");
  return { ready: !missing.length, missing, model: STUDIO_MODEL };
}
export function studioConfig() {
  const { missing } = mediaConfig();
  if (!process.env.HF_CREDENTIALS || /your_|placeholder/i.test(process.env.HF_CREDENTIALS)) missing.push("HF_CREDENTIALS");
  if (!process.env.GEMINI_API_KEY || /your_|placeholder/i.test(process.env.GEMINI_API_KEY)) missing.push("GEMINI_API_KEY");
  return { ready: !missing.length, missing, model: STUDIO_MODEL };
}
function bucket() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: (input, init) => fetch(input, { ...init, signal: init?.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(120000)]) : AbortSignal.timeout(120000) }) } })
    .storage.from(process.env.SUPABASE_STUDIO_BUCKET || "growthbanana-studio");
}
export async function uploadMedia(path: string, data: Blob | ArrayBuffer, contentType: string) {
  const result = await bucket().upload(storagePath(path, true), data, { contentType, upsert: true });
  if (result.error) throw new Error("Private media upload failed. Check the Supabase bucket and its file-size limit.");
}
export async function signedMedia(path: string) {
  const publicUrl = publicCreatorUrl(path);
  if (publicUrl) return publicUrl;
  const result = await bucket().createSignedUrl(storagePath(path), authenticatedMode() ? 60 * 60 : 24 * 60 * 60);
  if (result.error || !result.data?.signedUrl) throw new Error("Couldn’t access the private media file.");
  return result.data.signedUrl;
}
async function apiJson(url: string, key: string, body?: unknown) {
  const response = await fetch(url, { method: body ? "POST" : "GET", headers: { Authorization: key, "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(60000) });
  if (!response.ok) throw new ProviderHttpError(response.status);
  return response.json();
}
export type ProviderStatus = { status: string; url?: string };
export interface StudioProviders {
  startCreator: (prompt: string) => Promise<string>;
  creatorStatus: (id: string) => Promise<ProviderStatus>;
  startRender: (input: StudioVideoInput, creatorPath: string, demoPath: string) => Promise<string>;
  renderStatus: (id: string) => Promise<ProviderStatus>;
  archive: (url: string, path: string) => Promise<void>;
}

export const studioProviders: StudioProviders = {
  async startCreator(prompt) {
    // Never retry a chargeable POST automatically, including on timeouts.
    const client = createHiggsfieldClient({ credentials: process.env.HF_CREDENTIALS, maxRetries: 0, timeout: 60000 });
    const result = await client.subscribe(STUDIO_MODEL, { input: creatorRequest(prompt), withPolling: false });
    if (!result.request_id) throw new Error("Higgsfield did not return a request ID. Check its dashboard before generating again.");
    return result.request_id;
  },
  async creatorStatus(id) {
    const result = await apiJson(`https://api.higgsfield.ai/requests/${encodeURIComponent(id)}/status`, `Key ${process.env.HF_CREDENTIALS}`);
    return { status: result.status, url: result.video?.url };
  },
  async startRender(input, creatorPath, demoPath) {
    const [creatorUrl, demoUrl] = await Promise.all([signedMedia(creatorPath), signedMedia(demoPath)]);
    const result = await apiJson("https://api.creatomate.com/v2/renders", `Bearer ${process.env.CREATOMATE_API_KEY}`, renderScript(input, creatorUrl, demoUrl));
    // v2 returns one render object; also tolerate the older one-item array shape.
    const render = Array.isArray(result) && result.length === 1 ? result[0] : result;
    if (typeof render?.id !== "string" || !render.id.trim()) throw new MissingRenderIdError();
    return render.id;
  },
  async renderStatus(id) {
    const result = await apiJson(`https://api.creatomate.com/v2/renders/${encodeURIComponent(id)}`, `Bearer ${process.env.CREATOMATE_API_KEY}`);
    return { status: result.status, url: result.url };
  },
  async archive(url, path) {
    // Only provider-returned media URLs enter here; never accept a client-supplied URL.
    const target = new URL(url);
    if (target.protocol !== "https:" || target.username || target.password) throw new Error("Provider returned an unsupported media URL.");
    const response = await fetch(target, { signal: AbortSignal.timeout(120000), redirect: "error" });
    if (!response.ok || !response.body) throw new Error("Couldn’t download the provider’s video. Check status again to retry saving it.");
    const limit = 250 * 1024 * 1024;
    if (Number(response.headers.get("content-length")) > limit) { await response.body.cancel(); throw new Error("Provider video exceeds the storage limit."); }
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = []; let size = 0;
    try {
      while (true) {
        const next = await reader.read(); if (next.done) break;
        size += next.value.byteLength;
        if (size > limit) throw new Error("Provider video exceeds the storage limit.");
        chunks.push(next.value);
      }
    } finally { await reader.cancel(); }
    if (!size) throw new Error("Provider returned an empty video.");
    await uploadMedia(path, Uint8Array.from(Buffer.concat(chunks)).buffer, "video/mp4");
  },
};
