import { afterEach, describe, expect, it, vi } from "vitest";

import { app } from "./app.js";

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("API", () => {
  it("reports health", async () => {
    const response = await app.request("/health");
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ ok: true });
  });

  it("requires at least one source", async () => {
    const response = await app.request("/api/app-brief", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ appStoreUrl: "", websiteUrl: "", founderNote: "" }),
    });
    expect(response.status).toBe(400);
  });

  it("returns App Store media to the client without leaking the extracted text", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ results: [{ trackName: "Focus Fox", description: "A focus timer.", artworkUrl512: "https://is1-ssl.mzstatic.com/icon.png", screenshotUrls: [] }] }))));
    const response = await app.request("/api/app-brief", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ appStoreUrl: "https://apps.apple.com/us/app/focus-fox/id123456" }) });
    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result.sources[0].appStoreMedia).toEqual({ iconUrl: "https://is1-ssl.mzstatic.com/icon.png", screenshotUrls: [] });
    expect(result.sources[0].text).toBeUndefined();
  });
});
