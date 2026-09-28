import { z } from "zod";

export const TRACKING_RETENTION_MS = 28 * 24 * 60 * 60 * 1000;
export const TRACKING_INTERVAL_MS = 60 * 60 * 1000;
export type YouTubeCounts = { views: number | null; likes: number | null; comments: number | null };
export type YouTubeSnapshot = { checkedAt: string; counts: YouTubeCounts | null; title?: string; channel?: string; issue?: string };
export type YouTubeTracking = { jobId: string; trackingId: string; videoId: string; linkedAt: string };
export type YouTubeTrackingView = { connection: YouTubeTracking | null; snapshots: YouTubeSnapshot[]; configured: boolean };
export const TrackYouTubeSchema = z.object({ url: z.string().trim().max(2000), confirmed: z.literal(true) });

// Parse only known YouTube URLs. Never fetch a user-supplied URL or follow its redirects.
export function youtubeVideoId(input: string) {
  let url: URL;
  try { url = new URL(input.trim()); } catch { throw new Error("Paste a full YouTube video link."); }
  if (!["https:", "http:"].includes(url.protocol) || url.username || url.password || url.port) throw new Error("Use a standard YouTube video link.");
  const host = url.hostname.toLowerCase();
  let id: string | null = null;
  if (host === "youtu.be") id = /^\/([^/]+)\/?$/.exec(url.pathname)?.[1] ?? null;
  else if (["youtube.com", "www.youtube.com", "m.youtube.com"].includes(host)) {
    if (url.pathname === "/watch") id = url.searchParams.get("v");
    else id = /^\/(?:shorts|embed|live)\/([^/]+)\/?$/.exec(url.pathname)?.[1] ?? null;
  }
  if (!id || !/^[A-Za-z0-9_-]{11}$/.test(id)) throw new Error("Use a YouTube Shorts, watch, or share link—not a channel link.");
  return id;
}

export function retainedSnapshots(samples: YouTubeSnapshot[], now = Date.now()) {
  return samples.filter((sample) => Date.parse(sample.checkedAt) > now - TRACKING_RETENTION_MS && Date.parse(sample.checkedAt) <= now)
    .sort((a, b) => Date.parse(a.checkedAt) - Date.parse(b.checkedAt));
}
