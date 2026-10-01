import manifest from "./public-creator-media.json";

// Only this committed, operator-approved manifest can resolve public media.
// Use a separate namespace: never substitute a user's private creator path.
export const publicCreatorPath = (sha256: string) => `public/creator/${sha256}.mp4`;
export function publicCreatorFor(id: string, sourcePath: string) {
  const entry = manifest.find((item) => item.id === id && item.sourcePath === sourcePath);
  return entry ? publicCreatorPath(entry.sha256) : undefined;
}
export function publicCreatorUrl(path: string): string | undefined {
  const entry = manifest.find((item) => publicCreatorPath(item.sha256) === path);
  if (entry) return entry.url;
  if (path.startsWith("public/")) throw new Error("Unknown public creator clip.");
  return undefined;
}
