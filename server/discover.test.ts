import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { demoSetKey, DiscoverRequestSchema, restorableContentBatches, validateDiscoverCaptions, type DiscoverBatch, type DiscoverCaption } from "../shared/discover.js";
import { importRenderedVideo } from "../shared/content.js";
import { createDiscoverBatch, publicDiscoverBatch, readDiscoverBatch, retryDiscoverBatch, scheduleDiscoverBatch } from "./discover-jobs.js";
import { advanceJob, readJob } from "./studio-jobs.js";
import { mixDiscoverClips } from "./creator-library.js";
import { buildSourceDraft } from "./brief-generator.js";
import { discoverRoutes } from "./discover-routes.js";
import { readCaptionFeedback, saveCaptionFeedback } from "./caption-memory.js";
import { applyCaptionFeedback, buildCaptionTasteMemory, tasteReviewComplete } from "../shared/feedback.js";

const mocks = vi.hoisted(() => ({ captions: vi.fn(), render: vi.fn(), creator: vi.fn(), paidRender: vi.fn() }));
vi.mock("./discover-captions.js", () => ({ writeDiscoverCaptions: mocks.captions }));
vi.mock("./studio-local.js", () => ({ renderLocalVideo: mocks.render }));
vi.mock("./studio-providers.js", async (importOriginal) => ({
  ...await importOriginal<typeof import("./studio-providers.js")>(),
  signedMedia: async (path: string) => `https://media.test/${path}`,
  studioProviders: { startCreator: mocks.creator, startRender: mocks.paidRender },
}));

const captions: DiscoverCaption[] = [
  { title: "Overthinking", audience: "Students", hook: "me turning one task into a whole saga", demoCaption: "i pick a tiny task and start the timer" },
  { title: "Quiet", audience: "Working professionals", hook: "my brain needed a quieter work session", demoCaption: "we make room for one thing at a time" },
  { title: "Tabs", audience: "Students", hook: "i have more tabs than actual plans", demoCaption: "my next step finally fits on one screen" },
  { title: "Start", audience: "Working professionals", hook: "we can stop negotiating with our to do", demoCaption: "i give this task a little focus window" },
  { title: "Reset", audience: "Busy people", hook: "my afternoon needed this tiny reset", demoCaption: "us starting small instead of planning forever" },
].map((caption, index) => ({ ...caption, formatId: ["ugc-01", "ugc-11", "ugc-21", "ugc-31", "ugc-61"][index],
  post: { caption: `my focus routine, one small step at a time (${index + 1})`, hashtags: ["#Focus", "#StudyRoutine"] } }));
const creators = [
  { id: "one", path: "creator/one.mp4", description: "Adult creator one" },
  { id: "two", path: "creator/two.mp4", description: "Adult creator two" },
];
let directory: string;
beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "growthbanana-discover-test-"));
  vi.stubEnv("STUDIO_DATA_DIR", directory);
  const catalog = join(directory, "catalog.json");
  await writeFile(catalog, JSON.stringify(creators)); vi.stubEnv("DISCOVER_CREATOR_LIBRARY", catalog);
  vi.clearAllMocks();
  mocks.captions.mockResolvedValue(captions);
  mocks.render.mockImplementation(async (input) => `final/${input.id}.mp4`);
});
afterEach(async () => { vi.unstubAllEnvs(); await rm(directory, { recursive: true, force: true }); });
async function request() {
  const uploadId = randomUUID();
  await writeFile(join(directory, `upload-${uploadId}.json`), JSON.stringify({ path: `demo/${uploadId}.mp4` }));
  return DiscoverRequestSchema.parse({ id: randomUUID(), profileKey: "focus.test",
    brief: buildSourceDraft([{ kind: "founder_note", url: null, title: "Focus", text: "Focus Fox is a timer for distraction-free work." }]),
    demos: [{ clipId: "demo-1", uploadId, shows: "Starting a focus timer", durationMs: 2000 }], approved: true });
}

describe("Discover assembly and captions (no live provider calls)", () => {
  it("invalidates demo identity on addition, deletion or replacement, but not reordering", () => {
    const one = { id: "one", importedAt: "2026-09-28" };
    const two = { id: "two", importedAt: "2026-09-29" };
    expect(demoSetKey([one, two])).toBe(demoSetKey([two, one]));
    expect(demoSetKey([one])).not.toBe(demoSetKey([one, two]));
    expect(demoSetKey([one])).not.toBe(demoSetKey([{ ...one, importedAt: "2026-09-29" }]));
    expect(demoSetKey([one])).not.toBe(demoSetKey([]));
  });
  it("restores only the current onboarding run for both Taste and Discover", () => {
    const base: DiscoverBatch = { id: randomUUID(), profileKey: "focus.test", number: 1, createdAt: "2026-09-28", status: "succeeded", jobs: [], purpose: "taste" };
    const legacy = { ...base };
    const previous = { ...base, id: randomUUID(), onboardingId: "previous-analysis" };
    const current = { ...base, id: randomUUID(), onboardingId: "new-analysis", status: "rendering" as const };
    const discover = { ...base, id: randomUUID(), purpose: undefined, onboardingId: "new-analysis" };
    const batches = [legacy, previous, current, discover];
    expect(restorableContentBatches(batches, "taste", "new-analysis")).toEqual([current]);
    expect(restorableContentBatches(batches, "taste", "another-analysis")).toEqual([]);
    expect(restorableContentBatches(batches, "discover", "new-analysis")).toEqual([discover]);
    expect(restorableContentBatches(batches, "discover", "another-analysis")).toEqual([]);
    expect(restorableContentBatches([{ ...discover, onboardingId: undefined }], "discover", "new-analysis")).toEqual([]);
  });
  it("never restores batches for deleted or replaced demos, including unfinished batches", () => {
    const base: DiscoverBatch = { id: randomUUID(), profileKey: "focus.test", number: 1, createdAt: "2026-09-28", status: "succeeded", jobs: [], purpose: "discover", onboardingId: "same-app" };
    const previous = { ...base, demoSetKey: "old-demos" };
    const inFlight = { ...previous, id: randomUUID(), status: "rendering" as const };
    const current = { ...base, id: randomUUID(), demoSetKey: "current-demos" };
    expect(restorableContentBatches([base, previous, inFlight, current], "discover", "same-app", "current-demos")).toEqual([current]);
    expect(restorableContentBatches([current], "discover", "same-app", "[]")).toEqual([]);
    expect(restorableContentBatches([{ ...current, purpose: "taste" }], "taste", "same-app", "new-demos")).toEqual([]);
  });
  it("makes a fresh Taste batch for the same app on a new onboarding run, keeping caption history and retry identity", async () => {
    mocks.captions.mockResolvedValue(captions.slice(0, 3));
    const first = DiscoverRequestSchema.parse({ ...await request(), purpose: "taste", onboardingId: "first-analysis" });
    await createDiscoverBatch(first); await scheduleDiscoverBatch(first.id);
    const second = DiscoverRequestSchema.parse({ ...first, id: randomUUID(), onboardingId: "second-analysis" });
    await createDiscoverBatch(second); await scheduleDiscoverBatch(second.id);
    const batches = await Promise.all([first, second].map(async (input) => publicDiscoverBatch((await readDiscoverBatch(input.id))!)));
    expect(batches.map((batch) => batch.onboardingId)).toEqual(["first-analysis", "second-analysis"]);
    expect(restorableContentBatches(batches, "taste", "second-analysis")).toEqual([batches[1]]);
    expect(batches[1].jobs).toHaveLength(3);
    expect(batches[1].jobs.every((job) => !batches[0].jobs.some((old) => old.id === job.id))).toBe(true);
    expect(mocks.captions.mock.calls[1][2]).toEqual(expect.arrayContaining(captions.slice(0, 3)));
    await createDiscoverBatch(second); await scheduleDiscoverBatch(second.id);
    expect(mocks.captions).toHaveBeenCalledTimes(2);
    expect(mocks.render).toHaveBeenCalledTimes(6);
    expect(mocks.creator).not.toHaveBeenCalled();
  });
  it("renders exactly three Taste videos, remembers ratings durably, and steers the next five", async () => {
    mocks.captions.mockResolvedValueOnce(captions.slice(0, 3));
    const input = { ...await request(), purpose: "taste" as const };
    await createDiscoverBatch(input); await scheduleDiscoverBatch(input.id);
    const taste = (await readDiscoverBatch(input.id))!;
    expect(taste.status).toBe("succeeded"); expect(taste.entries).toHaveLength(3);
    expect(mocks.captions.mock.calls[0][1]).toHaveLength(3);
    expect(mocks.render).toHaveBeenCalledTimes(3);
    const jobs = await Promise.all(taste.entries!.map((entry) => readJob(entry.jobId)));
    let items = jobs.reduce((items, job) => importRenderedVideo(items, { ...job!, canReuse: true, videoUrl: "https://media.test/video.mp4" }), [] as ReturnType<typeof importRenderedVideo>);
    expect(items.every((item) => item.collection === "taste")).toBe(true);
    expect(tasteReviewComplete(items, true, false)).toBe(false);
    const choices = ["loved", "tossed", "loved"] as const;
    const votes = await Promise.all(jobs.map((job, index) => saveCaptionFeedback({ profileKey: input.profileKey, jobId: job!.id, verdict: choices[index] })));
    items = applyCaptionFeedback(items, votes);
    expect(items.filter((item) => item.saved)).toHaveLength(0);
    expect(items.filter((item) => item.queued)).toHaveLength(0);
    expect(tasteReviewComplete(items, true, false)).toBe(true);
    expect(tasteReviewComplete(items, false, false)).toBe(false);
    expect(tasteReviewComplete(items, true, true)).toBe(false);
    expect(await readCaptionFeedback(input.profileKey)).toHaveLength(3);
    expect(await readCaptionFeedback("another-app")).toEqual([]);
    await expect(saveCaptionFeedback({ profileKey: "another-app", jobId: jobs[0]!.id, verdict: "loved" })).rejects.toThrow("belonging to this app");
    expect(await saveCaptionFeedback({ profileKey: input.profileKey, jobId: jobs[0]!.id, verdict: "loved" })).toEqual(votes[0]);
    const next = { ...input, id: randomUUID(), purpose: "discover" as const };
    await createDiscoverBatch(next); await scheduleDiscoverBatch(next.id);
    expect((await readDiscoverBatch(next.id))?.number).toBe(1);
    expect(mocks.captions.mock.calls[1][1]).toHaveLength(5);
    const memory = mocks.captions.mock.calls[1][3];
    expect(memory.liked).toHaveLength(2); expect(memory.disliked).toHaveLength(1);
    expect(memory.disliked[0].hook).toBe(captions[1].hook);
    expect(memory.disliked[0].formatId).toBe(captions[1].formatId);
    expect(mocks.creator).not.toHaveBeenCalled(); expect(mocks.paidRender).not.toHaveBeenCalled();
    // A changed vote replaces the previous one; undo isn't a new dislike.
    await saveCaptionFeedback({ profileKey: input.profileKey, jobId: jobs[1]!.id, verdict: "loved" });
    await saveCaptionFeedback({ profileKey: input.profileKey, jobId: jobs[0]!.id, verdict: "pending" });
    const updated = buildCaptionTasteMemory(await readCaptionFeedback(input.profileKey));
    expect(updated.liked).toHaveLength(2); expect(updated.disliked).toHaveLength(0); expect(updated.totalRatings).toBe(2);
  });
  it("accepts an approved batch without Higgsfield credentials but blocks production access", async () => {
    vi.stubEnv("NODE_ENV", "test"); vi.stubEnv("STUDIO_ALLOW_UNAUTHENTICATED", "true");
    vi.stubEnv("SUPABASE_URL", "https://storage.test"); vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-key");
    vi.stubEnv("GEMINI_API_KEY", "test-key"); vi.stubEnv("HF_CREDENTIALS", "");
    expect(await (await discoverRoutes.request("/config")).json()).toMatchObject({ ready: true, creatorCount: 2 });
    const input = await request();
    const invalid = await discoverRoutes.request("/batches", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...input, approved: false }) });
    expect(invalid.status).toBe(400);
    const accepted = await discoverRoutes.request("/batches", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
    expect(accepted.status).toBe(202);
    await scheduleDiscoverBatch(input.id);
    const restored = await discoverRoutes.request(`/batches?profileKey=${input.profileKey}`);
    expect((await restored.json())[0]).toMatchObject({ status: "succeeded", jobs: expect.any(Array) });
    expect(mocks.creator).not.toHaveBeenCalled();
    vi.stubEnv("NODE_ENV", "production");
    expect((await discoverRoutes.request(`/batches/${input.id}`)).status).toBe(503);
  });
  it("accepts short first-person pairs and rejects repeated, near-repeated, long, or third-person captions", () => {
    expect(validateDiscoverCaptions(captions, [])).toHaveLength(5);
    expect(() => validateDiscoverCaptions(captions, [captions[0]])).toThrow("repeat");
    expect(() => validateDiscoverCaptions([{ ...captions[0], hook: captions[0].hook + "!" }, ...captions.slice(1)], [captions[0]])).toThrow("repeat");
    expect(() => validateDiscoverCaptions([{ ...captions[0], hook: "The best productivity app ever" }, ...captions.slice(1)], [])).toThrow("first-person");
    expect(() => validateDiscoverCaptions([{ ...captions[0], demoCaption: Array(13).fill("my").join(" ") }, ...captions.slice(1)], [])).toThrow("12 words");
    expect(() => validateDiscoverCaptions([{ ...captions[0], demoCaption: captions[0].hook }, ...captions.slice(1)], [])).toThrow("repeat");
  });
  it("cycles saved creators and handles a single demo without generating a replacement", async () => {
    const input = await request();
    const pairs = mixDiscoverClips(creators, [{ demo: input.demos[0], demoPath: "demo/one.mp4" }], () => 0.2);
    expect(pairs).toHaveLength(5);
    expect(new Set(pairs.map((pair) => pair.creator.id)).size).toBe(2);
    expect(new Set(pairs.map((pair) => pair.demo.clipId)).size).toBe(1);
    const multiple = mixDiscoverClips(creators, [0, 1, 2].map((index) => ({ demo: { ...input.demos[0], clipId: `demo-${index}` }, demoPath: `demo/${index}.mp4` })), () => 0.2);
    expect(new Set(multiple.map((pair) => pair.demo.clipId)).size).toBe(3);
    expect(() => mixDiscoverClips([], [])).toThrow("at least one");
  });
  it("persists five jobs, restores them, and makes duplicate requests idempotent with no paid video calls", async () => {
    const input = await request();
    const first = await createDiscoverBatch(input);
    expect(await createDiscoverBatch(input)).toEqual(first);
    await expect(createDiscoverBatch({ ...input, id: randomUUID() })).rejects.toThrow("already running");
    await Promise.all([scheduleDiscoverBatch(first.id), scheduleDiscoverBatch(first.id)]);
    const batch = (await readDiscoverBatch(first.id))!;
    expect(batch.status).toBe("succeeded"); expect(batch.entries).toHaveLength(5);
    expect(mocks.captions).toHaveBeenCalledTimes(1); expect(mocks.render).toHaveBeenCalledTimes(5);
    const job = (await readJob(batch.entries![0].jobId))!;
    expect(job.input).toMatchObject({ hookSeconds: 3, demoSeconds: 2, clampDemoDuration: true });
    expect(job.creatorPath).toMatch(/^creator\/(one|two)\.mp4$/);
    expect(job.origin).toMatchObject({ type: "discover", index: 0, batchId: first.id });
    expect(job.post).toEqual(captions[0].post);
    expect(job.origin?.formatId).toBe(captions[0].formatId);
    await scheduleDiscoverBatch(first.id);
    expect(mocks.render).toHaveBeenCalledTimes(5);
    expect(mocks.creator).not.toHaveBeenCalled(); expect(mocks.paidRender).not.toHaveBeenCalled();
    const restored = JSON.parse(await readFile(join(directory, `discover-${first.id}.json`), "utf8"));
    expect(restored.entries[0].caption).toEqual(captions[0]);
    const items = importRenderedVideo([], { ...job, canReuse: true, videoUrl: "https://media.test/final.mp4" });
    expect(items[0]).toMatchObject({ collection: "discover", source: "agent", batch: 1 });
    expect(items[0].post).toEqual(captions[0].post);
    const skipped = [{ ...items[0], ignored: true, saved: true, queued: true }];
    expect(importRenderedVideo(skipped, { ...job, canReuse: true, videoUrl: "https://media.test/refreshed.mp4" })[0]).toMatchObject({ ignored: true, saved: true, queued: true });
  });
  it("retries only failed assembly with the same clips and captions, preserving successful outputs", async () => {
    mocks.render.mockRejectedValueOnce(new Error("temporary render failure"));
    const input = await request(); await createDiscoverBatch(input); await scheduleDiscoverBatch(input.id);
    const original = (await readDiscoverBatch(input.id))!;
    expect(original.status).toBe("failed");
    await retryDiscoverBatch(input.id); await scheduleDiscoverBatch(input.id);
    const finished = (await readDiscoverBatch(input.id))!;
    expect(finished.status).toBe("succeeded"); expect(finished.entries).toEqual(original.entries);
    expect(mocks.render).toHaveBeenCalledTimes(6); expect(mocks.captions).toHaveBeenCalledTimes(1);
    expect(mocks.creator).not.toHaveBeenCalled(); expect(mocks.paidRender).not.toHaveBeenCalled();
  });
  it("blocks fallback generation if Discover loses its saved creator reference", async () => {
    const input = await request(); await createDiscoverBatch(input); await scheduleDiscoverBatch(input.id);
    const batch = (await readDiscoverBatch(input.id))!;
    const job = (await readJob(batch.entries![0].jobId))!;
    job.status = "queued"; job.creatorPath = undefined;
    await advanceJob(job, async () => {});
    expect(job.status).toBe("failed"); expect(job.error).toContain("No new creator");
    expect(mocks.creator).not.toHaveBeenCalled();
  });
});
