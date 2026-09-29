import { beforeEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import type { YouTubeTrackingView } from "../shared/youtube-tracking.js";
import { latestViewSnapshot, rankedLiftoff } from "../shared/liftoff.js";

const mocks = vi.hoisted(() => ({ read: vi.fn(), tracking: vi.fn(), generate: vi.fn(), allowance: vi.fn() }));
vi.mock("./studio-jobs.js", () => ({ readJob: mocks.read }));
vi.mock("./youtube-tracking.js", () => ({ trackingView: mocks.tracking }));
vi.mock("./identity.js", () => ({ allowance: mocks.allowance }));
vi.mock("@google/genai", () => ({ GoogleGenAI: class { interactions = { create: mocks.generate }; } }));
import { answerLiftoff, liftoffEvidence, liftoffRoutes } from "./liftoff-chat.js";

const first = "10000000-0000-4000-8000-000000000001";
const second = "10000000-0000-4000-8000-000000000002";
function tracking(views: number | null): YouTubeTrackingView {
  return { configured: true, connection: { jobId: first, videoId: "abcdefghijk", trackingId: first, linkedAt: "2026-09-29" },
    snapshots: [{ checkedAt: "2026-09-29T12:00:00Z", counts: { views, likes: null, comments: 0 } }] };
}
beforeEach(() => {
  vi.resetAllMocks(); vi.stubEnv("GEMINI_API_KEY", "test-only-key");
  mocks.read.mockImplementation(async (id) => ({ id, status: "succeeded", input: { appName: "Focus", hook: `Hook ${id}`, demoCaption: "One small task" }, creatorUrl: "SECRET_MEDIA_URL" }));
  mocks.tracking.mockResolvedValue(tracking(1200));
  mocks.generate.mockResolvedValue({ status: "completed", output_text: "Your focus video has 1,200 recorded views." });
});
describe("Liftoff performance and agent (no live calls)", () => {
  it("ranks numeric views first, preserves zero, and does not invent counts after a failed check", () => {
    const stale = tracking(1200); stale.snapshots.push({ checkedAt: "2026-09-29T13:00:00Z", counts: null, issue: "Unavailable" });
    const items = ["missing", "zero", "top"].map((jobId) => ({ rendered: { jobId } }));
    expect(rankedLiftoff(items, { top: stale, zero: tracking(0), missing: tracking(null) }).map((item) => item.rendered.jobId)).toEqual(["top", "zero", "missing"]);
    expect(latestViewSnapshot({ ...stale, connection: null })).toBeUndefined();
    expect(latestViewSnapshot(stale)?.checkedAt).toBe("2026-09-29T12:00:00Z");
  });
  it("loads owned server evidence, deduplicates IDs, and excludes video URLs and provider errors", async () => {
    const stale = tracking(1200); stale.snapshots.push({ checkedAt: "2026-09-29T13:00:00Z", counts: null, issue: "PRIVATE_PROVIDER_DETAIL" });
    mocks.tracking.mockResolvedValueOnce(tracking(0)).mockResolvedValueOnce(stale);
    const evidence = await liftoffEvidence([first, second, first]);
    expect(evidence.map((item) => item.jobId)).toEqual([second, first]);
    expect(evidence[0]).toMatchObject({ counts: { views: 1200 }, lastCheckFailed: true });
    expect(mocks.read).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(evidence)).not.toMatch(/SECRET_MEDIA_URL|PRIVATE_PROVIDER_DETAIL/);
  });
  it("rejects inaccessible jobs before sending anything to Gemini", async () => {
    mocks.read.mockResolvedValue(null);
    await expect(answerLiftoff({ jobIds: [first], messages: [{ role: "user", text: "Which wins?" }] })).rejects.toThrow("unavailable");
    expect(mocks.generate).not.toHaveBeenCalled();
  });
  it("uses current stored counts for every question with Gemini storage disabled", async () => {
    await answerLiftoff({ jobIds: [first], messages: [{ role: "assistant", text: "I previously said 999999 views" }, { role: "user", text: "Which wins?" }] });
    const request = mocks.generate.mock.calls[0][0];
    expect(request.store).toBe(false);
    expect(JSON.parse(request.input).videos[0].counts.views).toBe(1200);
    expect(request.system_instruction).toContain("not unique people");
    mocks.tracking.mockResolvedValue({ configured: true, connection: null, snapshots: [] });
    await answerLiftoff({ jobIds: [first], messages: [{ role: "user", text: "And now?" }] });
    expect(JSON.parse(mocks.generate.mock.calls[1][0].input).videos[0].counts).toBeNull();
  });
  it("handles an empty Liftoff without making a model call", async () => {
    expect((await answerLiftoff({ jobIds: [], messages: [{ role: "user", text: "Hello" }] })).answer).toContain("connect");
    expect(mocks.generate).not.toHaveBeenCalled();
  });
  it("validates inputs and hides provider failures", async () => {
    const app = new Hono().route("/", liftoffRoutes);
    const request = (body: unknown) => app.request("/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    expect((await request({ jobIds: ["bad-id"], messages: [] })).status).toBe(400);
    mocks.generate.mockRejectedValue(new Error("SECRET_PROVIDER_RESPONSE"));
    const response = await request({ jobIds: [first], messages: [{ role: "user", text: "Hi" }] });
    expect(response.status).toBe(503); expect(await response.text()).not.toContain("SECRET_PROVIDER");
  });
});
