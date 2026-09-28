import { z } from "zod";
import type { ContentConcept } from "./content";

export const FeedbackRequestSchema = z.object({
  profileKey: z.string().min(1).max(600), jobId: z.uuid(),
  verdict: z.enum(["loved", "tossed", "pending"]),
});
export type FeedbackRequest = z.infer<typeof FeedbackRequestSchema>;
export type CaptionFeedback = FeedbackRequest & {
  hook: string; demoCaption: string; title: string; audience: string; styleTags: string[]; updatedAt: string;
  formatId?: string;
};
export type CaptionTasteMemory = { liked: CaptionFeedback[]; disliked: CaptionFeedback[]; totalRatings: number };

export function buildCaptionTasteMemory(ratings: CaptionFeedback[]): CaptionTasteMemory {
  const ordered = [...ratings].sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
  return { liked: ordered.filter((rating) => rating.verdict === "loved").slice(-30),
    disliked: ordered.filter((rating) => rating.verdict === "tossed").slice(-30),
    totalRatings: ordered.filter((rating) => rating.verdict !== "pending").length };
}

// Taste feedback keeps/removes a Library entry; bookmarks and launch choices are independent.
export function applyCaptionFeedback(items: ContentConcept[], ratings: CaptionFeedback[]): ContentConcept[] {
  const byJob = new Map(ratings.map((rating) => [rating.jobId, rating]));
  return items.map((item) => {
    const rating = item.rendered && byJob.get(item.rendered.jobId);
    return rating ? { ...item, status: rating.verdict, ignored: rating.verdict === "tossed" } : item;
  });
}
export function tasteReviewComplete(items: ContentConcept[], feedbackReady: boolean, saving: boolean): boolean {
  return feedbackReady && !saving && items.length === 3 && items.every((item) => Boolean(item.rendered) && item.status !== "pending");
}
