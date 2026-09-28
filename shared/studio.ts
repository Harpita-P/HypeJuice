import { z } from "zod";
import { AppBriefSchema } from "./app-brief";
import { PostCopySchema, type PostCopy } from "./post-copy";

export const StudioVideoInputSchema = z.object({
  id: z.uuid(),
  appName: z.string().trim().min(1).max(200),
  brief: AppBriefSchema.optional(),
  profileKey: z.string().min(1).max(600),
  clipId: z.string().min(1).max(200),
  uploadId: z.uuid().optional(),
  reuseJobId: z.uuid().optional(),
  creatorId: z.string().min(1).max(100).optional(),
  savedCreatorJobId: z.uuid().optional(),
  post: PostCopySchema.optional(),
  prompt: z.string().trim().min(10).max(2000),
  hook: z.string().trim().min(1).max(180),
  demoCaption: z.string().trim().min(1).max(180),
  demoSeconds: z.number().min(1).max(10),
  hookSeconds: z.union([z.literal(3), z.literal(4), z.literal(5)]).optional(),
  clampDemoDuration: z.boolean().optional(),
  demoTextPosition: z.enum(["top", "middle", "bottom"]).default("top"),
  approved: z.literal(true),
}).refine((value) => Boolean(value.uploadId) !== Boolean(value.reuseJobId), "Supply either a demo upload or a previous render to reuse.")
  .refine((value) => [value.creatorId, value.savedCreatorJobId, value.reuseJobId].filter(Boolean).length <= 1, "Choose only one source of saved creator footage.")
  .refine((value) => value.savedCreatorJobId !== value.id, "A video cannot depend on itself.");
export type StudioVideoInput = z.infer<typeof StudioVideoInputSchema>;
export type StudioJobStatus = "queued" | "writing_post" | "submitting_creator" | "generating" | "assembling_local" | "submitting_render" | "rendering" | "saving" | "succeeded" | "failed";
export type StudioJob = {
  id: string; input: StudioVideoInput; status: StudioJobStatus; createdAt: string;
  error?: string; videoUrl?: string; canReuse: boolean;
  origin?: DiscoverOrigin;
  post?: PostCopy;
  footageKey?: string;
};
export type DiscoverOrigin = { type: "discover"; purpose?: "taste" | "discover"; batchId: string; batchNumber: number; index: number; title: string; audience: string; creatorId: string; styleTags?: string[]; formatId?: string };
export const CREATOR_HOOK_SECONDS = 3;
// Seedance 2.0's documented API minimum is four seconds; final hooks are trimmed.
export const CREATOR_GENERATION_SECONDS = 4;
export type StudioConfig = { ready: boolean; missing: string[]; model: string };
export const STUDIO_MODEL = "bytedance/seedance-2.0/text-to-video";
