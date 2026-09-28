import { describe, expect, it } from "vitest";
import { AppBriefSchema, type DemoClip } from "../shared/app-brief.js";
import { normalizeFeedPreferences, profileReadiness, withAudienceStarters } from "../shared/creative-profile.js";
import { buildSourceDraft } from "./brief-generator.js";

const brief = buildSourceDraft([{ kind: "founder_note", title: "Founder context", url: null, text: "Focus Fox is a timer for distraction-free work." }]);
const clip: DemoClip = { id: "demo-1", name: "Demo.mov", storage: "device", localPath: "demo-clips/demo-1.mov", durationMs: 12000, sizeBytes: 1000, width: 390, height: 844, shows: "Start a focus session and see the timer", importedAt: "2026-09-27T00:00:00.000Z" };

describe("automatic feed onboarding", () => {
  it("backfills older brief suggestions and keeps the old focus among five initial picks", () => {
    const legacy = { ...brief, audiences: [{ segment: "Founders", situation: "Need focus" }, { segment: "Students", situation: "Need study time" }] };
    const upgraded = withAudienceStarters(legacy);
    const preferences = normalizeFeedPreferences(upgraded, { priorityAudienceIndex: 1, tones: ["Candid"], note: "No slang" });
    expect(upgraded.audiences.length).toBeGreaterThanOrEqual(5);
    expect(preferences.selectedAudiences).toHaveLength(5);
    expect(preferences.selectedAudiences).toContain("Students");
    expect(preferences.scope).toBe("automatic_feed");
    expect(preferences.tones).toEqual(["Candid"]);
  });

  it("preserves all selected audiences, unlimited tones, and exploration on reload", () => {
    const preferences = normalizeFeedPreferences(brief, { selectedAudiences: brief.audiences.map((audience) => audience.segment), exploreMoreAudiences: true, tones: ["Funny", "Candid", "Playful", "Warm", "Professional", "Academic"], note: "" });
    expect(preferences.selectedAudiences).toHaveLength(brief.audiences.length);
    expect(preferences.exploreMoreAudiences).toBe(true);
    expect(preferences.tones).toHaveLength(6);
    expect(AppBriefSchema.safeParse({ ...brief, tone: preferences.tones }).success).toBe(true);
    expect(profileReadiness(preferences, [clip])).toBeNull();
  });

  it("requires a described recording and five audiences; Surprise me is not a fake audience", () => {
    const preferences = normalizeFeedPreferences(brief, { selectedAudiences: [], exploreMoreAudiences: true, tones: ["Funny"], note: "" });
    expect(preferences.selectedAudiences).toEqual([]);
    expect(profileReadiness(preferences, [])).toContain("recording");
    expect(profileReadiness(preferences, [{ ...clip, shows: "" }])).toContain("what each demo clip shows");
    expect(profileReadiness(preferences, [clip])).toContain("at least 5");
  });

  it("allows four clips and treats ten seconds as guidance, not a duration cap", () => {
    const preferences = normalizeFeedPreferences(brief, { tones: ["Candid"], note: "" });
    expect(profileReadiness(preferences, Array.from({ length: 4 }, (_, index) => ({ ...clip, id: `clip-${index}`, durationMs: 20000 })))).toBeNull();
    expect(profileReadiness(preferences, Array.from({ length: 5 }, (_, index) => ({ ...clip, id: `clip-${index}` })))).toContain("up to 4");
  });
});
