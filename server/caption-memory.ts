import { createHash } from "node:crypto";
import { readRecord, saveRecord, listRecords } from "./records.js";
import { ownedKey, authenticatedMode } from "./identity.js";
import type { CaptionFeedback, FeedbackRequest } from "../shared/feedback.js";
import { readJob, studioDirectory } from "./studio-jobs.js";

const memoryPath = (profileKey: string) => `feedback-${createHash("sha256").update(profileKey).digest("hex")}.json`;
export async function readCaptionFeedback(profileKey: string): Promise<CaptionFeedback[]> {
  if (authenticatedMode()) {
    const prefix = memoryPath(profileKey).replace(/\.json$/, "-");
    return listRecords<CaptionFeedback>((key) => key.startsWith(prefix) && key.endsWith(".json"));
  }
  try {
    const memory = await readRecord<{ profileKey: string; ratings: CaptionFeedback[] }>(memoryPath(profileKey));
    if (!memory) return [];
    if (memory.profileKey !== profileKey || !Array.isArray(memory.ratings)) throw new Error("Invalid caption memory.");
    return memory.ratings;
  } catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return []; throw error; }
}
const writers = new Map<string, Promise<CaptionFeedback>>();
export function saveCaptionFeedback(request: FeedbackRequest): Promise<CaptionFeedback> {
  const key = ownedKey(memoryPath(request.profileKey));
  const task = (writers.get(key) ?? Promise.resolve()).catch(() => {}).then(async () => {
    const job = await readJob(request.jobId);
    if (!job || job.input.profileKey !== request.profileKey || job.status !== "succeeded" || !job.finalPath) {
      throw new Error("Rate a finished video belonging to this app.");
    }
    const ratings = await readCaptionFeedback(request.profileKey);
    const previous = ratings.find((rating) => rating.jobId === request.jobId);
    // Idempotent retries, not additional votes or stronger signals.
    if (previous?.verdict === request.verdict) return previous;
    const rating: CaptionFeedback = { ...request, hook: job.input.hook, demoCaption: job.input.demoCaption,
      title: job.origin?.title ?? "Studio caption", audience: job.origin?.audience ?? "",
      formatId: job.origin?.formatId,
      styleTags: job.origin?.styleTags ?? [], updatedAt: new Date().toISOString() };
    const next = ratings.filter((entry) => entry.jobId !== request.jobId).concat(rating);
    if (authenticatedMode()) await saveRecord(memoryPath(request.profileKey).replace(/\.json$/, `-${request.jobId}.json`), rating);
    else await saveRecord(memoryPath(request.profileKey), { version: 1, profileKey: request.profileKey, ratings: next });
    return rating;
  }).finally(() => { if (writers.get(key) === task) writers.delete(key); });
  writers.set(key, task);
  return task;
}
