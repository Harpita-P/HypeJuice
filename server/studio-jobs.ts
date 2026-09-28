import { readRecord, saveRecord, listRecords, recordDirectory } from "./records.js";
import { authenticatedMode, ownedKey } from "./identity.js";
import type { DiscoverOrigin, StudioJobStatus, StudioVideoInput } from "../shared/studio.js";
import { studioProviders, type StudioProviders } from "./studio-providers.js";
import { submissionFailure } from "./studio-errors.js";
import { renderLocalVideo } from "./studio-local.js";
import { writeStudioPost } from "./post-copy.js";
import type { PostCopy } from "../shared/post-copy.js";

export type StoredStudioJob = {
  id: string; input: StudioVideoInput; status: StudioJobStatus; createdAt: string;
  requestKey: string;
  demoPath: string; creatorPath?: string; creatorRequestId?: string; renderId?: string;
  creatorUrl?: string; resultUrl?: string; finalPath?: string; error?: string;
  // Absent on older jobs, which retain their existing Creatomate lifecycle.
  assembly?: "ffmpeg" | "creatomate";
  origin?: DiscoverOrigin;
  post?: PostCopy;
  generatePost?: boolean; // New Studio jobs only; don't backfill legacy jobs on reads.
};
export const studioDirectory = recordDirectory;
export async function readJob(id: string): Promise<StoredStudioJob | null> {
  return readRecord(`${id}.json`);
}
export async function saveJob(job: StoredStudioJob) {
  await saveRecord(`${job.id}.json`, job);
}
export async function createJob(job: StoredStudioJob) {
  return saveRecord(`${job.id}.json`, job, true);
}
export async function listJobs(limit = 20) {
  return (await listRecords<StoredStudioJob>((key) => /^[0-9a-f-]{36}\.json$/.test(key))).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit);
}

export async function advanceJob(job: StoredStudioJob, save: (value: StoredStudioJob) => Promise<void>, provider: StudioProviders = studioProviders, localRender = renderLocalVideo, postWriter = writeStudioPost) {
  if (["succeeded", "failed"].includes(job.status)) return job;
  // Defense in depth: Discover is assembly-only, even if a saved record is incomplete.
  if (job.origin?.type === "discover" && (!job.creatorPath || job.assembly !== "ffmpeg" || !["queued", "writing_post", "assembling_local"].includes(job.status))) {
    job.status = "failed"; job.error = "Discover requires a saved creator clip and local assembly. No new creator was generated.";
    await save(job); return job;
  }
  try {
    job.error = undefined;
    // Caption variations wait for their one paid source; they must never fall
    // through into startCreator, even after a failed generation or restart.
    if ((job.input.creatorId || job.input.savedCreatorJobId) && (job.assembly !== "ffmpeg" || !["queued", "writing_post", "assembling_local"].includes(job.status))) {
      job.status = "failed"; job.error = "Saved creator variations require local assembly. No provider generation was requested.";
      await save(job); return job;
    }
    if (job.input.savedCreatorJobId && !job.creatorPath) {
      const source = await readJob(job.input.savedCreatorJobId);
      if (!source || source.input.profileKey !== job.input.profileKey || (["failed", "succeeded"].includes(source.status) && !source.creatorPath)) {
        job.status = "failed"; job.error = "The shared creator source failed or is missing. No additional creator was generated.";
        await save(job); return job;
      }
      if (!source.creatorPath) { tickJob(source.id); return job; }
      job.creatorPath = source.creatorPath; await save(job);
    }
    if (job.input.creatorId && !job.creatorPath) {
      job.status = "failed"; job.error = "The library creator is unavailable. No new creator was generated.";
      await save(job); return job;
    }
    if (job.generatePost && !job.post && ["queued", "writing_post"].includes(job.status)) {
      job.status = "writing_post"; await save(job);
      // Save metadata before any chargeable video request. Polls share the job lock.
      job.post = await postWriter(job.input);
      job.status = "queued"; await save(job);
      return job;
    }
    if (job.status === "submitting_creator" || job.status === "submitting_render") {
      job.status = "failed";
      job.error = "Submission was interrupted. Check the provider dashboard before starting another paid job; it may already have been charged.";
    } else if (job.status === "queued") {
      if (job.creatorPath && job.assembly === "ffmpeg") {
        job.status = "assembling_local";
        await save(job);
        return job;
      }
      job.status = job.creatorPath ? "submitting_render" : "submitting_creator";
      await save(job); // Persist BEFORE the chargeable side effect.
      if (job.creatorPath) { job.renderId = await provider.startRender(job.input, job.creatorPath, job.demoPath); job.status = "rendering"; }
      else { job.creatorRequestId = await provider.startCreator(job.input.prompt); job.status = "generating"; }
    } else if (job.status === "generating") {
      if (!job.creatorUrl) {
        const result = await provider.creatorStatus(job.creatorRequestId!);
        if (["failed", "nsfw", "cancelled", "canceled"].includes(result.status)) { job.status = "failed"; job.error = "Higgsfield could not generate this clip. Check the provider dashboard for details."; }
        else if (result.status === "completed") {
          if (!result.url) throw new Error("Completed generation has no video URL.");
          job.creatorUrl = result.url; await save(job);
        }
      }
      if (job.creatorUrl) {
        const path = `creator/${job.id}.mp4`;
        await provider.archive(job.creatorUrl, path);
        job.creatorPath = path; job.status = "queued";
      }
    } else if (job.status === "assembling_local") {
      if (!job.creatorPath || job.assembly !== "ffmpeg") throw new Error("Saved creator footage is required for local assembly.");
      job.finalPath = await localRender(job.input, job.creatorPath, job.demoPath);
      job.status = "succeeded";
    } else if (job.status === "rendering") {
      const result = await provider.renderStatus(job.renderId!);
      if (result.status === "failed") { job.status = "failed"; job.error = "Assembly failed. You can reuse the creator clip for another render without generating it again."; }
      else if (result.status === "succeeded") {
        if (!result.url) throw new Error("Completed render has no video URL.");
        job.resultUrl = result.url; job.status = "saving";
      }
    } else if (job.status === "saving") {
      const path = `final/${job.id}.mp4`;
      await provider.archive(job.resultUrl!, path);
      job.finalPath = path; job.status = "succeeded";
    }
  } catch (reason) {
    if (job.status === "writing_post") {
      job.status = "failed";
      job.error = "Post caption writing failed. Check Gemini setup and try again. No new creator generation or video assembly was started for this job; saved footage is unchanged.";
      await save(job); return job;
    }
    if (job.status === "assembling_local") {
      job.status = "failed";
      job.error = "Local assembly failed. Check FFmpeg/ffprobe on the API server, the clip durations, and private storage access. Saved footage is safe; retry assembly without another Higgsfield charge.";
      await save(job);
      return job;
    }
    const submission = job.status === "submitting_creator" || job.status === "submitting_render";
    // Polling/storage errors can be retried safely. Uncertain POSTs must not be retried.
    job.error = submission ? submissionFailure(reason, job.status === "submitting_creator" ? "Higgsfield" : "Creatomate") :
      reason instanceof Error ? reason.message : "Couldn’t check this job. Try checking again.";
    if (submission) job.status = "failed";
  }
  await save(job);
  return job;
}

const running = new Map<string, Promise<void>>();
export function runJobStep(id: string): Promise<void> {
  const key = ownedKey(id);
  const existing = running.get(key);
  if (existing) return existing;
  const task = readJob(id).then(async (job) => { if (job && !["succeeded", "failed"].includes(job.status)) await advanceJob(job, saveJob); })
    .finally(() => running.delete(key));
  running.set(key, task);
  return task;
}
export function tickJob(id: string) {
  if (authenticatedMode()) return; // Durable hosted worker advances jobs, not client polling.
  void runJobStep(id).catch(() => { /* Persisted jobs can be checked again; never log secrets. */ });
}
