import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { z } from "zod";
import { DISCOVER_SIZE, type DiscoverRequest } from "../shared/discover.js";
import { authenticatedMode } from "./identity.js";
import { CreatorTagsSchema } from "../shared/creator-library.js";
import { publicCreatorFor } from "./public-creator-media.js";

const CreatorSchema = z.object({
  id: z.string().min(1).max(100),
  path: z.string().regex(/^creator\/[a-zA-Z0-9_-]+\.mp4$/),
  description: z.string().min(10).max(1000),
  name: z.string().max(100).optional(),
  seconds: z.literal(4).default(4),
  tags: CreatorTagsSchema.default({ emotion: [], gender: [], context: [], actions: [], appearance: [], style: [] }),
  sourcePrompt: z.string().max(2000).optional(),
  tagSource: z.enum(["prompt", "reviewed", "unspecified"]).default("unspecified"),
});
export type LibraryCreator = z.infer<typeof CreatorSchema>;
export type DiscoverPair = { creator: LibraryCreator; demo: DiscoverRequest["demos"][number]; demoPath: string };

// Explicit operator-curated catalog, never auto-publish private Studio footage.
export async function creatorLibrary(): Promise<LibraryCreator[]> {
  const path = process.env.DISCOVER_CREATOR_LIBRARY || resolve("server/creator-library.json");
  const entries = z.array(CreatorSchema).max(500).parse(JSON.parse(await readFile(path, "utf8")));
  if (new Set(entries.map((entry) => entry.id)).size !== entries.length || new Set(entries.map((entry) => entry.path)).size !== entries.length) throw new Error("Creator library entries must be distinct.");
  return entries.map((entry) => ({ ...entry,
    // An explicit custom catalog keeps its original private-storage behavior.
    path: (!process.env.DISCOVER_CREATOR_LIBRARY && publicCreatorFor(entry.id, entry.path))
      || (authenticatedMode() ? `shared/${entry.path}` : entry.path),
  }));
}
function shuffled<T>(values: T[], random: () => number) {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index--) {
    const swap = Math.floor(random() * (index + 1));
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
}
export function mixDiscoverClips(creators: LibraryCreator[], demos: { demo: DiscoverRequest["demos"][number]; demoPath: string }[], random = Math.random, count = DISCOVER_SIZE): DiscoverPair[] {
  if (!creators.length || !demos.length) throw new Error("Discover needs at least one saved creator and one demo clip.");
  const creatorPool = shuffled(creators, random);
  // Balanced random cycles: use available clips before repeating, including a one-demo library.
  let demoPool: typeof demos = [];
  return Array.from({ length: count }, (_, index) => {
    if (index % demos.length === 0) demoPool = shuffled(demos, random);
    return { creator: creatorPool[index % creatorPool.length], ...demoPool[index % demoPool.length] };
  });
}
