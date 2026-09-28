// Operator-only recovery of a known completed render. Never submits a generation.
// Usage: node --import tsx server/recover-studio-render.ts <studio-job-id> <render-id>
import { config as loadEnv } from "dotenv";
import { z } from "zod";
import { readJob, saveJob } from "./studio-jobs.js";
import { signedMedia, studioProviders } from "./studio-providers.js";

loadEnv({ quiet: true });

async function main() {
  const [jobId, renderId] = z.tuple([z.uuid(), z.uuid()]).parse(process.argv.slice(2));
  const job = await readJob(jobId);
  if (!job?.creatorPath) throw new Error("Original job or saved creator clip is missing.");
  if (job.status !== "failed" && job.status !== "succeeded") throw new Error("Cannot recover a job while it is active.");
  if (job.renderId && job.renderId !== renderId) throw new Error("Job already belongs to a different render.");
  if (job.status === "succeeded") {
    if (job.renderId !== renderId || !job.finalPath) throw new Error("Completed job does not match this render.");
    console.log("This render is already connected to the completed Studio job.");
    return;
  }

  console.log("Reading the existing Creatomate render; no generation will be submitted.");
  const result = await studioProviders.renderStatus(renderId);
  if (result.status !== "succeeded" || !result.url) throw new Error("The specified render is not complete or has no output URL.");

  const finalPath = `final/${job.id}.mp4`;
  console.log("Archiving the existing MP4 to private Supabase storage.");
  await studioProviders.archive(result.url, finalPath);
  const playbackUrl = await signedMedia(finalPath);
  const check = await fetch(playbackUrl, { method: "HEAD", signal: AbortSignal.timeout(15000) });
  if (!check.ok) throw new Error("Archived MP4 could not be verified; the Studio job was not changed.");

  // The app leaves failed jobs untouched; also guard against concurrent recovery.
  const latest = await readJob(jobId);
  if (JSON.stringify(latest) !== JSON.stringify(job)) throw new Error("The job changed during recovery; its state was not overwritten.");
  await saveJob({ ...job, renderId, resultUrl: result.url, finalPath, status: "succeeded", error: undefined });
  console.log(JSON.stringify({ jobId, renderId, status: "succeeded", archived: true, playbackVerified: true }));
}

void main().catch((reason) => {
  // Do not dump errors that may include credentials or signed URLs.
  console.error("Recovery did not complete. No paid request was submitted.");
  const status = reason?.statusCode;
  if (typeof status === "number") console.error(`Provider HTTP ${status}`);
  else if (reason instanceof Error && reason.name === "Error") console.error(reason.message);
  else console.error("Check the IDs, network connection, and server storage configuration.");
  process.exitCode = 1;
});
