import { describe, expect, it } from "vitest";
import { creatorPreviewTags, CreatorIdeaSchema, type CreatorClip } from "../shared/creator-library.js";

describe("Creator gallery tag overlays", () => {
  const clip: CreatorClip = { id: "coast", name: "Coastal escape", description: "Coastal selfie", seconds: 4, tagSource: "prompt",
    tags: { emotion: ["relaxed", "pleased"], gender: ["man"], context: ["travel", "hiking"], actions: ["smiling"], appearance: [], style: ["candid"] } };
  it("shows four concise tags across categories, not the clip name", () => {
    expect(creatorPreviewTags(clip)).toEqual(["relaxed", "man", "travel", "smiling"]);
  });
  it("handles missing/empty legacy categories without crashing or duplicate pills", () => {
    expect(creatorPreviewTags({ ...clip, tags: {} as CreatorClip["tags"] })).toEqual([]);
    expect(creatorPreviewTags({ ...clip, tags: { ...clip.tags, gender: [], context: ["relaxed"], actions: [] } })).toEqual(["relaxed", "pleased", "candid"]);
  });
});

describe("Creative angle audience and vibe labels", () => {
  const idea = { id: "20000000-0000-4000-8000-000000000001", clipId: "demo", angle: "Internal label", hook: "my little reset", demoCaption: "i start one task", post: { caption: "my focus reset", hashtags: ["#Focus"] } };
  it("retains concise labels while accepting older saved ideas without them", () => {
    expect(CreatorIdeaSchema.parse(idea).audience).toBeUndefined();
    const labeled = CreatorIdeaSchema.parse({ ...idea, audience: "Students", vibes: ["Funny", "Relatable"] });
    expect(labeled.audience).toBe("Students");
    expect(labeled.vibes).toEqual(["Funny", "Relatable"]);
  });
  it("rejects empty or oversized pill labels", () => {
    expect(CreatorIdeaSchema.safeParse({ ...idea, audience: " " }).success).toBe(false);
    expect(CreatorIdeaSchema.safeParse({ ...idea, audience: "x".repeat(41) }).success).toBe(false);
    expect(CreatorIdeaSchema.safeParse({ ...idea, vibes: [" "] }).success).toBe(false);
    expect(CreatorIdeaSchema.safeParse({ ...idea, vibes: ["Funny", "Candid", "Relatable", "Emotional"] }).success).toBe(false);
  });
});
