import { z } from "zod";

// Platform copy is metadata, never part of the burned-in video overlays.
export const POST_CAPTION_MAX_WORDS = 15;
export const PostCopySchema = z.object({
  caption: z.string().trim().min(1).max(500)
    .refine((text) => text.split(/\s+/u).length <= POST_CAPTION_MAX_WORDS, `Keep post captions to ${POST_CAPTION_MAX_WORDS} words or fewer.`)
    .refine((text) => !text.normalize("NFKC").includes("#"), "Keep hashtags in the separate hashtag list.")
    .describe("Platform post caption: at most 15 whitespace-separated words, no hashtags."),
  hashtags: z.array(z.string().trim().regex(/^#[\p{L}\p{N}_]+$/u).max(60)).min(1).max(5)
    .refine((tags) => new Set(tags.map((tag) => tag.normalize("NFKC").toLowerCase())).size === tags.length, "Use distinct hashtags."),
});
export type PostCopy = z.infer<typeof PostCopySchema>;

export const POST_COPY_INSTRUCTIONS = `Also write a separate platform post: caption is a short natural first-person Gen-Z UGC caption, at most ${POST_CAPTION_MAX_WORDS} words total (and at most 500 characters). This is a hard word limit, not a target. Complement the video rather than repeating both overlays. No hashtags in caption; the separate hashtags do not count toward the caption word limit. hashtags is a separate array of 1–5 DISTINCT hashtags, each starting with #, using only letters, numbers, underscores. Choose relevant app-category, use-case, audience or theme keywords. No generic reach bait (#fyp, #viral), unrelated trends, fabricated claims, guarantees, or keyword stuffing. This is draft copy, not evidence of a real customer's experience.`;
