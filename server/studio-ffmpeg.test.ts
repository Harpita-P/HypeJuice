import { describe, expect, it } from "vitest";
import { captionImage, wrapCaption } from "./studio-ffmpeg.js";

describe("local static caption layout", () => {
  it("wraps lines and long words while preserving text as plain data", () => {
    expect(wrapCaption("hello world", (text) => text.length, 8)).toEqual(["hello", "world"]);
    expect(wrapCaption("abcdefghijkl", (text) => text.length, 5)).toEqual(["abcde", "fghij", "kl"]);
    expect(wrapCaption("line one\nline two", (text) => text.length, 20)).toEqual(["line one", "line two"]);
    const text = "100%: it's [not] a command; $(echo no)";
    expect(wrapCaption(text, (value) => value.length, 100)).toEqual([text]);
  });
  it("creates transparent 720x1280 caption overlays", async () => {
    const png = await captionImage("POV: this app changes your routine", "middle");
    expect(png.subarray(1, 4).toString()).toBe("PNG");
    expect(png.readUInt32BE(16)).toBe(720);
    expect(png.readUInt32BE(20)).toBe(1280);
  });
});
