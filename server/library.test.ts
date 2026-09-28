import { describe, expect, it } from "vitest";
import { actOnContent, type ContentConcept } from "../shared/content";
import { groupLibraryItems, libraryLaunchLabel, removeLibraryItem, sortLibraryItems } from "../shared/library";
import { applyCaptionFeedback, type CaptionFeedback } from "../shared/feedback";
import { pendingDiscoverItems } from "../shared/discover";

const item: ContentConcept = {
  id: "video-1", title: "Video", hook: "Hook", demoCaption: "Demo", payoff: "",
  creator: "Custom prompt", clipId: "clip-1", status: "pending", source: "studio",
  collection: "studio", batch: 0, saved: false, queued: false, ignored: false,
};

describe("Library tile actions", () => {
  it("excludes both reviewed verdicts from Discover but keeps failed/pending decisions retryable", () => {
    const pending = { ...item, collection: "discover" as const, rendered: { jobId: "a", url: "a.mp4" } };
    expect(pendingDiscoverItems([pending, { ...pending, id: "liked", status: "loved" }, { ...pending, id: "tossed", status: "tossed" }, { ...pending, id: "ignored", ignored: true }, item])).toEqual([pending]);
  });
  it("keeps loved content in All, separates bookmarks, and hides tossed variants in both tabs", () => {
    const video = { ...item, rendered: { jobId: "one", url: "one.mp4" }, footageKey: "same" };
    const vote: CaptionFeedback = { profileKey: "app", jobId: "one", verdict: "loved", hook: "my hook", demoCaption: "my demo", title: "Video", audience: "Students", styleTags: [], updatedAt: "2026-09-28" };
    const loved = applyCaptionFeedback([video], [vote]);
    expect(groupLibraryItems(loved, "Most recent")).toHaveLength(1);
    expect(groupLibraryItems(loved, "Most recent", true)).toHaveLength(0);
    const bookmarked = actOnContent(loved[0], "save");
    expect(applyCaptionFeedback([bookmarked], [vote])[0].saved).toBe(true);
    expect(actOnContent(bookmarked, "unsave").status).toBe("loved");
    const tossed = applyCaptionFeedback([bookmarked], [{ ...vote, verdict: "tossed" }]);
    const sibling = { ...video, id: "sibling", rendered: { jobId: "two", url: "two.mp4" } };
    expect(groupLibraryItems([...tossed, sibling], "Most recent")[0].variations).toEqual([sibling]);
    expect(groupLibraryItems(tossed, "Most recent", true)).toHaveLength(0);
  });
  it("groups only known matching footage, retaining per-variation favorites and launch selections", () => {
    const first = { ...item, footageKey: "same-footage", rendered: { jobId: "one", url: "one.mp4" }, saved: true };
    const second = { ...first, id: "video-2", rendered: { jobId: "two", url: "two.mp4" }, saved: false, queued: true };
    const different = { ...second, id: "video-3", footageKey: "different-demo" };
    const unknown = { ...first, id: "legacy", footageKey: undefined };
    const groups = groupLibraryItems([first, second, different, unknown], "Oldest first");
    expect(groups).toHaveLength(3);
    expect(groups[0].variations).toEqual([first, second]);
    expect(groups[0].variations.map((entry) => entry.saved)).toEqual([true, false]);
    const favorites = groupLibraryItems([first, second, different], "Most recent", true);
    expect(favorites).toHaveLength(1);
    expect(favorites[0].id).toBe(first.id);
    expect(favorites[0].variations).toHaveLength(2);
    expect(groupLibraryItems(removeLibraryItem([first, second], first.id), "Most recent")[0].variations).toEqual([second]);
  });
  it("sorts by creation date, not import order, without mutating the collection", () => {
    const newer = { ...item, id: "newer", createdAt: "2026-09-28T12:00:00Z" };
    const older = { ...item, id: "older", createdAt: "2026-09-27T12:00:00Z" };
    const originals = [newer, older];
    expect(sortLibraryItems(originals, "Most recent")).toEqual([newer, older]);
    expect(sortLibraryItems(originals, "Oldest first")).toEqual([older, newer]);
    expect(originals).toEqual([newer, older]);
    const legacy = [item, { ...item, id: "legacy-2" }];
    expect(sortLibraryItems(legacy, "Most recent")).toEqual([...legacy].reverse());
  });
  it("keeps favorites independent of launch status and does not call draft plans published", () => {
    const favorite = actOnContent(item, "save");
    expect(favorite.saved).toBe(true);
    expect(libraryLaunchLabel(favorite)).toBeNull();
    const planned = { ...actOnContent(favorite, "queue"), plan: { channel: "TikTok", date: "2020-01-01", time: "12:00", timezone: "UTC" } };
    expect(libraryLaunchLabel(planned)).toBe("In launch bucket");
    expect(actOnContent(planned, "unsave").queued).toBe(true);
    expect(actOnContent(planned, "unsave").saved).toBe(false);
    const unqueued = actOnContent(planned, "unqueue");
    expect(libraryLaunchLabel(unqueued)).toBeNull();
    expect(unqueued.saved).toBe(true);
    expect(unqueued.plan).toBeUndefined();
  });
  it("removes only the selected item from Library, favorites, and the derived launch queue", () => {
    const selected = { ...item, saved: true, queued: true };
    const other = { ...item, id: "video-2" };
    const originals = [selected, other];
    const remaining = removeLibraryItem(originals, selected.id);
    expect(remaining).toEqual([other]);
    expect(remaining.filter((entry) => entry.queued || entry.saved)).toEqual([]);
    expect(originals).toHaveLength(2);
    expect(removeLibraryItem(originals, "missing")).toEqual(originals);
  });
});
