// Operator-only upload of approved public landing videos. Never exposes credentials,
// changes private buckets, overwrites different bytes, or deletes local originals.
import { config } from "dotenv";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

config({ quiet: true });
const bucketName = "hypejuice-showcase";
async function main() {
  if (process.argv[2] !== "--publish-approved") throw new Error("Explicit public showcase approval is required.");
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("Storage credentials missing.");
  const storage = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(120000) }) },
  }).storage;
  const files = await Promise.all([1, 2, 3].map(async (index) => {
    const file = `landingvid${index}.MP4`;
    const bytes = await readFile(file);
    if (!bytes.length || bytes.length > 25 * 1024 * 1024) throw new Error("Invalid showcase file size.");
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    return { id: `landingvid${index}`, bytes, sha256, path: `landing/landingvid${index}-${sha256.slice(0, 16)}.mp4` };
  }));
  const buckets = await storage.listBuckets();
  if (buckets.error) throw new Error("Cannot inspect storage buckets.");
  const existing = buckets.data.find((bucket) => bucket.name === bucketName);
  if (existing && !existing.public) throw new Error("Existing showcase bucket is private; refusing to change its visibility.");
  if (!existing) {
    const created = await storage.createBucket(bucketName, { public: true, allowedMimeTypes: ["video/mp4"], fileSizeLimit: 25 * 1024 * 1024 });
    if (created.error) throw new Error("Could not create dedicated showcase bucket.");
  }
  const manifest = [];
  for (const file of files) {
    const result = await storage.from(bucketName).upload(file.path, file.bytes, { contentType: "video/mp4", cacheControl: "31536000", upsert: false });
    const url = storage.from(bucketName).getPublicUrl(file.path).data.publicUrl;
    // Verify via the unauthenticated URL, including safe recovery from an interrupted upload.
    const response = await fetch(url, { signal: AbortSignal.timeout(120000), redirect: "error" });
    if (!response.ok || !response.headers.get("content-type")?.includes("video/mp4")) throw new Error(result.error ? "Upload failed and no verified public object is available." : "Public playback URL unavailable.");
    const downloaded = Buffer.from(await response.arrayBuffer());
    if (!downloaded.equals(file.bytes)) throw new Error("Public file verification failed.");
    manifest.push({ id: file.id, url, bytes: downloaded.length, sha256: file.sha256 });
  }
  console.log(JSON.stringify({ bucket: bucketName, verified: true, videos: manifest }, null, 2));
}
void main().catch((error) => { console.error(error instanceof Error ? error.message : "Showcase upload failed."); process.exitCode = 1; });
