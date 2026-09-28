// Render an existing job's saved footage locally, with no generation API calls.
// node --import tsx server/try-local-render.ts <original-job-id>
import { config } from "dotenv";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { createJob, readJob, saveJob } from "./studio-jobs.js";
import { renderLocalVideo } from "./studio-local.js";
import { signedMedia } from "./studio-providers.js";
import { CREATOR_HOOK_SECONDS } from "../shared/studio.js";

config({ quiet: true });
async function main() {
  const [originalId] = z.tuple([z.uuid()]).parse(process.argv.slice(2));
  const original = await readJob(originalId);
  if (!original?.creatorPath || !["failed", "succeeded"].includes(original.status)) throw new Error("Choose a completed job with saved creator footage.");
  const input = { ...original.input, id: randomUUID(), reuseJobId: original.id, uploadId: undefined, hookSeconds: CREATOR_HOOK_SECONDS };
  // Keep the original low-resolution render intact. This becomes a new revision.
  const job = await createJob({ id: input.id, input, requestKey: JSON.stringify(input), status: "assembling_local", assembly: "ffmpeg", createdAt: new Date().toISOString(), creatorPath: original.creatorPath, demoPath: original.demoPath, origin: original.origin });
  console.log(JSON.stringify({ jobId: job.id, stage: "local-render", newPaidRequests: 0 }));
  try {
    const finalPath = await renderLocalVideo(input, original.creatorPath, original.demoPath);
    const response = await fetch(await signedMedia(finalPath), { method: "HEAD", signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error("Private playback verification failed.");
    await saveJob({ ...job, finalPath, status: "succeeded" });
    console.log(JSON.stringify({ jobId: job.id, status: "succeeded", resolution: "720x1280", maxDurationSeconds: input.hookSeconds + input.demoSeconds, privatePlaybackVerified: true, newPaidRequests: 0 }));
  } catch (error) {
    await saveJob({ ...job, status: "failed", error: "Local test assembly failed. Saved original footage is unchanged." });
    throw error;
  }
}
void main().catch((error) => { console.error("Local test did not finish. No generation API was called."); if (error instanceof Error && error.name === "Error") console.error(error.message); process.exitCode = 1; });
