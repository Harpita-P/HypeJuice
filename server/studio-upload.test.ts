import { afterEach, describe, expect, it, vi } from "vitest";
import type { DemoClip } from "../shared/app-brief.js";

const mocks = vi.hoisted(() => ({
  platform: { OS: "ios" }, fetch: vi.fn(), file: vi.fn(),
  getUri: vi.fn(), releaseUri: vi.fn(),
}));
vi.mock("react-native", () => ({ Platform: mocks.platform }));
vi.mock("expo/fetch", () => ({ fetch: mocks.fetch }));
vi.mock("../src/lib/auth-client", () => ({ authHeaders: async () => ({}), requireSecureApi: () => {} }));
vi.mock("expo-file-system", () => ({ File: class {
  constructor(uri: string) { return mocks.file(uri); }
} }));
vi.mock("../src/lib/demo-storage", () => ({
  getDemoClipUri: mocks.getUri, releaseDemoClipUri: mocks.releaseUri,
}));
import { uploadStudioDemo } from "../src/lib/studio-api.js";

const clip: DemoClip = {
  id: "demo", storage: "device", localPath: "demo-clips/demo.mov", name: "Demo.mov",
  sizeBytes: 8, durationMs: 5000, width: 720, height: 1280, shows: "Using the app", importedAt: "today",
};
afterEach(() => { vi.resetAllMocks(); mocks.platform.OS = "ios"; });

describe("Studio demo uploads (mocked transport, no paid calls)", () => {
  it("sends a native File with actual video bytes instead of a URI-only form part", async () => {
    const uri = "file:///documents/demo-clips/demo.mov";
    mocks.getUri.mockResolvedValue(uri);
    mocks.file.mockReturnValue(new File(["clipdata"], "demo.mov", { type: "video/quicktime" }));
    mocks.fetch.mockResolvedValue(Response.json({ id: "upload-id" }));
    expect(await uploadStudioDemo(clip, "upload-id")).toEqual({ id: "upload-id" });
    expect(mocks.file).toHaveBeenCalledWith(uri);
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
    const [url, options] = mocks.fetch.mock.calls[0];
    expect(url).toMatch(/\/api\/studio\/uploads$/);
    expect(options.body.get("id")).toBe("upload-id");
    const file = options.body.get("file") as File;
    expect(file).toBeInstanceOf(Blob);
    expect(file.name).toBe("demo.mov");
    expect(file.type).toBe("video/quicktime");
    expect(await file.text()).toBe("clipdata");
    expect(options.headers["Content-Type"]).toBeUndefined(); // Fetch must set the multipart boundary.
    expect(mocks.releaseUri).toHaveBeenCalledWith(uri);
  });

  it("keeps web Blob uploads working and releases their URL even if uploading fails", async () => {
    mocks.platform.OS = "web";
    const uri = "blob:https://app.test/demo";
    mocks.getUri.mockResolvedValue(uri);
    mocks.fetch.mockResolvedValueOnce(new Response(new Blob(["webclip"], { type: "video/mp4" })))
      .mockRejectedValueOnce(new Error("Upload interrupted"));
    await expect(uploadStudioDemo({ ...clip, storage: "browser" }, "upload-id")).rejects.toThrow("Upload interrupted");
    expect(mocks.file).not.toHaveBeenCalled();
    expect(mocks.fetch).toHaveBeenCalledTimes(2);
    const file = mocks.fetch.mock.calls[1][1].body.get("file") as File;
    expect(await file.text()).toBe("webclip");
    expect(mocks.releaseUri).toHaveBeenCalledWith(uri);
  });
});
