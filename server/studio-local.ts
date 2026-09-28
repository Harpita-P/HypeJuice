import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import type { StudioVideoInput } from "../shared/studio.js";
import { signedMedia, uploadMedia } from "./studio-providers.js";
import { renderWithFFmpeg } from "./studio-ffmpeg.js";

async function downloadMedia(path: string, destination: string) {
  const response = await fetch(await signedMedia(path), { signal: AbortSignal.timeout(120000), redirect: "error" });
  if (!response.ok || !response.body) throw new Error("Could not download the saved clip from private storage.");
  const limit = 250 * 1024 * 1024;
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      size += next.value.byteLength;
      if (size > limit) throw new Error("Saved clip exceeds the 250 MB limit.");
      chunks.push(next.value);
    }
  } finally { await reader.cancel(); }
  if (!size) throw new Error("The saved clip is empty.");
  await writeFile(destination, Buffer.concat(chunks), { mode: 0o600 });
}

// One local encode at a time avoids overwhelming a founder's computer.
let tail: Promise<unknown> = Promise.resolve();
export function renderLocalVideo(input: StudioVideoInput, creatorPath: string, demoPath: string): Promise<string> {
  const task = tail.then(async () => {
    z.uuid().parse(input.id);
    const directory = await mkdtemp(join(tmpdir(), "growthbanana-render-"));
    try {
      await downloadMedia(creatorPath, join(directory, "creator.mp4"));
      await downloadMedia(demoPath, join(directory, "demo.mp4"));
      const output = await renderWithFFmpeg(input, directory);
      const finalPath = `final/${input.id}.mp4`;
      await uploadMedia(finalPath, Uint8Array.from(await readFile(output)).buffer, "video/mp4");
      return finalPath;
    } finally {
      // Only this generated scratch directory; originals and archived files stay intact.
      await rm(directory, { recursive: true, force: true });
    }
  });
  tail = task.catch(() => {});
  return task;
}
