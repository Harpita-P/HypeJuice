import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { readFile, stat } from "node:fs/promises";
import { app } from "./app.js";
import { localDemoMedia } from "./local-demo-media.js";
import { appMediaForSources } from "../shared/app-brief.js";

vi.mock("node:fs/promises", async (original) => ({ ...await original<typeof import("node:fs/promises")>(), readFile: vi.fn(), stat: vi.fn() }));
vi.mock("./source-extraction.js", () => ({ extractSources: vi.fn(async () => ({
  sources: [{ kind: "website", url: "https://demo.test/", title: "Demo", text: "Website text" }], warnings: [],
})) }));
vi.mock("./brief-generator.js", () => ({ generateBrief: vi.fn(async () => ({ brief: { appName: "Demo" }, mode: "source_draft" })) }));
const config = { apps: [{ id: "demo", websiteUrl: "https://demo.test", icon: "logo.jpeg", screenshots: ["01.png", "02.png", "03.png", "04.png"] }] };

beforeEach(() => {
  vi.stubEnv("AUTH_MODE", "local");
  vi.stubEnv("STUDIO_ALLOW_UNAUTHENTICATED", "true");
  vi.mocked(readFile).mockImplementation(async (path) => String(path).endsWith("manifest.json") ? JSON.stringify(config) : Buffer.from("local-image"));
  vi.mocked(stat).mockResolvedValue({ isFile: () => true } as Awaited<ReturnType<typeof stat>>);
});
afterEach(() => { vi.resetAllMocks(); vi.unstubAllEnvs(); });

it("adds explicitly local media to website briefs with phone-reachable URLs and ordered screenshots", async () => {
  const response = await app.request("http://192.168.1.10:8787/api/app-brief", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ websiteUrl: "https://demo.test/" }) });
  expect(response.status).toBe(200);
  const payload = await response.json();
  const media = appMediaForSources(payload.sources)!;
  expect(media.iconUrl).toBe("http://192.168.1.10:8787/local-demo-media/demo/logo.jpeg");
  expect(media.screenshotUrls.map((url) => url.split("/").pop())).toEqual(["01.png", "02.png", "03.png", "04.png"]);
  expect(payload.sources[0].appStoreMedia).toBeUndefined();
  expect(payload.sources[0].text).toBeUndefined();
  expect(await localDemoMedia("https://unrelated.test/", "http://localhost:8787")).toBeUndefined();
  expect(await localDemoMedia("https://demo.test/not-this-page", "http://localhost:8787")).toBeUndefined();
});

it("serves only manifest-listed images, not other files", async () => {
  const response = await app.request("/local-demo-media/demo/01.png");
  expect(response.status).toBe(200);
  expect(response.headers.get("Content-Type")).toBe("image/png");
  expect(response.headers.get("Cross-Origin-Resource-Policy")).toBe("cross-origin");
  expect(await response.text()).toBe("local-image");
  expect((await app.request("/local-demo-media/demo/logo.jpeg")).headers.get("Content-Type")).toBe("image/jpeg");
  expect((await app.request("/local-demo-media/demo/manifest.json")).status).toBe(404);
  expect((await app.request("/local-demo-media/other/01.png")).status).toBe(404);
});

it("disables overrides and image serving in production and authenticated mode", async () => {
  vi.stubEnv("NODE_ENV", "production");
  expect(await localDemoMedia("https://demo.test/", "https://api.test")).toBeUndefined();
  expect((await app.request("/local-demo-media/demo/01.png")).status).toBe(404);
  vi.stubEnv("NODE_ENV", "test"); vi.stubEnv("AUTH_MODE", "supabase");
  expect(await localDemoMedia("https://demo.test/", "https://api.test")).toBeUndefined();
  expect((await app.request("/local-demo-media/demo/01.png")).status).toBe(404);
});

it("gracefully disables removed demo files and rejects traversal in the manifest", async () => {
  vi.mocked(stat).mockRejectedValue(new Error("ENOENT"));
  expect(await localDemoMedia("https://demo.test/", "http://localhost:8787")).toBeUndefined();
  vi.mocked(readFile).mockResolvedValue(JSON.stringify({ apps: [{ ...config.apps[0], icon: "../../.env" }] }));
  expect((await app.request("/local-demo-media/demo/01.png")).status).toBe(404);
  vi.mocked(readFile).mockRejectedValue(new Error("ENOENT"));
  expect(await localDemoMedia("https://demo.test/", "http://localhost:8787")).toBeUndefined();
});
