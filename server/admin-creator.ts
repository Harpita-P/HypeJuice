// Operator-only CLI. Not imported by the API or exposed to mobile users.
// submit <draft.json> --approve-paid | check <draft.json> | archive <draft.json>
// A submission intent is persisted before the one chargeable POST. Never retry an
// ambiguous submission. check/archive cannot create or resubmit a generation.
import { config as loadEnv } from "dotenv";
import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { resolve, join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { studioProviders } from "./studio-providers.js";
import { creatorRequest } from "./studio-render.js";
import { STUDIO_MODEL } from "../shared/studio.js";

loadEnv({ quiet: true });
const Draft = z.object({ id: z.string().regex(/^[a-z0-9_-]+$/), path: z.string().regex(/^creator\/[a-z0-9_-]+\.mp4$/), seconds: z.literal(4), sourcePrompt: z.string().min(10).max(2000) });
type Journal = { state: string; requestId?: string; providerStatus?: string; createdAt: string; request: unknown; videoUrl?: string; localFile?: string; archivedPaths?: string[] };
async function main() {
  const [command, draftPath, approval] = process.argv.slice(2);
  if (!["submit", "check", "archive"].includes(command) || !draftPath) throw new Error("Use submit/check/archive and a draft JSON file.");
  const draft = Draft.parse(JSON.parse(await readFile(resolve(draftPath), "utf8")));
  const directory = resolve(".studio-data/admin-creators", draft.id);
  await mkdir(directory, { recursive: true });
  const journalFile = join(directory, "generation.json");
  let journal: Journal | null = null;
  try { journal = JSON.parse(await readFile(journalFile, "utf8")); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  const save = async (value: Journal) => { await writeFile(journalFile + ".tmp", JSON.stringify(value, null, 2), { mode: 0o600 }); await rename(journalFile + ".tmp", journalFile); };
  const storage = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(120000) }) } }).storage;
  const bucketName = process.env.SUPABASE_STUDIO_BUCKET || "growthbanana-studio";
  const paths = [draft.path, `shared/${draft.path}`];
  if (command === "submit") {
    if (approval !== "--approve-paid") throw new Error("Explicit --approve-paid is required.");
    if (journal) throw new Error("Submission already journaled. Use check; do not submit another paid request.");
    for (const key of ["HF_CREDENTIALS", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]) if (!process.env[key] || /placeholder|your_/i.test(process.env[key]!)) throw new Error("Provider or storage setup missing.");
    const bucket = await storage.getBucket(bucketName);
    if (bucket.error || !bucket.data || bucket.data.public) throw new Error("A reachable private storage bucket is required before generation.");
    for (const path of paths) {
      const folder = path.slice(0, path.lastIndexOf("/")); const name = path.slice(path.lastIndexOf("/") + 1);
      const existing = await storage.from(bucketName).list(folder, { search: name });
      if (existing.error || existing.data.some((item) => item.name === name)) throw new Error("Storage target already exists or cannot be checked; no request submitted.");
    }
    journal = { state: "submitting", createdAt: new Date().toISOString(), request: { model: STUDIO_MODEL, input: creatorRequest(draft.sourcePrompt) } };
    await writeFile(journalFile, JSON.stringify(journal, null, 2), { flag: "wx", mode: 0o600 });
    try {
      journal.requestId = await studioProviders.startCreator(draft.sourcePrompt);
      journal.state = "submitted"; await save(journal);
    } catch {
      journal.state = "submission_uncertain"; await save(journal);
      throw new Error("Submission failed or was ambiguous. Check the Higgsfield dashboard before any further paid request.");
    }
    console.log(JSON.stringify({ state: journal.state, requestId: journal.requestId, model: STUDIO_MODEL, seconds: 4 })); return;
  }
  if (!journal?.requestId) throw new Error("No confirmed request ID. Check the saved journal and provider dashboard; do not resubmit.");
  const result = await studioProviders.creatorStatus(journal.requestId);
  journal.providerStatus = result.status;
  if (result.url) journal.videoUrl = result.url;
  await save(journal);
  if (command === "check" || result.status !== "completed") { console.log(JSON.stringify({ state: journal.state, requestId: journal.requestId, providerStatus: result.status })); return; }
  if (!journal.videoUrl) throw new Error("Completed request has no video URL.");
  const url = new URL(journal.videoUrl);
  if (url.protocol !== "https:" || url.username || url.password) throw new Error("Unsupported provider media URL.");
  const response = await fetch(url, { signal: AbortSignal.timeout(120000), redirect: "error" });
  if (!response.ok || !response.body) throw new Error("Video download failed; archive can be retried without generation.");
  const reader = response.body.getReader(); const chunks: Uint8Array[] = []; let size = 0;
  try { for (;;) { const value = await reader.read(); if (value.done) break; size += value.value.byteLength; if (size > 250 * 1024 * 1024) throw new Error("Video exceeds size limit."); chunks.push(value.value); } } finally { await reader.cancel(); }
  if (!size) throw new Error("Empty video returned.");
  const bytes = Buffer.concat(chunks);
  journal.localFile = join(directory, "original.mp4");
  await writeFile(journal.localFile, bytes, { mode: 0o600 });
  journal.archivedPaths ??= [];
  for (const path of paths) {
    if (journal.archivedPaths.includes(path)) continue;
    const saved = await storage.from(bucketName).upload(path, bytes, { contentType: "video/mp4", upsert: false });
    if (saved.error) {
      // An interrupted acknowledgement is recoverable only if the object is the
      // exact same video; never overwrite an existing library asset.
      const existing = await storage.from(bucketName).download(path);
      if (existing.error || !existing.data || !Buffer.from(await existing.data.arrayBuffer()).equals(bytes)) throw new Error("Archive failed or target differs. Original is saved locally; do not regenerate.");
    }
    journal.archivedPaths.push(path); await save(journal);
  }
  journal.state = "archived_pending_review"; await save(journal);
  console.log(JSON.stringify({ state: journal.state, requestId: journal.requestId, localFile: journal.localFile, archivedPaths: journal.archivedPaths, bytes: size }));
}
void main().catch(() => { console.error("Admin operation stopped. Inspect the private generation journal; no automatic paid retry was made. Provider credentials and signed URLs are not logged."); process.exitCode = 1; });
