import { z } from "zod";
import { AppBriefSchema } from "./app-brief";
import { MAX_DEMO_CLIPS } from "./creative-profile";
import { PostCopySchema } from "./post-copy";

export const CreatorTagsSchema = z.object({ emotion: z.array(z.string()).default([]), gender: z.array(z.string()).default([]), context: z.array(z.string()).default([]), actions: z.array(z.string()).default([]), appearance: z.array(z.string()).default([]), style: z.array(z.string()).default([]) });
export type CreatorTags = z.infer<typeof CreatorTagsSchema>;
export type CreatorClip = { id: string; name: string; description: string; tags: CreatorTags; sourcePrompt?: string; tagSource: "prompt" | "reviewed" | "unspecified"; seconds: 4; previewUrl?: string };
export type CreatorCatalog = { creators: CreatorClip[]; ready: boolean; missing: string[] };
export const CreatorIdeaRequestSchema = z.object({
  id: z.uuid(), profileKey: z.string().min(1).max(600), brief: AppBriefSchema,
  creatorId: z.string().max(100).optional(), description: z.string().trim().max(1500).default(""),
  tone: z.string().trim().max(200).default("candid, lightly funny"), count: z.number().int().min(1).max(3),
  mode: z.enum(["agent", "manual"]), hook: z.string().trim().max(180).default(""), demoCaption: z.string().trim().max(180).default(""),
  demos: z.array(z.object({ clipId: z.string().min(1).max(200), shows: z.string().trim().min(1).max(600), durationMs: z.number().min(1000).nullable() })).min(1).max(MAX_DEMO_CLIPS),
}).refine((input) => Boolean(input.creatorId) !== Boolean(input.description.trim()), "Choose a library creator OR describe a new creator.")
  .refine((input) => input.mode !== "manual" || Boolean(input.hook && input.demoCaption), "Write both captions.");
export type CreatorIdeaRequest = z.infer<typeof CreatorIdeaRequestSchema>;
// Optional for older saved requests; new ideas always generate both fields.
export const CreatorIdeaAudienceSchema = z.string().trim().min(1).max(40);
export const CreatorIdeaVibesSchema = z.array(z.string().trim().min(1).max(24)).min(1).max(3);
export const CreatorIdeaSchema = z.object({ id: z.uuid(), creatorId: z.string().optional(), clipId: z.string(), angle: z.string().min(1).max(100), audience: CreatorIdeaAudienceSchema.optional(), vibes: CreatorIdeaVibesSchema.optional(), hook: z.string().min(1).max(180), demoCaption: z.string().min(1).max(180), post: PostCopySchema });
export type CreatorIdea = z.infer<typeof CreatorIdeaSchema>;
export type CreatorIdeas = { id: string; ideas: CreatorIdea[]; message: string };

export function creatorTagValues(clip: CreatorClip): string[] {
  return [...new Set(Object.values(clip.tags ?? {}).flatMap((values) => Array.isArray(values) ? values.filter((value): value is string => typeof value === "string" && Boolean(value.trim())) : []))];
}
// Show a useful mix rather than filling the tile with only emotion synonyms.
export function creatorPreviewTags(clip: CreatorClip): string[] {
  const highlights = [clip.tags?.emotion?.[0], clip.tags?.gender?.[0], clip.tags?.context?.[0], clip.tags?.actions?.[0]];
  return [...new Set([...highlights, ...creatorTagValues(clip)].filter((tag): tag is string => typeof tag === "string" && Boolean(tag.trim())))].slice(0, 4);
}
export function matchesCreator(clip: CreatorClip, query: string, category?: keyof CreatorTags, tag?: string) {
  const text = [clip.name, clip.description, ...creatorTagValues(clip)].join(" ").toLowerCase();
  return query.toLowerCase().trim().split(/\s+/).every((word) => text.includes(word)) && (!category || !tag || Boolean(clip.tags?.[category]?.includes(tag)));
}
