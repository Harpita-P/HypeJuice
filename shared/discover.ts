import { z } from "zod";
import { AppBriefSchema } from "./app-brief";
import type { StudioJob } from "./studio";
import type { ContentConcept } from "./content";
import { PostCopySchema } from "./post-copy";
import { UGC_FORMATS, formatCategory } from "./ugc-formats";

export const DISCOVER_SIZE = 5;
export function pendingDiscoverItems(items: ContentConcept[]) {
  return items.filter((item) => item.collection === "discover" && item.rendered && item.status === "pending" && !item.ignored)
    .sort((a, b) => a.batch - b.batch || (a.discoverOrigin?.index ?? 0) - (b.discoverOrigin?.index ?? 0));
}
export type BatchPurpose = "taste" | "discover";
export const contentBatchSize = (purpose?: BatchPurpose) => purpose === "taste" ? 3 : DISCOVER_SIZE;
export const DiscoverRequestSchema = z.object({
  id: z.uuid(), profileKey: z.string().min(1).max(600), brief: AppBriefSchema,
  purpose: z.enum(["taste", "discover"]).optional(),
  // Identifies a single app-analysis/onboarding run, not the reusable app URL.
  onboardingId: z.string().min(1).max(100).optional(),
  demos: z.array(z.object({
    clipId: z.string().min(1).max(200), uploadId: z.uuid(),
    shows: z.string().trim().min(1).max(600),
    durationMs: z.number().min(1000).nullable(),
  })).min(1).max(4),
  approved: z.literal(true),
}).refine((value) => new Set(value.demos.map((demo) => demo.clipId)).size === value.demos.length, "Each demo clip must be distinct.");
export type DiscoverRequest = z.infer<typeof DiscoverRequestSchema>;
export type DiscoverConfig = { ready: boolean; missing: string[]; creatorCount: number };
export type DiscoverBatch = {
  id: string; profileKey: string; number: number; createdAt: string;
  purpose?: BatchPurpose;
  onboardingId?: string;
  status: "queued" | "writing" | "rendering" | "succeeded" | "failed";
  jobs: StudioJob[]; error?: string;
};
export function restorableContentBatches(batches: DiscoverBatch[], purpose: BatchPurpose, onboardingId: string) {
  return batches.filter((batch) => (batch.purpose ?? "discover") === purpose
    && (purpose !== "taste" || batch.onboardingId === onboardingId));
}
export const DiscoverCaptionSchema = z.object({
  title: z.string().trim().min(1).max(60),
  audience: z.string().trim().min(1).max(80),
  hook: z.string().trim().min(1).max(65),
  demoCaption: z.string().trim().min(1).max(90),
  styleTags: z.array(z.string().trim().min(1).max(40)).min(1).max(3).optional(),
  // Optional when reading legacy batches; required for all new AI responses below.
  post: PostCopySchema.optional(),
  formatId: z.enum(UGC_FORMATS.map((format) => format.id)).optional(),
});
export type DiscoverCaption = z.infer<typeof DiscoverCaptionSchema>;
export const GeneratedCaptionSchema = DiscoverCaptionSchema.extend({
  post: PostCopySchema,
  formatId: z.enum(UGC_FORMATS.map((format) => format.id)),
});
export function validateGeneratedCaptions(value: unknown, previous: Pick<DiscoverCaption, "hook" | "demoCaption">[], count: number) {
  const captions = z.array(GeneratedCaptionSchema).length(count).parse(value);
  if (new Set(captions.map((caption) => caption.formatId)).size !== count) throw new Error("Choose distinct story formats within this batch.");
  if (new Set(captions.map((caption) => formatCategory(caption.formatId))).size < Math.min(3, count)) throw new Error("Explore at least three story categories in this batch.");
  validateDiscoverCaptions(captions, previous, count);
  return captions;
}

export function captionKey(text: string) {
  return text.normalize("NFKC").toLowerCase().replace(/[’‘]/g, "'").replace(/[^\p{L}\p{N}\s]/gu, "").replace(/\s+/g, " ").trim();
}
function tooSimilar(a: string, b: string) {
  if (a === b) return true;
  const one = new Set(a.split(" ")); const two = new Set(b.split(" "));
  const intersection = [...one].filter((word) => two.has(word)).length;
  return intersection / new Set([...one, ...two]).size >= 0.85;
}
export function validateDiscoverCaptions(value: unknown, previous: Pick<DiscoverCaption, "hook" | "demoCaption">[], count = DISCOVER_SIZE) {
  const result = z.array(DiscoverCaptionSchema).length(count).parse(value);
  const used = previous.flatMap((entry) => [captionKey(entry.hook), captionKey(entry.demoCaption)]);
  for (const entry of result) {
    for (const [field, maxWords] of [["hook", 9], ["demoCaption", 12]] as const) {
      const text = entry[field];
      if (text.split(/\s+/).length > maxWords) throw new Error("Keep hooks to 9 words and demo captions to 12 words.");
      if (!/\b(i|me|my|mine|we|us|our|ours)\b/i.test(text)) throw new Error("Both captions must use first-person language.");
      const key = captionKey(text);
      if (used.some((old) => tooSimilar(key, old))) throw new Error("Captions repeat a previous idea too closely. Write distinct new wording.");
      used.push(key);
    }
  }
  return result;
}
