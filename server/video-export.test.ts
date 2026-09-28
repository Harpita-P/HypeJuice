import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getJob: vi.fn(), permissions: vi.fn(), createAsset: vi.fn(), download: vi.fn(),
  remove: vi.fn(), share: vi.fn(), available: vi.fn(),
}));
vi.mock("../src/lib/studio-api", () => ({ getStudioJob: mocks.getJob, studioRequestId: () => "export-id" }));
vi.mock("expo-file-system", () => ({
  Paths: { cache: "file:///cache" },
  File: class {
    exists = true;
    uri: string;
    constructor(directory: string, name: string) { this.uri = `${directory}/${name}`; }
    delete() { mocks.remove(this.uri); }
    static downloadFileAsync = mocks.download;
  },
}));
vi.mock("expo-media-library", () => ({ Asset: { create: mocks.createAsset }, requestPermissionsAsync: mocks.permissions }));
vi.mock("expo-sharing", () => ({ isAvailableAsync: mocks.available, shareAsync: mocks.share }));
import { prepareVideoShare, saveVideo } from "../src/lib/video-export.js";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getJob.mockResolvedValue({ status: "succeeded", videoUrl: "https://storage.test/fresh-signed-video" });
  mocks.permissions.mockResolvedValue({ granted: true });
  mocks.available.mockResolvedValue(true);
});

describe("finished video export (mocked native APIs; no generation calls)", () => {
  it("refreshes playback and saves the actual MP4 to Photos, then removes its temporary copy", async () => {
    expect(await saveVideo("job-id")).toBe("Saved to your photo library.");
    expect(mocks.permissions).toHaveBeenCalledWith(true, ["video"]);
    expect(mocks.getJob).toHaveBeenCalledWith("job-id");
    expect(mocks.download).toHaveBeenCalledWith("https://storage.test/fresh-signed-video", expect.objectContaining({ uri: "file:///cache/hypejuice-export-id.mp4" }));
    expect(mocks.createAsset).toHaveBeenCalledWith("file:///cache/hypejuice-export-id.mp4");
    expect(mocks.remove).toHaveBeenCalledOnce();
  });
  it("explains denied permission without downloading anything", async () => {
    mocks.permissions.mockResolvedValue({ granted: false });
    await expect(saveVideo("job-id")).rejects.toThrow("or use Share instead");
    expect(mocks.getJob).not.toHaveBeenCalled();
    expect(mocks.download).not.toHaveBeenCalled();
  });
  it("shares a local MP4 without requiring Photos permission", async () => {
    const prepared = await prepareVideoShare("job-id");
    expect(mocks.permissions).not.toHaveBeenCalled();
    expect(mocks.remove).not.toHaveBeenCalled();
    await prepared.share();
    expect(mocks.share).toHaveBeenCalledWith("file:///cache/hypejuice-export-id.mp4", expect.objectContaining({ mimeType: "video/mp4", UTI: "public.mpeg-4" }));
    prepared.dispose();
    expect(mocks.remove).toHaveBeenCalledOnce();
  });
  it("cleans up partial downloads and doesn’t expose private URLs in errors", async () => {
    mocks.download.mockRejectedValue(new Error("https://storage.test/private?token=secret"));
    await expect(saveVideo("job-id")).rejects.toThrow("Couldn’t download the video");
    expect(mocks.createAsset).not.toHaveBeenCalled();
    expect(mocks.remove).toHaveBeenCalledOnce();
  });
  it("cleans up if saving fails and does not download if sharing is unavailable", async () => {
    mocks.createAsset.mockRejectedValue(new Error("Disk full"));
    await expect(saveVideo("job-id")).rejects.toThrow("available storage");
    expect(mocks.remove).toHaveBeenCalledOnce();
    mocks.download.mockClear();
    mocks.available.mockResolvedValue(false);
    await expect(prepareVideoShare("job-id")).rejects.toThrow("Use Download instead");
    expect(mocks.download).not.toHaveBeenCalled();
  });
});
