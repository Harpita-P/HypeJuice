import { z } from "zod";
import type { YouTubeTrackingView } from "./youtube-tracking";

export const LiftoffChatSchema = z.object({
  jobIds: z.array(z.uuid()).max(100),
  messages: z.array(z.object({ role: z.enum(["user", "assistant"]), text: z.string().trim().min(1).max(2400) })).min(1).max(12),
}).refine((input) => input.messages.at(-1)?.role === "user", "Ask a question first.");
export type LiftoffChatInput = z.infer<typeof LiftoffChatSchema>;
export type LiftoffChatReply = { answer: string; checkedAt: string };

/** Missing views are unknown, never zero. Keep the last successful observation after a failed check. */
export function latestViewSnapshot(data?: YouTubeTrackingView | null) {
  if (!data?.connection) return undefined;
  return [...data.snapshots].reverse().find((sample) => sample.counts?.views != null);
}
export function rankedLiftoff<T extends { rendered?: { jobId: string } }>(items: T[], metrics: Record<string, YouTubeTrackingView>) {
  return [...items].sort((a, b) => {
    const views = (item: T) => latestViewSnapshot(metrics[item.rendered?.jobId ?? ""])?.counts?.views ?? -1;
    return views(b) - views(a);
  });
}
