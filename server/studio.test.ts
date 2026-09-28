import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { app } from "./app.js";
import { advanceJob, createJob, readJob, type StoredStudioJob } from "./studio-jobs.js";
import { creatorRequest, renderScript } from "./studio-render.js";
import type { StudioProviders } from "./studio-providers.js";
import { StudioVideoInputSchema } from "../shared/studio.js";
import { importRenderedVideo, editCaptions, type ContentConcept } from "../shared/content.js";

const input = StudioVideoInputSchema.parse({ id: "4b7f07bc-d797-4c43-bc25-d721afcae600", uploadId: "4b7f07bc-d797-4c43-bc25-d721afcae601", appName: "Focus Fox", profileKey: "focusfox.test", clipId: "demo-1", prompt: "An adult creator reacts with surprise", hook: "Wait, this is an app?", demoCaption: "Choose a task and start focusing", demoSeconds: 8, approved: true });
const makeJob = (): StoredStudioJob => ({ id: input.id, input, requestKey: JSON.stringify(input), status: "queued", createdAt: new Date().toISOString(), demoPath: "demo/input.mp4" });
function mocks(): StudioProviders {
  return { startCreator: vi.fn().mockResolvedValue("hf-id"), creatorStatus: vi.fn().mockResolvedValue({ status: "completed", url: "https://provider.test/hook.mp4" }), startRender: vi.fn().mockResolvedValue("render-id"), renderStatus: vi.fn().mockResolvedValue({ status: "succeeded", url: "https://provider.test/final.mp4" }), archive: vi.fn().mockResolvedValue(undefined) };
}
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe("real Studio pipeline (mocked providers, no paid calls)", () => {
  it("saves platform copy before video submission and keeps it out of overlay text", async () => {
    const job = { ...makeJob(), generatePost: true };
    const provider = mocks();
    const post = { caption: "my new focus routine", hashtags: ["#Focus", "#Productivity"] };
    const writer = vi.fn().mockResolvedValue(post);
    const saved: StoredStudioJob[] = [];
    const save = async (value: StoredStudioJob) => { saved.push(structuredClone(value)); };
    await advanceJob(job, save, provider, undefined, writer);
    expect(saved.map((value) => value.status)).toEqual(["writing_post", "queued"]);
    expect(saved[1].post).toEqual(post);
    expect(provider.startCreator).not.toHaveBeenCalled();
    await advanceJob(job, save, provider, undefined, writer);
    expect(writer).toHaveBeenCalledTimes(1);
    expect(provider.startCreator).toHaveBeenCalledTimes(1);
    expect(job.input.hook).toBe(input.hook);
    expect(renderScript(job.input, "https://hook", "https://demo").elements.slice(2).map((element) => element.text)).toEqual([input.hook, input.demoCaption]);
  });
  it("stops a failed post-writing step before any paid creator or render call", async () => {
    const job = { ...makeJob(), generatePost: true };
    const provider = mocks();
    const writer = vi.fn().mockRejectedValue(new Error("Gemini unavailable"));
    await advanceJob(job, async () => {}, provider, undefined, writer);
    await advanceJob(job, async () => {}, provider, undefined, writer);
    expect(job.status).toBe("failed");
    expect(job.error).toContain("No new creator generation");
    expect(writer).toHaveBeenCalledTimes(1);
    expect(provider.startCreator).not.toHaveBeenCalled();
    expect(provider.startRender).not.toHaveBeenCalled();
  });
  it("adds real videos without replacing previews and updates only the matching video on a caption revision", () => {
    const placeholder: ContentConcept = { id: "preview", title: "Preview", hook: "Hook", demoCaption: "Demo", payoff: "Payoff", creator: "Placeholder", clipId: "clip", status: "pending", source: "agent", collection: "discover", batch: 1, saved: false, queued: false, ignored: false };
    const job = { id: input.id, input, status: "succeeded" as const, createdAt: "today", canReuse: true, videoUrl: "https://video.test/one.mp4" };
    const items = importRenderedVideo([placeholder], job);
    expect(items).toHaveLength(2);
    expect(items[0]).toEqual(placeholder);
    expect(importRenderedVideo(items, job)).toHaveLength(2);
    const revised = importRenderedVideo(items, { ...job, id: "revision", input: { ...input, reuseJobId: job.id, hook: "Updated" } });
    expect(revised).toHaveLength(2);
    expect(revised[1].hook).toBe("Updated");
    expect(editCaptions(revised[1], { hook: "Fake local edit", demoCaption: "Demo", payoff: "" })).toEqual(revised[1]);
  });
  it("requests the four-second provider minimum, with legacy five-second and new three-second assembly", () => {
    expect(creatorRequest(input.prompt)).toMatchObject({ duration: 4, generate_audio: false, aspect_ratio: "9:16", resolution: "720p" });
    const script = renderScript(input, "https://hook", "https://demo");
    expect(script.duration).toBe(13);
    expect(script.elements.slice(0, 2)).toMatchObject([{ time: 0, duration: 5, volume: "0%" }, { time: 5, duration: 8, fit: "contain", volume: "0%" }]);
    expect(script.elements.slice(2)).toMatchObject([{ text: input.hook, time: 0, duration: 5, stroke_color: "#000000", animations: [] }, { text: input.demoCaption, time: 5, duration: 8, animations: [] }]);
    const short = renderScript({ ...input, hookSeconds: 3 }, "https://hook", "https://demo");
    expect(short.duration).toBe(11);
    expect(short.elements.slice(0, 2)).toMatchObject([{ duration: 3 }, { time: 3, duration: 8 }]);
    expect(StudioVideoInputSchema.safeParse({ ...input, approved: false }).success).toBe(false);
    expect(StudioVideoInputSchema.safeParse({ ...input, demoSeconds: 11 }).success).toBe(false);
  });
  it("persists submission intent, produces one creator and one render, and archives both", async () => {
    const job = makeJob(); const provider = mocks(); const history: string[] = [];
    const save = async (value: StoredStudioJob) => { history.push(value.status); };
    for (let step = 0; step < 6; step++) await advanceJob(job, save, provider);
    expect(job.status).toBe("succeeded");
    expect(history[0]).toBe("submitting_creator");
    expect(history).toContain("submitting_render");
    expect(provider.startCreator).toHaveBeenCalledTimes(1);
    expect(provider.startRender).toHaveBeenCalledTimes(1);
    expect(provider.archive).toHaveBeenCalledTimes(2);
    expect(job.finalPath).toBe(`final/${input.id}.mp4`);
  });
  it("does not repeat ambiguous paid requests and can reuse footage for assembly", async () => {
    const failed = makeJob(); const provider = mocks();
    vi.mocked(provider.startCreator).mockRejectedValue(new Error("timeout"));
    await advanceJob(failed, async () => {}, provider);
    await advanceJob(failed, async () => {}, provider);
    expect(failed.status).toBe("failed");
    expect(provider.startCreator).toHaveBeenCalledTimes(1);
    const resumed = { ...makeJob(), status: "submitting_creator" as const };
    await advanceJob(resumed, async () => {}, provider);
    expect(provider.startCreator).toHaveBeenCalledTimes(1);
    const reuse = { ...makeJob(), creatorPath: "creator/original.mp4" };
    await advanceJob(reuse, async () => {}, provider);
    expect(reuse.status).toBe("rendering");
    expect(provider.startCreator).toHaveBeenCalledTimes(1);
    expect(provider.startRender).toHaveBeenCalledTimes(1);
  });
  it("stores job IDs durably and reuses a duplicate without replacing it", async () => {
    const directory = await mkdtemp(join(tmpdir(), "growthbanana-studio-test-"));
    vi.stubEnv("STUDIO_DATA_DIR", directory);
    try {
      const job = makeJob(); await createJob(job);
      await createJob({ ...job, status: "failed" });
      expect((await readJob(job.id))?.status).toBe("queued");
    } finally { await rm(directory, { recursive: true, force: true }); }
  });
  it("assembles saved footage locally without calling either paid provider", async () => {
    const job: StoredStudioJob = { ...makeJob(), assembly: "ffmpeg", creatorPath: "creator/original.mp4" };
    const provider = mocks();
    const localRender = vi.fn().mockResolvedValue(`final/${job.id}.mp4`);
    await advanceJob(job, async () => {}, provider, localRender);
    expect(job.status).toBe("assembling_local");
    await advanceJob(job, async () => {}, provider, localRender);
    expect(job.status).toBe("succeeded");
    expect(localRender).toHaveBeenCalledWith(job.input, job.creatorPath, job.demoPath);
    expect(provider.startCreator).not.toHaveBeenCalled();
    expect(provider.startRender).not.toHaveBeenCalled();
  });
  it("never generates a replacement when a catalog record lacks its footage", async () => {
    const job: StoredStudioJob = { ...makeJob(), input: { ...input, creatorId: "creator-1" }, assembly: "ffmpeg" };
    const provider = mocks();
    await advanceJob(job, async () => {}, provider);
    expect(job.status).toBe("failed");
    expect(provider.startCreator).not.toHaveBeenCalled();
  });
  it("caption variations reuse their one archived source without another paid call", async () => {
    const directory = await mkdtemp(join(tmpdir(), "growthbanana-variation-test-"));
    vi.stubEnv("STUDIO_DATA_DIR", directory);
    try {
      const source = { ...makeJob(), status: "succeeded" as const, creatorPath: "creator/original.mp4" };
      await createJob(source);
      const job: StoredStudioJob = { ...makeJob(), id: input.uploadId!, input: { ...input, id: input.uploadId!, savedCreatorJobId: input.id, hookSeconds: 4 }, assembly: "ffmpeg" };
      const provider = mocks();
      const render = vi.fn().mockResolvedValue("final/variation.mp4");
      await advanceJob(job, async () => {}, provider, render);
      await advanceJob(job, async () => {}, provider, render);
      expect(job.status).toBe("succeeded");
      expect(render).toHaveBeenCalledWith(job.input, "creator/original.mp4", job.demoPath);
      expect(provider.startCreator).not.toHaveBeenCalled();
      expect(provider.startRender).not.toHaveBeenCalled();
    } finally { await rm(directory, { recursive: true, force: true }); }
  });
  it("keeps saved footage on local render failure and safely resumes interrupted local assembly", async () => {
    const job: StoredStudioJob = { ...makeJob(), assembly: "ffmpeg", creatorPath: "creator/original.mp4", status: "assembling_local" };
    const provider = mocks();
    await advanceJob(job, async () => {}, provider, vi.fn().mockRejectedValue(new Error("ffmpeg missing")));
    expect(job.status).toBe("failed");
    expect(job.creatorPath).toBe("creator/original.mp4");
    expect(job.error).toContain("Local assembly failed");
    const interrupted: StoredStudioJob = { ...job, status: "assembling_local" };
    await advanceJob(interrupted, async () => {}, provider, vi.fn().mockResolvedValue("final/local.mp4"));
    expect(interrupted.status).toBe("succeeded");
    expect(provider.startRender).not.toHaveBeenCalled();
    expect(provider.startCreator).not.toHaveBeenCalled();
  });
  it("requires local opt-in and credentials, then accepts code-free requests while validating paid approval", async () => {
    vi.stubEnv("NODE_ENV", "test");
    for (const key of ["HF_CREDENTIALS", "GEMINI_API_KEY", "CREATOMATE_API_KEY", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "STUDIO_ALLOW_UNAUTHENTICATED"]) vi.stubEnv(key, "");
    vi.stubEnv("STUDIO_ALLOW_UNAUTHENTICATED", "true");
    expect((await app.request("/api/studio/jobs")).status).toBe(503);
    for (const key of ["HF_CREDENTIALS", "GEMINI_API_KEY", "CREATOMATE_API_KEY", "SUPABASE_SERVICE_ROLE_KEY"]) vi.stubEnv(key, "test-secret");
    vi.stubEnv("SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("CREATOMATE_API_KEY", ""); // No longer required for new local renders.
    for (const value of ["", "false"]) {
      vi.stubEnv("STUDIO_ALLOW_UNAUTHENTICATED", value);
      expect((await app.request("/api/studio/jobs")).status).toBe(503);
    }
    vi.stubEnv("STUDIO_ALLOW_UNAUTHENTICATED", "true");
    expect(await (await app.request("/api/studio/config")).json()).toMatchObject({ ready: true, missing: [] });
    const response = await app.request("/api/studio/jobs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...input, approved: false }) });
    expect(response.status).toBe(400);
    expect((await response.json()).error).toContain("expected true");
    expect((await app.request("/api/studio/jobs/not-a-uuid")).status).toBe(400);
  });
  it("blocks every Studio operation in production even with local mode opted in", async () => {
    vi.stubEnv("AUTH_MODE", "local");
    for (const key of ["HF_CREDENTIALS", "CREATOMATE_API_KEY", "SUPABASE_SERVICE_ROLE_KEY"]) vi.stubEnv(key, "test-secret");
    vi.stubEnv("SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("STUDIO_ALLOW_UNAUTHENTICATED", "true");
    vi.stubEnv("NODE_ENV", "production");
    expect((await app.request("/api/studio/config")).status).toBe(503);
    for (const [path, method] of [["/jobs", "GET"], ["/jobs", "POST"], [`/jobs/${input.id}`, "GET"], ["/uploads", "POST"]]) {
      expect((await app.request(`/api/studio${path}`, { method })).status).toBe(503);
    }
  });
});
