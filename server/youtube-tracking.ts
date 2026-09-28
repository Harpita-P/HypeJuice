import { randomUUID } from "node:crypto";
import { z } from "zod";
import { readRecord, saveRecord, listRecords, deleteRecord } from "./records.js";
import { readJob } from "./studio-jobs.js";
import { allowance, ownedKey } from "./identity.js";
import { retainedSnapshots, TRACKING_INTERVAL_MS, youtubeVideoId, type YouTubeCounts, type YouTubeSnapshot, type YouTubeTracking, type YouTubeTrackingView } from "../shared/youtube-tracking.js";

const linkKey = (jobId: string) => `youtube-track-${z.uuid().parse(jobId)}.json`;
const samplePrefix = (trackingId: string) => `youtube-sample-${trackingId}-`;
export const trackingConfigured = () => Boolean(process.env.YOUTUBE_DATA_API_KEY && !/your_|placeholder/i.test(process.env.YOUTUBE_DATA_API_KEY));
export class TrackingError extends Error { constructor(message: string, public status: 400 | 404 | 409 | 429 | 503 = 400) { super(message); } }
async function ownedJob(jobId: string) {
  const job = await readJob(z.uuid().parse(jobId));
  if (!job || job.status !== "succeeded") throw new TrackingError("Finished video not found in this account.", 404);
}
export async function youtubeStats(videoId: string): Promise<YouTubeSnapshot> {
  if (!trackingConfigured()) throw new TrackingError("Add YOUTUBE_DATA_API_KEY to the server environment and restart the API. Enable YouTube Data API v3 for that key.", 503);
  const url = new URL("https://www.googleapis.com/youtube/v3/videos");
  url.search = new URLSearchParams({ id: videoId, part: "snippet,statistics,status", fields: "items(id,snippet(title,channelTitle),statistics(viewCount,likeCount,commentCount),status(privacyStatus))" }).toString();
  let response: Response;
  try { response = await fetch(url, { headers: { "X-Goog-Api-Key": process.env.YOUTUBE_DATA_API_KEY! }, redirect: "error", signal: AbortSignal.timeout(15000) }); }
  catch { throw new TrackingError("YouTube could not be reached. Try again shortly.", 503); }
  if (!response.ok) throw new TrackingError(response.status === 403 || response.status === 429 ? "YouTube access or quota is unavailable. Check the API key, API restrictions, and quota in Google Cloud." : "YouTube could not return metrics. Try again later.", 503);
  const data = await response.json(); const video = data.items?.[0];
  if (!video || video.status?.privacyStatus !== "public") throw new TrackingError("That video is unavailable or not public. Publish it publicly on YouTube, then try again.", 404);
  const count = (value: unknown) => typeof value === "string" && /^\d+$/.test(value) && Number.isSafeInteger(Number(value)) ? Number(value) : null;
  return { checkedAt: new Date().toISOString(), title: String(video.snippet?.title ?? "").slice(0, 200), channel: String(video.snippet?.channelTitle ?? "").slice(0, 200),
    counts: { views: count(video.statistics?.viewCount), likes: count(video.statistics?.likeCount), comments: count(video.statistics?.commentCount) } satisfies YouTubeCounts };
}
async function samples(connection: YouTubeTracking) {
  return retainedSnapshots(await listRecords<YouTubeSnapshot>((key) => key.startsWith(samplePrefix(connection.trackingId))));
}
async function saveSample(connection: YouTubeTracking, snapshot: YouTubeSnapshot) {
  // At most one observation per hour; timestamps are capture times, not publication times.
  const slot = Math.floor(Date.parse(snapshot.checkedAt) / TRACKING_INTERVAL_MS);
  await saveRecord(`${samplePrefix(connection.trackingId)}${slot}.json`, snapshot);
}
export async function trackingView(jobId: string): Promise<YouTubeTrackingView> {
  await ownedJob(jobId);
  const connection = await readRecord<YouTubeTracking>(linkKey(jobId));
  return { connection, snapshots: connection ? await samples(connection) : [], configured: trackingConfigured() };
}
const locks = new Map<string, Promise<unknown>>();
async function locked<T>(jobId: string, work: () => Promise<T>) {
  const key = ownedKey(`youtube:${jobId}`); const previous = locks.get(key) ?? Promise.resolve();
  const task = previous.catch(() => {}).then(work); locks.set(key, task);
  try { return await task; } finally { if (locks.get(key) === task) locks.delete(key); }
}
export async function connectTracking(jobId: string, inputUrl: string) {
  return locked(jobId, async () => {
    await ownedJob(jobId);
    let videoId: string;
    try { videoId = youtubeVideoId(inputUrl); } catch (error) { throw new TrackingError((error as Error).message); }
    const existing = await readRecord<YouTubeTracking>(linkKey(jobId));
    if (existing?.videoId === videoId) return trackingView(jobId);
    if (existing) throw new TrackingError("Disconnect the existing post before attaching another link.", 409);
    await allowance("youtube-connect", 20);
    const snapshot = await youtubeStats(videoId);
    const connection: YouTubeTracking = { jobId, videoId, trackingId: randomUUID(), linkedAt: new Date().toISOString() };
    const saved = await saveRecord(linkKey(jobId), connection, true);
    if (saved.trackingId !== connection.trackingId) return trackingView(jobId);
    await saveSample(connection, snapshot);
    return trackingView(jobId);
  });
}
export async function refreshTracking(jobId: string, automatic = false) {
  return locked(jobId, async () => {
    const current = await trackingView(jobId); const connection = current.connection;
    if (!connection) throw new TrackingError("Connect a YouTube post first.", 404);
    const last = current.snapshots.at(-1);
    // An explicit refresh is a new provider check, even if the counts haven't changed.
    // Only background polling uses the hourly cache; daily quota limits still apply.
    if (automatic && last && Date.now() - Date.parse(last.checkedAt) < TRACKING_INTERVAL_MS) return current;
    await allowance("youtube-refresh", 500);
    let snapshot: YouTubeSnapshot;
    try { snapshot = await youtubeStats(connection.videoId); }
    catch (error) {
      snapshot = { checkedAt: new Date().toISOString(), counts: null, issue: error instanceof TrackingError ? error.message : "YouTube metrics are temporarily unavailable." };
    }
    const stillConnected = await readRecord<YouTubeTracking>(linkKey(jobId));
    if (stillConnected?.trackingId !== connection.trackingId) return trackingView(jobId);
    await saveSample(connection, snapshot);
    return trackingView(jobId);
  });
}
export async function disconnectTracking(jobId: string) {
  return locked(jobId, async () => {
    await ownedJob(jobId); const current = await readRecord<YouTubeTracking>(linkKey(jobId));
    await deleteRecord(linkKey(jobId));
    if (current) {
      // Snapshots use independent records so a late refresh can never recreate a deleted connection.
      for (const sample of await listRecords<YouTubeSnapshot>((key) => key.startsWith(samplePrefix(current.trackingId)))) {
        await deleteRecord(`${samplePrefix(current.trackingId)}${Math.floor(Date.parse(sample.checkedAt) / TRACKING_INTERVAL_MS)}.json`);
      }
    }
    return { connection: null, snapshots: [], configured: trackingConfigured() } satisfies YouTubeTrackingView;
  });
}
