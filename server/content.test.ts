import { describe, expect, it } from "vitest";
import { actOnContent, createDiscoverBatch, createStarterConcepts, createStudioConcept, editCaptions, planError, reviewConcept } from "../shared/content";
import type { BriefResponse } from "../shared/app-brief";
import { buildSourceDraft } from "./brief-generator";

const profile: BriefResponse = {
  analyzedAt: "2026-09-27T00:00:00Z", mode: "source_draft", sources: [], warnings: [],
  brief: buildSourceDraft([{ kind: "founder_note", title: "Context", url: null, text: "Focus Fox is a timer for distraction-free work." }]),
  demoClips: [{ id: "clip-1", name: "Demo.mov", localPath: "clip-1.mov", storage: "device", durationMs: 10000, width: 390, height: 844, sizeBytes: 1000, shows: "Start a focus session", importedAt: "2026-09-27T00:00:00Z" }],
};

describe("content taste prototype", () => {
  it("creates five discover concepts per batch with distinct IDs and hooks across the first two batches", () => {
    const first = createDiscoverBatch(profile, 1);
    const second = createDiscoverBatch(profile, 2);
    expect(first).toHaveLength(5);
    expect(second).toHaveLength(5);
    expect(new Set([...first, ...second].map((item) => item.id)).size).toBe(10);
    expect(new Set([...first, ...second].map((item) => item.hook)).size).toBe(10);
    expect(first.every((item) => item.source === "agent" && item.collection === "discover")).toBe(true);
  });

  it("keeps saved, queued, and ignored states independent", () => {
    const item = createStarterConcepts(profile)[0];
    const saved = actOnContent(item, "save");
    expect(saved.saved).toBe(true);
    expect(saved.queued).toBe(false);
    const queued = actOnContent(item, "queue");
    expect(queued.queued).toBe(true);
    expect(queued.saved).toBe(false);
    expect(actOnContent(saved, "ignore").saved).toBe(true);
    expect(actOnContent(queued, "unsave").queued).toBe(true);
    expect(actOnContent({ ...saved, queued: true }, "unqueue").saved).toBe(true);
  });

  it("creates one Studio concept and only permits caption edits afterward", () => {
    const input = { hook: "My hook", demoCaption: "My demo", payoff: "My payoff", creator: "Custom prompt", creatorPrompt: "A candid desk reaction", clipId: "clip-1" };
    const item = createStudioConcept(profile, input, "studio-1");
    expect(item.source).toBe("studio");
    expect(item.saved).toBe(false);
    const attemptedVideoEdit = { ...item, hook: " New caption ", creator: "changed", clipId: "other" };
    const edited = editCaptions(item, attemptedVideoEdit);
    expect(edited.hook).toBe("New caption");
    expect(edited.creator).toBe(item.creator);
    expect(edited.clipId).toBe("clip-1");
    expect(() => createStudioConcept(profile, { ...input, creatorPrompt: "" }, "bad")).toThrow("prompt");
    expect(() => createStudioConcept(profile, { ...input, clipId: "missing" }, "bad")).toThrow("clip");
  });
  it("prepares exactly three distinct editable concepts from real profile context", () => {
    const concepts = createStarterConcepts(profile);
    expect(concepts).toHaveLength(3);
    expect(new Set(concepts.map((item) => item.hook)).size).toBe(3);
    expect(concepts.every((item) => item.clipId === "clip-1" && item.status === "pending")).toBe(true);
    expect(concepts[0].demoCaption).toBe("Start a focus session");
    expect(() => createStarterConcepts({ ...profile, demoClips: [] })).toThrow("demo clip");
  });

  it("love keeps content without bookmarking or queueing; ratings leave explicit launch choices alone", () => {
    const originals = createStarterConcepts(profile);
    const id = originals[0].id;
    let items = reviewConcept(originals, id, "loved");
    items = reviewConcept(items, id, "loved");
    expect(items.filter((item) => item.status === "loved")).toHaveLength(1);
    expect(items[0].saved).toBe(false);
    expect(items[0].queued).toBe(false);
    items[0] = { ...items[0], plan: { channel: "TikTok", date: "2099-12-01", time: "14:00", timezone: "UTC" } };
    items = reviewConcept(items, id, "tossed");
    expect(items).toHaveLength(3);
    expect(items[0].saved).toBe(false);
    expect(items[0].plan?.channel).toBe("TikTok");
    expect(reviewConcept(items, id, "pending")[0].status).toBe("pending");
    expect(originals[0].status).toBe("pending");
  });

  it("validates draft scheduling input without claiming to schedule a post", () => {
    const plan = { channel: "TikTok", date: "2099-12-01", time: "14:00", timezone: "UTC" };
    expect(planError(plan)).toBeNull();
    expect(planError({ ...plan, date: "2099-02-31" })).toBeTruthy();
    expect(planError({ ...plan, time: "25:00" })).toBeTruthy();
    expect(planError({ ...plan, date: "2000-01-01" })).toBeTruthy();
    expect(planError({ ...plan, channel: "Unknown" })).toBeTruthy();
  });
});
