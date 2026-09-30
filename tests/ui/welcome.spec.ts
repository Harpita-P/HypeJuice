import { expect, test } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LANDING_VIDEOS } from "../../src/config/landing-videos";

test("hosted landing carousel fits phones and starts onboarding without live provider requests", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/api/**", (route) => route.fulfill({ status: 404, json: { error: "No live APIs in this test" } }));
  await page.route("**/api/billing/status", (route) => route.fulfill({ json: { tier: "free", enforced: false, studioAccess: true, checkedAt: new Date().toISOString() } }));
  const fixtureDirectory = mkdtempSync(join(tmpdir(), "hypejuice-landing-test-"));
  let video: Buffer;
  try {
    const fixture = join(fixtureDirectory, "preview.mp4");
    execFileSync("ffmpeg", ["-v", "error", "-f", "lavfi", "-i", "color=c=0x35473a:s=90x160:r=10", "-t", "30", "-an", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-movflags", "+faststart", fixture]);
    video = readFileSync(fixture);
  } finally {
    rmSync(fixtureDirectory, { recursive: true, force: true });
  }
  await page.route("**/storage/v1/object/public/hypejuice-showcase/**", (route) => {
    const range = /bytes=(\d+)-(\d*)/.exec(route.request().headers().range ?? "");
    if (!range) return route.fulfill({ contentType: "video/mp4", headers: { "accept-ranges": "bytes" }, body: video });
    const start = Number(range[1]);
    const end = range[2] ? Math.min(Number(range[2]), video.length - 1) : video.length - 1;
    return route.fulfill({ status: 206, contentType: "video/mp4", headers: { "accept-ranges": "bytes", "content-range": `bytes ${start}-${end}/${video.length}` }, body: video.subarray(start, end + 1) });
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /You built the app/ })).toBeVisible();
  await expect(page.getByTestId("landing-video-tile")).toHaveCount(3);
  await expect(page.getByTestId("landing-center-video").getByText("Content that actually gets people curious about your app", { exact: true })).toHaveCount(0);
  const captionOverlay = page.getByTestId("landing-caption-overlay");
  await expect(captionOverlay).toBeVisible();
  await expect(captionOverlay).toHaveCSS("background-color", "rgb(0, 0, 0)");
  await expect(page.getByTestId("landing-side-video").getByText("Content that actually gets people curious about your app", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Content that actually gets people curious about your app", { exact: true })).toHaveCount(1);
  await expect(page.locator("video")).toHaveCount(3);
  const player = page.getByTestId("landing-center-video").locator("video");
  await expect(player).toHaveAttribute("src", LANDING_VIDEOS[0].url);
  await expect(player).toHaveJSProperty("muted", true);
  await expect(player).toHaveJSProperty("paused", false);
  await expect(page.getByRole("button", { name: "Pause example video", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Play example video", exact: true })).toHaveCount(0);
  for (const side of await page.getByTestId("landing-side-video").locator("video").all()) {
    await expect(side).toHaveJSProperty("muted", true);
    await expect(side).toHaveJSProperty("paused", true);
    await expect(side).toHaveJSProperty("loop", false);
  }
  expect((await player.boundingBox())!.height).toBeGreaterThan(240);
  await expect(page.getByRole("button", { name: "Next example video", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Previous example video", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Show example video 2", exact: true }).click();
  await expect(player).toHaveAttribute("src", LANDING_VIDEOS[1].url);
  await page.getByRole("button", { name: "Show example video 1", exact: true }).click();
  await expect(player).toHaveAttribute("src", LANDING_VIDEOS[0].url);
  const tile = (await page.getByTestId("landing-center-video").boundingBox())!;
  await page.mouse.move(tile.x + tile.width * 0.8, tile.y + tile.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(tile.x + tile.width * 0.2, tile.y + tile.height * 0.5, { steps: 8 });
  await page.mouse.up();
  await expect(player).toHaveAttribute("src", LANDING_VIDEOS[1].url);
  await page.getByRole("button", { name: "Show example video 3", exact: true }).click();
  await expect(player).toHaveAttribute("src", LANDING_VIDEOS[2].url);
  await expect(player).toHaveJSProperty("loop", false);
  // Let the media really end. Dispatching a synthetic event doesn't pause the
  // element and misses the regression where previously centered clips stall.
  await player.evaluate((element: HTMLVideoElement) => { element.currentTime = element.duration - 0.2; });
  await expect(player).toHaveAttribute("src", LANDING_VIDEOS[0].url);
  for (const expected of [1, 2, 0]) {
    await expect(player).toHaveJSProperty("paused", false);
    await player.evaluate((element: HTMLVideoElement) => { element.currentTime = element.duration - 0.2; });
    await expect(player).toHaveAttribute("src", LANDING_VIDEOS[expected].url);
    await expect(player).toHaveJSProperty("paused", false);
    expect(await player.evaluate((element: HTMLVideoElement) => element.currentTime)).toBeLessThan(2);
    for (const side of await page.getByTestId("landing-side-video").locator("video").all()) {
      await expect(side).toHaveJSProperty("paused", true);
      await expect(side).toHaveJSProperty("currentTime", 0);
    }
  }
  await expect(page.getByRole("img", { name: "HypeJuice", exact: true })).toBeVisible();
  await expect(page.getByText("YOUR GROWTH AGENT", { exact: true })).toHaveCount(0);
  await expect(page.getByText("You keep shipping. Your agent makes the noise.", { exact: true })).toHaveCount(0);
  await expect(page.getByText(/HypeJuice learns your app inside out/)).toBeVisible();
  await expect(page.getByText(/HypeJuice learns your app inside out/)).toHaveCSS("font-size", "18px");
  await expect(page.getByRole("heading", { name: "100+ New Ideas from your AI Growth Agent in seconds", exact: true })).toBeVisible();
  await expect(page.getByText("New Ideas from your AI Growth Agent", { exact: true })).toBeVisible();
  await expect(page.getByText(/Choose your angle in seconds/)).toHaveCount(0);
  const cta = page.getByRole("button", { name: "Get Started", exact: true });
  await expect(cta).toBeEnabled();
  await expect(cta).toBeInViewport();
  await expect(page.getByTestId("landing-idea-count")).toHaveText("100+");
  const assertFits = async () => {
    const content = (await page.getByTestId("landing-content").boundingBox())!;
    const ideas = (await page.getByRole("heading", { name: "100+ New Ideas from your AI Growth Agent in seconds", exact: true }).boundingBox())!;
    const button = (await cta.boundingBox())!;
    expect(ideas.y + ideas.height).toBeLessThanOrEqual(content.y + content.height);
    expect(ideas.y + ideas.height).toBeLessThanOrEqual(button.y);
    expect(button.y + button.height).toBeLessThanOrEqual(page.viewportSize()!.height);
    expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(page.viewportSize()!.height);
    const caption = page.getByText("Content that actually gets people curious about your app", { exact: true });
    await expect(caption).toBeInViewport({ ratio: 1 });
    const overlay = (await captionOverlay.boundingBox())!;
    expect(overlay.width).toBeGreaterThan((await page.getByTestId("landing-center-video").boundingBox())!.width);
    expect(overlay.height).toBeLessThan(overlay.width / 3);
  };
  await assertFits();
  await page.screenshot({ path: "/tmp/hypejuice-welcome.png" });
  await page.setViewportSize({ width: 320, height: 568 });
  await expect(cta).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await assertFits();
  await page.screenshot({ path: "/tmp/hypejuice-welcome-small.png" });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const count = page.getByTestId("landing-idea-count");
  await expect(count).toHaveText("10+");
  const label = page.getByText("New Ideas from your AI Growth Agent", { exact: true });
  const labelLeft = (await label.boundingBox())!.x;
  await expect(count).toHaveText("50+");
  await expect(count).toHaveText("100+");
  await expect(count).toHaveText("10+");
  expect((await label.boundingBox())!.x).toBeCloseTo(labelLeft, 0);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(count).toHaveText("100+");
  await cta.click();
  await expect(page.getByText("Pro Plan", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Choose Pro plan", exact: true })).toBeDisabled();
  await expect(page).toHaveURL(/\/paywall$/);
  for (const preview of await page.locator("video").all()) await expect(preview).toHaveJSProperty("paused", true);
  expect(errors).toEqual([]);
});
