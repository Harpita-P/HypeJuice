import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { youtubeVideoId, retainedSnapshots, TRACKING_RETENTION_MS } from "../shared/youtube-tracking.js";
import { connectTracking, disconnectTracking, refreshTracking, trackingView, youtubeStats } from "./youtube-tracking.js";
import { saveRecord } from "./records.js";
import { app } from "./app.js";

let directory: string;
const jobId = "40000000-0000-4000-8000-000000000001";
const videoId = "abcdefghijk";
const link = `https://youtube.com/shorts/${videoId}`;
const youtubeResponse = (stats: Record<string, string> = { viewCount: "1234", likeCount: "31", commentCount: "0" }) => Response.json({ items: [{ id: videoId, status: { privacyStatus: "public" }, snippet: { title: "My post", channelTitle: "My channel" }, statistics: stats }] });
beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "growthbanana-yt-tracking-"));
  vi.stubEnv("AUTH_MODE", "local"); vi.stubEnv("NODE_ENV", "test"); vi.stubEnv("STUDIO_DATA_DIR", directory); vi.stubEnv("YOUTUBE_DATA_API_KEY", "test-only-key");
  await saveRecord(`${jobId}.json`, { id: jobId, status: "succeeded" });
});
afterEach(async () => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.useRealTimers(); await rm(directory, { recursive: true, force: true }); });

describe("YouTube link tracking (mocked API, no real requests)", () => {
  it("accepts Shorts/watch/share links and rejects lookalikes, arbitrary hosts, credentials and invalid IDs", () => {
    for (const url of [link, `https://youtu.be/${videoId}?si=x`, `https://www.youtube.com/watch?v=${videoId}&t=2`, `https://m.youtube.com/shorts/${videoId}`]) expect(youtubeVideoId(url)).toBe(videoId);
    for (const url of ["https://youtube.com.evil.test/shorts/abcdefghijk", "http://localhost/watch?v=abcdefghijk", "https://evil@youtube.com/watch?v=abcdefghijk", "https://youtube.com/@channel", "https://youtube.com/shorts/no", "javascript:alert(1)"]) expect(() => youtubeVideoId(url)).toThrow();
  });
  it("preserves zero vs unavailable counts; sends only an ID to the fixed Google endpoint", async () => {
    const fetcher = vi.fn().mockResolvedValue(youtubeResponse({ viewCount: "0" })); vi.stubGlobal("fetch", fetcher);
    expect((await youtubeStats(videoId)).counts).toEqual({ views: 0, likes: null, comments: null });
    const [url, options] = fetcher.mock.calls[0]; expect(url.origin).toBe("https://www.googleapis.com"); expect(url.searchParams.get("id")).toBe(videoId);
    expect(url.search).not.toContain("test-only-key"); expect(options.redirect).toBe("error");
  });
  it("stores a durable link and real hourly observations; caches automatic checks and deletes on disconnect", async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-09-28T10:05:00Z"));
    const fetcher = vi.fn().mockImplementation(async () => youtubeResponse()); vi.stubGlobal("fetch", fetcher);
    const connected = await connectTracking(jobId, link); expect(connected.snapshots).toHaveLength(1);
    await connectTracking(jobId, link); await refreshTracking(jobId, true); expect(fetcher).toHaveBeenCalledTimes(1);
    vi.setSystemTime(new Date("2026-09-28T11:06:00Z"));
    fetcher.mockResolvedValueOnce(youtubeResponse({ viewCount: "1600", likeCount: "45" }));
    const updated = await refreshTracking(jobId, true); expect(updated.snapshots).toHaveLength(2); expect(updated.snapshots[1].counts?.views).toBe(1600);
    expect((await trackingView(jobId)).connection?.videoId).toBe(videoId);
    await disconnectTracking(jobId); expect((await trackingView(jobId)).connection).toBeNull();
  });
  it("manual refresh checks YouTube immediately and advances the timestamp even when counts stay unchanged", async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-09-28T10:05:00Z"));
    const fetcher = vi.fn().mockImplementation(async () => youtubeResponse()); vi.stubGlobal("fetch", fetcher);
    const initial = await connectTracking(jobId, link);
    vi.setSystemTime(new Date("2026-09-28T10:05:10Z"));
    const refreshed = await refreshTracking(jobId);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(refreshed.snapshots).toHaveLength(1); // Same hourly chart slot, fresh observation.
    expect(refreshed.snapshots[0].counts).toEqual(initial.snapshots[0].counts);
    expect(refreshed.snapshots[0].checkedAt).toBe("2026-09-28T10:05:10.000Z");
    await refreshTracking(jobId, true); expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("rejects missing jobs before network access and doesn't overwrite an existing link", async () => {
    const fetcher = vi.fn().mockImplementation(async () => youtubeResponse()); vi.stubGlobal("fetch", fetcher);
    await expect(connectTracking("40000000-0000-4000-8000-000000000002", link)).rejects.toThrow("not found"); expect(fetcher).not.toHaveBeenCalled();
    await connectTracking(jobId, link);
    await expect(connectTracking(jobId, "https://youtu.be/12345678901")).rejects.toThrow("Disconnect");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("handles missing keys, private/deleted posts and quota errors without fake statistics or leaked provider errors", async () => {
    vi.stubEnv("YOUTUBE_DATA_API_KEY", ""); await expect(youtubeStats(videoId)).rejects.toThrow("YOUTUBE_DATA_API_KEY");
    vi.stubEnv("YOUTUBE_DATA_API_KEY", "test-only-key");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ items: [] }))); await expect(youtubeStats(videoId)).rejects.toThrow("not public");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("secret provider details", { status: 403 })));
    await expect(youtubeStats(videoId)).rejects.toThrow("quota");
  });
  it("retains previous history but shows a failed latest check as unavailable", async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-09-28T10:05:00Z"));
    const fetcher = vi.fn().mockResolvedValueOnce(youtubeResponse()).mockResolvedValueOnce(new Response("private details", { status: 500 })); vi.stubGlobal("fetch", fetcher);
    await connectTracking(jobId, link); vi.setSystemTime(new Date("2026-09-28T11:06:00Z"));
    const result = await refreshTracking(jobId); expect(result.snapshots).toHaveLength(2);
    expect(result.snapshots[1].counts).toBeNull(); expect(result.snapshots[1].issue).not.toContain("private details");
  });
  it("only exposes 28-day snapshots and validates route IDs/consent", async () => {
    const now = Date.now();
    expect(retainedSnapshots([{ checkedAt: new Date(now - TRACKING_RETENTION_MS - 1).toISOString(), counts: null }, { checkedAt: new Date(now).toISOString(), counts: null }], now)).toHaveLength(1);
    expect((await app.request("/api/youtube-tracking/invalid")).status).toBe(400);
    const result = await app.request(`/api/youtube-tracking/${jobId}/connect`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: link }) });
    expect(result.status).toBe(400);
  });
});
