// Operator-only: copy exactly the approved catalog to a dedicated public bucket.
// Never changes an existing bucket's visibility or overwrites/deletes source media.
import { config } from "dotenv";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

config({ quiet: true });
const bucketName = "hypejuice-creators";
const limit = 25 * 1024 * 1024;
async function main() {
  const mode = process.argv[2];
  if (mode !== "--check" && mode !== "--publish-approved") throw new Error("Use --check or --publish-approved.");
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("Storage credentials missing.");
  const catalog = z.array(z.object({ id: z.string().regex(/^[a-z0-9_-]+$/), path: z.string().regex(/^creator\/[a-z0-9_-]+\.mp4$/) })).length(12)
    .parse(JSON.parse(await readFile("server/creator-library.json", "utf8")));
  if (new Set(catalog.map((entry) => entry.path)).size !== 12 || new Set(catalog.map((entry) => entry.id)).size !== 12) throw new Error("Expected twelve distinct approved clips.");
  const storage = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(120000) }) },
  }).storage;
  const sourceBucket = process.env.SUPABASE_STUDIO_BUCKET || "growthbanana-studio";
  const buckets = await storage.listBuckets();
  if (buckets.error) throw new Error("Cannot inspect storage buckets.");
  const source = buckets.data.find((bucket) => bucket.name === sourceBucket);
  if (!source || source.public || sourceBucket === bucketName) throw new Error("Expected a separate private source bucket.");
  const existing = buckets.data.find((bucket) => bucket.name === bucketName);
  if (existing && !existing.public) throw new Error("Target bucket is private; refusing to change its visibility.");
  // Read all sources before publishing anything. No demo/final/user folders are scanned.
  const files = [];
  for (const entry of catalog) {
    const result = await storage.from(sourceBucket).download(entry.path);
    if (result.error || !result.data || !result.data.size || result.data.size > limit) throw new Error(`Cannot read approved clip: ${entry.id}`);
    const bytes = Buffer.from(await result.data.arrayBuffer());
    if (bytes.toString("ascii", 4, 8) !== "ftyp") throw new Error(`Expected MP4: ${entry.id}`);
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    const objectPath = `creator/${sha256}.mp4`;
    files.push({ bytes, objectPath, record: { id: entry.id, sourcePath: entry.path, sha256, bytes: bytes.length,
      url: storage.from(bucketName).getPublicUrl(objectPath).data.publicUrl } });
    console.log(`Checked ${entry.id} (${bytes.length} bytes)`);
  }
  if (mode === "--check") { console.log("All 12 approved sources are readable. No cloud changes made."); return; }
  if (!existing) {
    const created = await storage.createBucket(bucketName, { public: true, allowedMimeTypes: ["video/mp4"], fileSizeLimit: limit });
    if (created.error) throw new Error("Cannot create dedicated creator bucket.");
  }
  for (const file of files) {
    await storage.from(bucketName).upload(file.objectPath, file.bytes, { contentType: "video/mp4", cacheControl: "31536000", upsert: false });
    // Unauthenticated GET verifies access and bytes; also makes interrupted runs safe to retry.
    const response = await fetch(file.record.url, { signal: AbortSignal.timeout(120000), redirect: "error" });
    if (!response.ok || !response.headers.get("content-type")?.includes("video/mp4")) throw new Error(`Public verification failed: ${file.record.id}`);
    const downloaded = Buffer.from(await response.arrayBuffer());
    if (!downloaded.equals(file.bytes)) throw new Error(`Public bytes differ: ${file.record.id}`);
    console.log(`Published and verified ${file.record.id}`);
  }
  const sourceAfter = await storage.getBucket(sourceBucket);
  if (sourceAfter.error || sourceAfter.data.public) throw new Error("Could not confirm source bucket remains private.");
  console.log(JSON.stringify(files.map((file) => file.record), null, 2));
}
void main().catch((error) => { console.error(error instanceof z.ZodError ? "Invalid creator catalog." : error instanceof Error && !error.message.includes("fetch") ? error.message : "Storage request failed. Check connectivity and retry."); process.exitCode = 1; });
