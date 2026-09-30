import { randomUUID } from "node:crypto";
import { readRecord, saveRecord, listRecords } from "./records.js";
import { ownedKey } from "./identity.js";
import { z } from "zod";
import { contentBatchSize, type DiscoverBatch, type DiscoverCaption, type DiscoverRequest } from "../shared/discover.js";
import { buildCaptionTasteMemory } from "../shared/feedback.js";
import { readCaptionFeedback } from "./caption-memory.js";
import { CREATOR_HOOK_SECONDS, type StudioVideoInput } from "../shared/studio.js";
import { creatorLibrary, mixDiscoverClips, type DiscoverPair, type LibraryCreator } from "./creator-library.js";
import { writeDiscoverCaptions } from "./discover-captions.js";
import { createJob, listJobs, readJob, runJobStep, saveJob, studioDirectory, type StoredStudioJob } from "./studio-jobs.js";
import { publicJob } from "./studio-public.js";

export type StoredDiscoverBatch = Omit<DiscoverBatch, "jobs"> & {
  request: DiscoverRequest; requestKey: string;
  entries?: { jobId: string; pair: DiscoverPair; caption: DiscoverCaption }[];
};
const batchKey = (id: string) => `discover-${z.uuid().parse(id)}.json`;
export async function readDiscoverBatch(id: string): Promise<StoredDiscoverBatch | null> {
  return readRecord(batchKey(id));
}
async function saveBatch(batch: StoredDiscoverBatch) {
  await saveRecord(batchKey(batch.id), batch);
}

class FreshCreatorPoolError extends Error {}

function creatorsForBatch(creators: LibraryCreator[], batch: StoredDiscoverBatch, history: StoredDiscoverBatch[]) {
  if (batch.request.purpose === "taste") return creators;
  const setup = history.filter((entry) => entry.profileKey === batch.profileKey
    && entry.request.onboardingId === batch.request.onboardingId
    && entry.request.demoSetKey === batch.request.demoSetKey);
  // Batch numbers are lifetime counters for an app, not per-onboarding counters.
  // Identify the first Discover batch within this setup instead of number === 1.
  if (setup.some((entry) => entry.id !== batch.id && entry.request.purpose !== "taste" && entry.number < batch.number)) return creators;
  const tasteCreators = setup.filter((entry) => entry.request.purpose === "taste")
    .flatMap((entry) => entry.entries?.map(({ pair }) => pair.creator) ?? []);
  const usedIds = new Set(tasteCreators.map((creator) => creator.id));
  const usedPaths = new Set(tasteCreators.map((creator) => creator.path));
  const fresh = creators.filter((creator) => !usedIds.has(creator.id) && !usedPaths.has(creator.path));
  if (!fresh.length && tasteCreators.length) throw new FreshCreatorPoolError("The first Discover batch needs a premade creator clip that wasn’t used in Content Taste. Add more clips to the shared creator library, then retry.");
  return fresh;
}
export async function listDiscoverBatches(profileKey?: string) {
  const batches = (await listRecords<StoredDiscoverBatch>((key) => /^discover-[0-9a-f-]{36}\.json$/.test(key))).filter((batch) => !profileKey || batch.profileKey === profileKey);
  return batches.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}
export async function publicDiscoverBatch(batch: StoredDiscoverBatch): Promise<DiscoverBatch> {
  const jobs = await Promise.all((batch.entries ?? []).map(({ jobId }) => readJob(jobId)));
  return { id: batch.id, profileKey: batch.profileKey, number: batch.number, createdAt: batch.createdAt,
    status: batch.status, error: batch.error, purpose: batch.request.purpose ?? "discover", onboardingId: batch.request.onboardingId, demoSetKey: batch.request.demoSetKey,
    jobs: await Promise.all(jobs.filter((job): job is StoredStudioJob => Boolean(job)).map(publicJob)) };
}

// Single-process creation lock and worker queue: reserve caption history before the next batch.
let creating: Promise<unknown> = Promise.resolve();
export function createDiscoverBatch(request: DiscoverRequest): Promise<StoredDiscoverBatch> {
  const task = creating.then(async () => {
    const requestKey = JSON.stringify(request);
    const existing = await readDiscoverBatch(request.id);
    if (existing) {
      if (existing.requestKey !== requestKey) throw new Error("This request ID belongs to a different batch.");
      return existing;
    }
    const batches = await listDiscoverBatches(request.profileKey);
    if (batches.some((batch) => !["succeeded", "failed"].includes(batch.status)
      && batch.request.onboardingId === request.onboardingId && batch.request.demoSetKey === request.demoSetKey)) throw new Error("A batch is already running for this app setup. Resume it before creating more.");
    const batch: StoredDiscoverBatch = { id: request.id, request, requestKey, profileKey: request.profileKey,
      number: Math.max(0, ...batches.filter((entry) => (entry.request.purpose ?? "discover") === (request.purpose ?? "discover")).map((entry) => entry.number)) + 1, createdAt: new Date().toISOString(), status: "queued" };
    const created = await saveRecord(batchKey(batch.id), batch, true);
    if (created.requestKey !== requestKey) throw new Error("This request ID belongs to a different batch.");
    return created;
  });
  creating = task.catch(() => {});
  return task;
}

export function discoverVideoInput(batch: StoredDiscoverBatch, entry: NonNullable<StoredDiscoverBatch["entries"]>[number]): StudioVideoInput {
  const { pair, caption, jobId } = entry;
  return { id: jobId, appName: batch.request.brief.appName, profileKey: batch.profileKey,
    brief: batch.request.brief,
    clipId: pair.demo.clipId, uploadId: pair.demo.uploadId,
    prompt: pair.creator.description, hook: caption.hook, demoCaption: caption.demoCaption,
    demoSeconds: Math.min(8, (pair.demo.durationMs ?? 8000) / 1000),
    hookSeconds: CREATOR_HOOK_SECONDS, clampDemoDuration: true, demoTextPosition: "top", approved: true };
}

async function runBatch(id: string) {
  const batch = await readDiscoverBatch(id);
  if (!batch || ["succeeded", "failed"].includes(batch.status)) return;
  try {
    if (!batch.entries) {
      const creators = await creatorLibrary();
      const demos = await Promise.all(batch.request.demos.map(async (demo) => {
        const record = await readRecord<{ path: string }>(`upload-${z.uuid().parse(demo.uploadId)}.json`);
        if (!record) throw new Error("Demo not found for this account.");
        const demoPath = z.string().regex(/^demo\/[a-zA-Z0-9_-]+\.(mp4|webm)$/).parse(record.path);
        return { demo, demoPath };
      }));
      const history = await listDiscoverBatches(batch.profileKey);
      const pairs = mixDiscoverClips(creatorsForBatch(creators, batch, history), demos, Math.random, contentBatchSize(batch.request.purpose));
      const previous = history.flatMap((entry) => entry.entries?.map(({ caption }) => caption) ?? []);
      // Also avoid repeating captions from manually-created Studio videos for this app.
      previous.push(...(await listJobs(Infinity)).reverse().filter((job) => job.input.profileKey === batch.profileKey && (!job.origin || job.generatePost)).map((job) => ({ ...job.input, title: "", audience: "", post: job.post })));
      batch.status = "writing"; await saveBatch(batch);
      const memory = buildCaptionTasteMemory(await readCaptionFeedback(batch.profileKey));
      const captions = await writeDiscoverCaptions(batch.request, pairs, previous, memory);
      if (captions.length !== contentBatchSize(batch.request.purpose)) throw new Error("The caption batch has the wrong number of videos. Retry this batch.");
      batch.entries = captions.map((caption, index) => ({ caption, pair: pairs[index], jobId: randomUUID() }));
      // Persist all chosen clips, words, and IDs BEFORE rendering; retries never reshuffle.
      batch.status = "rendering"; await saveBatch(batch);
    }
    for (let index = 0; index < batch.entries.length; index++) {
      const entry = batch.entries[index];
      const input = discoverVideoInput(batch, entry);
      await createJob({ id: entry.jobId, input, requestKey: JSON.stringify(input), createdAt: batch.createdAt,
        status: "queued", assembly: "ffmpeg", creatorPath: entry.pair.creator.path, demoPath: entry.pair.demoPath,
        post: entry.caption.post,
        origin: { type: "discover", purpose: batch.request.purpose ?? "discover", batchId: batch.id, batchNumber: batch.number, index, creatorId: entry.pair.creator.id,
          title: entry.caption.title, audience: entry.caption.audience, styleTags: entry.caption.styleTags, formatId: entry.caption.formatId } });
    }
    for (const entry of batch.entries) {
      // The same job lock is used by Studio status polling, avoiding duplicate encodes.
      let job = await readJob(entry.jobId);
      while (job && !["succeeded", "failed"].includes(job.status)) {
        await runJobStep(entry.jobId);
        job = await readJob(entry.jobId);
      }
    }
    const jobs = await Promise.all(batch.entries.map((entry) => readJob(entry.jobId)));
    batch.status = jobs.every((job) => job?.status === "succeeded") ? "succeeded" : "failed";
    batch.error = batch.status === "failed" ? "Some videos couldn’t be assembled. Finished videos are saved. Retry unfinished videos using the same captions and clips; no Higgsfield generation." : undefined;
  } catch (error) {
    batch.error = (batch.status === "writing" || error instanceof FreshCreatorPoolError) && error instanceof Error ? error.message
      : "Couldn’t assemble this batch. Check the shared creator catalog, uploaded demos, FFmpeg, and private storage. Your saved footage is unchanged.";
    batch.status = "failed";
  }
  await saveBatch(batch);
}

let tail: Promise<unknown> = Promise.resolve();
const running = new Map<string, Promise<void>>();
export function scheduleDiscoverBatch(id: string): Promise<void> {
  const key = ownedKey(id);
  if (running.has(key)) return running.get(key)!;
  const task = tail.then(() => runBatch(id)).finally(() => running.delete(key));
  running.set(key, task); tail = task.catch(() => {});
  return task;
}
export function retryDiscoverBatch(id: string): Promise<void> {
  const task = creating.then(async () => {
    if (running.has(ownedKey(id))) return;
    const batch = await readDiscoverBatch(id);
    if (!batch || batch.status !== "failed") return;
    for (const entry of batch.entries ?? []) {
      const job = await readJob(entry.jobId);
      if (job?.status === "failed") { job.status = "queued"; job.error = undefined; await saveJob(job); }
    }
    batch.status = batch.entries ? "rendering" : "queued"; batch.error = undefined;
    await saveBatch(batch);
  });
  creating = task.catch(() => {});
  return task;
}
