import type { StudioJob } from "../shared/studio.js";
import type { StoredStudioJob } from "./studio-jobs.js";
import { signedMedia } from "./studio-providers.js";
import { createHash } from "node:crypto";

// Opaque identity of the footage and trims; never expose private storage paths.
export function footageKey(job: StoredStudioJob): string | undefined {
  if (!job.creatorPath) return undefined;
  return createHash("sha256").update(JSON.stringify([job.input.profileKey, job.creatorPath, job.demoPath,
    job.input.hookSeconds ?? 5, job.input.demoSeconds, Boolean(job.input.clampDemoDuration)])).digest("hex");
}

export async function publicJob(job: StoredStudioJob): Promise<StudioJob> {
  return { id: job.id, input: job.input, status: job.status, createdAt: job.createdAt, error: job.error,
    origin: job.origin, post: job.post, footageKey: footageKey(job), canReuse: Boolean(job.creatorPath), ...(job.finalPath ? { videoUrl: await signedMedia(job.finalPath) } : {}) };
}
