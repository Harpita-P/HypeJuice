import { describe, expect, it } from "vitest";
import { captionImage, wrapCaption } from "./studio-ffmpeg.js";
import { createCanvas, loadImage } from "@napi-rs/canvas";

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
  it.each(["top", "middle", "bottom"] as const)("puts solid black behind white demo text at %s without changing hook styling", async (position) => {
    const center = 1280 * { top: 0.18, middle: 0.5, bottom: 0.78 }[position];
    const ctx = createCanvas(720, 1280).getContext("2d");
    ctx.drawImage(await loadImage(await captionImage("Hi", position, "highlight")), 0, 0);
    expect([...ctx.getImageData(360, Math.floor(center - 23), 1, 1).data]).toEqual([0, 0, 0, 255]);
    expect([...ctx.getImageData(0, 0, 1, 1).data]).toEqual([0, 0, 0, 0]);
    const pixels = ctx.getImageData(320, Math.floor(center - 18), 80, 36).data;
    expect(Array.from({ length: pixels.length / 4 }, (_, i) => i * 4).some((i) => pixels[i] === 255 && pixels[i + 1] === 255 && pixels[i + 2] === 255 && pixels[i + 3] === 255)).toBe(true);
    ctx.clearRect(0, 0, 720, 1280);
    ctx.drawImage(await loadImage(await captionImage("Hi", position)), 0, 0);
    expect(ctx.getImageData(360, Math.floor(center - 23), 1, 1).data[3]).toBe(0);
  });
});
