import { afterEach, describe, expect, it, vi } from "vitest";

import { extractAppStoreMedia, extractAppStoreSource, extractWebsiteSource } from "./source-extraction.js";

vi.mock("node:dns/promises", () => ({ lookup: vi.fn().mockResolvedValue([{ address: "93.184.216.34", family: 4 }]) }));
afterEach(() => vi.unstubAllGlobals());

describe("App Store visuals", () => {
  it("keeps Apple icon and screenshot URLs, filters bad entries and deduplicates", () => {
    expect(extractAppStoreMedia({
      artworkUrl512: "https://is1-ssl.mzstatic.com/icon.png",
      screenshotUrls: ["https://is1-ssl.mzstatic.com/one.png", "https://is1-ssl.mzstatic.com/one.png", null, "invalid", "http://is1-ssl.mzstatic.com/insecure.png", "https://notmzstatic.com/other.png"],
    })).toEqual({ iconUrl: "https://is1-ssl.mzstatic.com/icon.png", screenshotUrls: ["https://is1-ssl.mzstatic.com/one.png"] });
  });

  it("accepts missing screenshots without inventing images", () => {
    expect(extractAppStoreMedia({ artworkUrl100: "https://is1-ssl.mzstatic.com/icon.png" })).toEqual({ iconUrl: "https://is1-ssl.mzstatic.com/icon.png", screenshotUrls: [] });
    expect(extractAppStoreMedia({})).toEqual({ iconUrl: null, screenshotUrls: [] });
  });

  it("uses iPad screenshots when the phone list is empty", () => {
    expect(extractAppStoreMedia({ screenshotUrls: [], ipadScreenshotUrls: ["https://is1-ssl.mzstatic.com/tablet.png"] }).screenshotUrls).toEqual(["https://is1-ssl.mzstatic.com/tablet.png"]);
  });

  it("carries media from the correct storefront into the extracted source", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ results: [{ trackName: "Focus Fox", description: "Focus timer", artworkUrl512: "https://is1-ssl.mzstatic.com/icon.png", screenshotUrls: ["https://is1-ssl.mzstatic.com/screen.png"] }] })));
    vi.stubGlobal("fetch", fetchMock);
    const source = await extractAppStoreSource("https://apps.apple.com/gb/app/focus-fox/id123456");
    expect(String(fetchMock.mock.calls[0][0])).toContain("country=gb");
    expect(source.title).toBe("Focus Fox");
    expect(source.appStoreMedia?.screenshotUrls).toHaveLength(1);
  });

  it("does not extract website icons or images", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response('<html><head><title>Focus Fox</title><meta property="og:image" content="https://example.com/hero.png"></head><body><h1>Focus better</h1><img src="https://example.com/logo.png"><p>A focus timer.</p></body></html>', { headers: { "content-type": "text/html" } })));
    const source = await extractWebsiteSource("https://example.com");
    expect(source.text).toContain("Focus better");
    expect(source.appStoreMedia).toBeUndefined();
    expect(source.text).not.toContain("hero.png");
  });
});
