import { describe, expect, it, vi } from "vitest";
vi.mock("./studio-providers.js", () => ({ signedMedia: async () => "https://media.test/final.mp4" }));
import { footageKey, publicJob } from "./studio-public.js";
import type { StoredStudioJob } from "./studio-jobs.js";
import { importRenderedVideo } from "../shared/content.js";

const job: StoredStudioJob = { id: "a", requestKey: "test", createdAt: "2026-09-28", status: "succeeded", creatorPath: "private/creator.mp4", demoPath: "private/demo.mp4", finalPath: "private/final.mp4", input: { id: "a", profileKey: "app", appName: "App", clipId: "demo", prompt: "A creator smiles", hook: "my hook", demoCaption: "my app", hookSeconds: 4, demoSeconds: 5, demoTextPosition: "top", approved: true } };
describe("Library footage identity", () => {
  it("ignores caption changes but separates different footage and trims", () => {
    expect(footageKey({ ...job, id: "b", input: { ...job.input, hook: "new caption" } })).toBe(footageKey(job));
    expect(footageKey({ ...job, creatorPath: "different.mp4" })).not.toBe(footageKey(job));
    expect(footageKey({ ...job, demoPath: "different.mp4" })).not.toBe(footageKey(job));
    expect(footageKey({ ...job, input: { ...job.input, hookSeconds: 3 } })).not.toBe(footageKey(job));
    expect(footageKey({ ...job, input: { ...job.input, demoSeconds: 8 } })).not.toBe(footageKey(job));
    expect(footageKey({ ...job, creatorPath: undefined })).toBeUndefined();
  });
  it("returns an opaque key for existing renders and retains it through import and caption edits", async () => {
    const result = await publicJob(job);
    expect(result.footageKey).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(result)).not.toContain("private/");
    const items = importRenderedVideo([], result);
    expect(items[0].footageKey).toBe(result.footageKey);
    const edited = importRenderedVideo(items, { ...result, id: "b", input: { ...job.input, reuseJobId: "a", hook: "new caption" } });
    expect(edited).toHaveLength(1);
    expect(edited[0].footageKey).toBe(result.footageKey);
  });
});
