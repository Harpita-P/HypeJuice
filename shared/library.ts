import type { ContentConcept } from "./content";

export type LibrarySort = "Most recent" | "Oldest first";
export type LibraryGroup = ContentConcept & { groupId: string; variations: ContentConcept[] };

export function groupLibraryItems(items: ContentConcept[], order: LibrarySort, favoritesOnly = false): LibraryGroup[] {
  const groups = new Map<string, ContentConcept[]>();
  for (const item of sortLibraryItems(items.filter((entry) => entry.status !== "tossed" && !entry.ignored), order)) {
    const key = item.rendered && item.footageKey ? `footage:${item.footageKey}` : `item:${item.id}`;
    const group = groups.get(key) ?? [];
    group.push(item); groups.set(key, group);
  }
  return [...groups.entries()].flatMap(([groupId, variations]) => {
    const representative = favoritesOnly ? variations.find((item) => item.saved) : variations[0];
    return representative ? [{ ...representative, groupId, variations }] : [];
  });
}

export function sortLibraryItems(items: ContentConcept[], order: LibrarySort): ContentConcept[] {
  const direction = order === "Most recent" ? -1 : 1;
  return items.map((item, index) => ({ item, index, time: Date.parse(item.createdAt ?? "") || 0 }))
    .sort((a, b) => direction * (a.time - b.time || a.index - b.index))
    .map(({ item }) => item);
}

// A draft plan or a queue entry is not proof of publication.
export function libraryLaunchLabel(item: ContentConcept): string | null {
  return item.queued ? "In launch bucket" : null;
}

// Library-only removal: never deletes reusable provider footage or archived renders.
export function removeLibraryItem(items: ContentConcept[], id: string): ContentConcept[] {
  return items.filter((item) => item.id !== id);
}
