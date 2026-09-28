import { z } from "zod";
import { PostCopySchema } from "./post-copy";

export const YouTubeUploadSchema = z.object({
  id: z.uuid(), jobId: z.uuid(), profileKey: z.string().min(1).max(600), connectionId: z.uuid(),
  title: z.string().trim().min(1).max(100).refine((text) => !/[<>]/.test(text), "YouTube titles cannot contain < or >."),
  post: PostCopySchema.refine((post) => !/[<>]/.test(post.caption), "YouTube descriptions cannot contain < or >."),
  mode: z.enum(["private", "schedule"]),
  publishAt: z.iso.datetime().optional(), timezone: z.string().min(1).max(100),
  madeForKids: z.boolean(), containsSyntheticMedia: z.boolean(), approved: z.literal(true),
}).refine((value) => value.mode === "schedule" ? Boolean(value.publishAt) : !value.publishAt,
  "A scheduled upload needs a publish date; a private test must not include one.");
export type YouTubeUploadInput = z.infer<typeof YouTubeUploadSchema>;
export type YouTubeConnection = { id: string; channelId: string; channelTitle: string };
export type YouTubeConfig = { ready: boolean; missing: string[]; connectUrl: string; schedulingEnabled: boolean; connection: YouTubeConnection | null };
export type YouTubeUpload = {
  id: string; jobId: string; profileKey: string; title: string; post: z.infer<typeof PostCopySchema>;
  mode: "private" | "schedule"; publishAt?: string; timezone: string; channelTitle: string;
  status: "queued" | "uploading" | "interrupted" | "needs_review" | "uploaded_private" | "scheduled" | "published" | "failed";
  createdAt: string; videoId?: string; error?: string; processingStatus?: string;
};

export function youtubeMetadata(input: YouTubeUploadInput, schedulingEnabled: boolean, now = Date.now()) {
  if (input.mode === "schedule" && !schedulingEnabled) throw new Error("Public scheduling is disabled. Use a private test upload until your YouTube API project is audited.");
  if (input.mode === "schedule" && (!input.publishAt || Date.parse(input.publishAt) < now + 10 * 60_000)) throw new Error("Choose a publish time at least 10 minutes from now.");
  return {
    snippet: { title: input.title, description: `${input.post.caption}\n\n${input.post.hashtags.join(" ")}`, categoryId: "22" },
    status: { privacyStatus: "private", selfDeclaredMadeForKids: input.madeForKids,
      containsSyntheticMedia: input.containsSyntheticMedia,
      ...(input.mode === "schedule" ? { publishAt: input.publishAt } : {}) },
  };
}

// The picker uses the device's local timezone; reject DST gaps rather than silently shifting a time.
export function localPublishTime(date: string, time: string, now = Date.now()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error("Use YYYY-MM-DD and HH:MM (24-hour time).");
  const value = new Date(`${date}T${time}:00`);
  const [year, month, day] = date.split("-").map(Number);
  if (!Number.isFinite(value.getTime()) || value.getFullYear() !== year || value.getMonth() + 1 !== month || value.getDate() !== day || value.getHours() !== Number(time.slice(0, 2)) || value.getMinutes() !== Number(time.slice(3))) throw new Error("This date/time does not exist in your device timezone.");
  // Repeated fall-back times are ambiguous; ask for a time outside that transition.
  for (const minutes of [30, 60, 90, 120]) {
    const later = new Date(value.getTime() + minutes * 60_000);
    if (later.getFullYear() === year && later.getMonth() + 1 === month && later.getDate() === day && later.getHours() === value.getHours() && later.getMinutes() === value.getMinutes()) throw new Error("This time occurs twice during a daylight-saving change. Choose another time.");
  }
  if (value.getTime() < now + 10 * 60_000) throw new Error("Choose a publish time at least 10 minutes from now.");
  return value.toISOString();
}
