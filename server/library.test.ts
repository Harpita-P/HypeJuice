import { describe, expect, it } from "vitest";
import { actOnContent, type ContentConcept } from "../shared/content";
import { libraryLaunchLabel, removeLibraryItem, sortLibraryItems } from "../shared/library";

const item: ContentConcept = {
  id: "video-1", title: "Video", hook: "Hook", demoCaption: "Demo", payoff: "",
  creator: "Custom prompt", clipId: "clip-1", status: "pending", source: "studio",
  collection: "studio", batch: 0, saved: false, queued: false, ignored: false,
};

describe("Library tile actions", () => {
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
