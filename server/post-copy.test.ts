import { describe, expect, it } from "vitest";
import { z } from "zod";
import { PostCopySchema } from "../shared/post-copy.js";
import { GeneratedCaptionSchema, validateGeneratedCaptions } from "../shared/discover.js";
import { UGC_FORMATS, prioritizedFormats } from "../shared/ugc-formats.js";

const post = { caption: "my tiny reset between study sessions", hashtags: ["#Focus", "#StudyRoutine", "#Productivity"] };
const examples = [
  { title: "Curious", audience: "Students", hook: "why am i just finding this timer", demoCaption: "i pick a task and start my timer", formatId: "ugc-01", post },
  { title: "Skeptic", audience: "Students", hook: "i said no more study apps", demoCaption: "my task gets a little focus window", formatId: "ugc-16", post },
  { title: "Chaos", audience: "Students", hook: "me avoiding that one tiny task again", demoCaption: "we start small instead of planning forever", formatId: "ugc-27", post },
];
describe("platform copy and reusable format library", () => {
  it("validates separate post copy and no more than five distinct relevant-shaped tags", () => {
    expect(PostCopySchema.parse(post)).toEqual(post);
    for (const hashtags of [[], ["#Focus", "#FOCUS"], ["#focus", "#ｆｏｃｕｓ"], ["not-a-tag"], ["#two words"], ["#a", "#b", "#c", "#d", "#e", "#f"]]) {
      expect(PostCopySchema.safeParse({ ...post, hashtags }).success).toBe(false);
    }
    expect(PostCopySchema.safeParse({ ...post, caption: "my routine #hidden" }).success).toBe(false);
    expect(PostCopySchema.safeParse({ ...post, caption: "a".repeat(501) }).success).toBe(false);
    expect(PostCopySchema.safeParse({ ...post, hashtags: ["#習慣", "#Study_Routine"] }).success).toBe(true);
  });
  it("keeps all 80 stable patterns and prioritizes less-used categories and patterns", () => {
    expect(UGC_FORMATS).toHaveLength(80);
    expect(new Set(UGC_FORMATS.map((format) => format.id)).size).toBe(80);
    expect(new Set(UGC_FORMATS.map((format) => format.category)).size).toBe(8);
    const ordered = prioritizedFormats(["ugc-01", "ugc-01", "ugc-02"]);
    expect(ordered[0].category).not.toBe("discovery");
    expect(ordered.at(-1)?.id).toBe("ugc-01");
  });
  it("enforces the 15-word post limit separately from hashtags, including mixed whitespace", () => {
    const fifteen = "my tiny study reset is just one task one timer and a quieter afternoon today";
    expect(PostCopySchema.safeParse({ ...post, caption: fifteen }).success).toBe(true);
    expect(PostCopySchema.safeParse({ ...post, caption: `  ${fifteen.replaceAll(" ", " \n\t ")}  ` }).success).toBe(true);
    expect(() => PostCopySchema.parse({ ...post, caption: fifteen + " again" })).toThrow("15 words");
    expect(() => validateGeneratedCaptions([{ ...examples[0], post: { ...post, caption: fifteen + " again" } }, ...examples.slice(1)], [], 3)).toThrow("15 words");
  });
  it("requires post copy and varied valid formats on new output without changing overlay rules", () => {
    expect(validateGeneratedCaptions(examples, [], 3)).toHaveLength(3);
    expect(() => validateGeneratedCaptions([{ ...examples[0], post: undefined }, ...examples.slice(1)], [], 3)).toThrow();
    expect(() => validateGeneratedCaptions([{ ...examples[0], formatId: "made-up" }, ...examples.slice(1)], [], 3)).toThrow();
    expect(() => validateGeneratedCaptions(examples.map((entry) => ({ ...entry, formatId: "ugc-01" })), [], 3)).toThrow("distinct story");
    expect(() => validateGeneratedCaptions(examples.map((entry, index) => ({ ...entry, formatId: `ugc-0${index + 1}` })), [], 3)).toThrow("three story");
    expect(() => validateGeneratedCaptions(examples, [examples[0]], 3)).toThrow("repeat");
    // Structured-output schemas must serialize despite runtime-only uniqueness refinements.
    expect(z.toJSONSchema(GeneratedCaptionSchema).required).toContain("post");
  });
});
