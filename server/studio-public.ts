import type { StudioJob } from "../shared/studio.js";
import type { StoredStudioJob } from "./studio-jobs.js";
import { signedMedia } from "./studio-providers.js";

export async function publicJob(job: StoredStudioJob): Promise<StudioJob> {
  return { id: job.id, input: job.input, status: job.status, createdAt: job.createdAt, error: job.error,
    origin: job.origin, post: job.post, canReuse: Boolean(job.creatorPath), ...(job.finalPath ? { videoUrl: await signedMedia(job.finalPath) } : {}) };
}
