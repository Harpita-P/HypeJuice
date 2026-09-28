import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StoredStudioJob } from "./studio-jobs.js";
const mocks = vi.hoisted(() => ({ jobs: new Map<string, unknown>(), ready: false, allowance: vi.fn() }));
vi.mock("./records.js", () => ({ readRecord: async () => ({ path: "demo/owned.mp4" }), saveRecord: vi.fn() }));
vi.mock("./identity.js", () => ({ authenticatedMode: () => false, allowance: mocks.allowance }));
vi.mock("./studio-jobs.js", () => ({ readJob: async (id: string) => mocks.jobs.get(id), createJob: async (job: StoredStudioJob) => { mocks.jobs.set(job.id, job); return job; }, listJobs: async () => [], tickJob: vi.fn() }));
vi.mock("./studio-providers.js", () => ({ mediaConfig: () => ({ ready: true, missing: [] }), studioConfig: () => ({ ready: mocks.ready, missing: mocks.ready ? [] : ["HF_CREDENTIALS"] }), uploadMedia: vi.fn(), signedMedia: async () => "https://media.test/preview.mp4" }));
vi.mock("./studio-public.js", () => ({ publicJob: async (job: StoredStudioJob) => ({ id: job.id, input: job.input, status: job.status, canReuse: Boolean(job.creatorPath) }) }));
vi.mock("./studio-ideas.js", () => ({ writeCreatorIdeas: vi.fn() }));
vi.mock("./creator-library.js", () => ({ creatorLibrary: async () => [{ id: "creator-1", path: "creator/shared.mp4", description: "An adult reacts with surprise at home.", sourcePrompt: "An adult looking surprised at their phone." }] }));
import { studioRoutes } from "./studio-routes.js";
import { StudioVideoInputSchema } from "../shared/studio.js";

const base = { id: "00000000-0000-4000-8000-000000000001", uploadId: "00000000-0000-4000-8000-000000000002", profileKey: "app", appName: "Focus Fox", clipId: "demo", prompt: "An adult smiling naturally at their phone", hook: "my brain needed this", demoCaption: "i start one little task", demoSeconds: 5, hookSeconds: 4, approved: true, post: { caption: "my tiny focus reset", hashtags: ["#Focus"] } };
const post = (input: object) => studioRoutes.request("/jobs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
beforeEach(() => { mocks.jobs.clear(); mocks.ready = false; mocks.allowance.mockClear(); });

describe("Studio creator choice: no real provider calls", () => {
  it("uses only catalog footage without Higgsfield setup and preserves four seconds", async () => {
    const response = await post({ ...base, creatorId: "creator-1" });
    expect(response.status).toBe(202);
    const job = mocks.jobs.get(base.id) as StoredStudioJob;
    expect(job.creatorPath).toBe("creator/shared.mp4");
    expect(job.input.prompt).toBe("An adult looking surprised at their phone.");
    expect(job.input.hookSeconds).toBe(4);
    expect(job.post).toEqual(base.post);
    expect(mocks.allowance).toHaveBeenCalledWith("video-revisions", 20);
    expect((await post({ ...base, creatorId: "creator-1" })).status).toBe(200);
    expect(mocks.allowance).toHaveBeenCalledTimes(1);
  });
  it("rejects an unavailable catalog creator instead of falling back to generation", async () => {
    mocks.ready = true;
    expect((await post({ ...base, creatorId: "missing" })).status).toBe(404);
    expect(mocks.jobs.size).toBe(0);
  });
  it("only the describe path requires paid creator setup; variations reuse its source", async () => {
    expect((await post(base)).status).toBe(503);
    mocks.ready = true;
    expect((await post(base)).status).toBe(202);
    expect((mocks.jobs.get(base.id) as StoredStudioJob).creatorPath).toBeUndefined();
    expect(mocks.allowance).toHaveBeenCalledWith("paid-creator", 3);
    mocks.ready = false; // Reuse works even if paid generation is now disabled.
    const second = { ...base, id: "00000000-0000-4000-8000-000000000003", savedCreatorJobId: base.id };
    expect((await post(second)).status).toBe(202);
    expect((mocks.jobs.get(second.id) as StoredStudioJob).input.savedCreatorJobId).toBe(base.id);
    expect(mocks.allowance.mock.calls.filter(([kind]) => kind === "paid-creator")).toHaveLength(1);
  });
  it("rejects ambiguous sources and self-dependency", () => {
    expect(StudioVideoInputSchema.safeParse({ ...base, creatorId: "creator-1", savedCreatorJobId: base.uploadId }).success).toBe(false);
    expect(StudioVideoInputSchema.safeParse({ ...base, savedCreatorJobId: base.id }).success).toBe(false);
  });
});
