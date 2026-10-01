import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import manifest from "./public-creator-media.json";
import { creatorLibrary } from "./creator-library.js";
import { publicCreatorFor, publicCreatorPath, publicCreatorUrl } from "./public-creator-media.js";
import { signedMedia, uploadMedia } from "./studio-providers.js";
import { asUser } from "./identity.js";
import { renderLocalVideo } from "./studio-local.js";
import { StudioVideoInputSchema } from "../shared/studio.js";

const mocks = vi.hoisted(() => ({ sign: vi.fn(), upload: vi.fn(), render: vi.fn() }));
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({ storage: { from: () => ({ createSignedUrl: mocks.sign, upload: mocks.upload }) } }) }));
vi.mock("./studio-ffmpeg.js", () => ({ renderWithFFmpeg: mocks.render }));
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("DISCOVER_CREATOR_LIBRARY", "");
  vi.stubEnv("AUTH_MODE", "local");
  mocks.sign.mockResolvedValue({ data: { signedUrl: "https://private.example/signed-demo" } });
  mocks.upload.mockResolvedValue({ error: null });
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("approved public creator library", () => {
  it("maps all twelve catalog entries to distinct hosted clips", async () => {
    const catalog = JSON.parse(await readFile("server/creator-library.json", "utf8")) as { id: string; path: string }[];
    expect(manifest).toHaveLength(12);
    expect(new Set(manifest.map((entry) => entry.sha256)).size).toBe(12);
    for (const entry of manifest) {
      expect(catalog).toContainEqual(expect.objectContaining({ id: entry.id, path: entry.sourcePath }));
      expect(entry.sha256).toMatch(/^[a-f0-9]{64}$/);
      expect(entry.bytes).toBeGreaterThan(0);
      const url = new URL(entry.url);
      expect(url.protocol).toBe("https:");
      expect(url.hostname).toMatch(/^[a-z0-9]+\.supabase\.co$/);
      expect(url.pathname).toBe(`/storage/v1/object/public/hypejuice-creators/creator/${entry.sha256}.mp4`);
      expect(url.search + url.username + url.password).toBe("");
      expect(publicCreatorFor(entry.id, entry.sourcePath)).toBe(publicCreatorPath(entry.sha256));
    }
    expect((await creatorLibrary()).every((entry) => publicCreatorUrl(entry.path))).toBe(true);
    vi.stubEnv("AUTH_MODE", "supabase");
    expect((await creatorLibrary()).every((entry) => publicCreatorUrl(entry.path))).toBe(true);
  });

  it("keeps explicit custom catalogs private in both modes", async () => {
    vi.stubEnv("DISCOVER_CREATOR_LIBRARY", "server/creator-library.json");
    expect((await creatorLibrary())[0].path).toBe(manifest[0].sourcePath);
    vi.stubEnv("AUTH_MODE", "supabase");
    expect((await creatorLibrary())[0].path).toBe(`shared/${manifest[0].sourcePath}`);
  });

  it("resolves only approved public references without signing or storage credentials", async () => {
    vi.stubEnv("SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    for (const entry of manifest) expect(await signedMedia(publicCreatorPath(entry.sha256))).toBe(entry.url);
    expect(mocks.sign).not.toHaveBeenCalled();
    expect(publicCreatorFor("unknown", manifest[0].sourcePath)).toBeUndefined();
    await expect(signedMedia("public/creator/not-approved.mp4")).rejects.toThrow();
    await expect(signedMedia("https://untrusted.example/clip.mp4")).rejects.toThrow();
    await expect(signedMedia("public/creator/../demo/private.mp4")).rejects.toThrow();
    await expect(uploadMedia(publicCreatorPath(manifest[0].sha256), new ArrayBuffer(1), "video/mp4")).rejects.toThrow();
    expect(mocks.upload).not.toHaveBeenCalled();
  });

  it("does not replace private paths, even when their names match the original catalog", async () => {
    vi.stubEnv("AUTH_MODE", "supabase");
    const user = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    await asUser(user, () => signedMedia(manifest[0].sourcePath));
    expect(mocks.sign).toHaveBeenLastCalledWith(`users/${user}/${manifest[0].sourcePath}`, 3600);
    await asUser(user, () => signedMedia("final/result.mp4"));
    expect(mocks.sign).toHaveBeenLastCalledWith(`users/${user}/final/result.mp4`, 3600);
    await expect(signedMedia("demo/private.mp4")).rejects.toThrow("Authenticated user context required");
  });

  it("downloads the public creator and private demo for assembly, then saves the result privately", async () => {
    const fetchMock = vi.fn().mockImplementation(async () => new Response(new Uint8Array([1, 2, 3])));
    vi.stubGlobal("fetch", fetchMock);
    mocks.render.mockImplementation(async (_input, directory: string) => {
      expect(await readFile(join(directory, "creator.mp4"))).toEqual(Buffer.from([1, 2, 3]));
      expect(await readFile(join(directory, "demo.mp4"))).toEqual(Buffer.from([1, 2, 3]));
      const output = join(directory, "output.mp4");
      await writeFile(output, Buffer.from([4, 5, 6]));
      return output;
    });
    const input = StudioVideoInputSchema.parse({ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", uploadId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", appName: "Test", profileKey: "test", clipId: "demo", prompt: "An adult creator smiles", hook: "Hello", demoCaption: "An app demo", demoSeconds: 5, approved: true });
    const result = await renderLocalVideo(input, publicCreatorPath(manifest[0].sha256), "demo/test.mp4");
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([manifest[0].url, "https://private.example/signed-demo"]);
    expect(mocks.sign).toHaveBeenCalledTimes(1);
    expect(result).toBe(`final/${input.id}.mp4`);
    expect(mocks.upload).toHaveBeenCalledWith(result, expect.any(ArrayBuffer), { contentType: "video/mp4", upsert: true });
  });
});
