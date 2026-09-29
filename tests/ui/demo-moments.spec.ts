import { expect, test } from "@playwright/test";
import { execFileSync } from "node:child_process";
import type { BriefResponse } from "../../shared/app-brief";

test("app moments picker becomes a playable gallery without numbered upload boxes", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const profile: BriefResponse = {
    analyzedAt: "2026-09-29T12:00:00Z", mode: "ai", warnings: [], demoClips: [],
    sources: [{ kind: "website", title: "Focus Fox", url: "https://focus.test" }],
    brief: { appName: "Focus Fox", category: "Productivity", oneLiner: "One task at a time", summary: "A timer for focused work.",
      audiences: [{ segment: "Students", situation: "Studying" }], problems: ["Distractions"], features: [{ name: "Timer", userOutcome: "Focus on one task" }],
      messagingAngles: [{ name: "Small start", hook: "One tiny task", promise: "Start a session" }], tone: ["candid"], avoidClaims: [], unknowns: [] },
  };
  await page.route("**/api/**", (route) => route.fulfill({ status: 404, json: { error: "No live APIs in this test" } }));
  await page.route("**/api/billing/status", (route) => route.fulfill({ json: { tier: "free", enforced: false, studioAccess: true, checkedAt: new Date().toISOString() } }));
  await page.route("**/api/app-brief", (route) => route.fulfill({ json: profile }));
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/connect");
  await page.getByRole("radio", { name: "Use website link" }).click();
  await page.getByRole("textbox", { name: "Website link", exact: true }).fill("https://focus.test");
  await page.getByRole("button", { name: "Analyze with Growth Agent" }).click();
  await page.getByRole("button", { name: /Step 2/ }).click();
  await expect(page.getByTestId("demo-moments-invitation")).toBeVisible();
  await expect(page.getByText(/^Clip [1-4]$/)).toHaveCount(0);
  await expect(page.getByText("Add a clip", { exact: true })).toHaveCount(0);
  await page.screenshot({ path: "/tmp/hypejuice-app-moments-empty.png" });

  const video = execFileSync("ffmpeg", ["-v", "error", "-f", "lavfi", "-i", "color=c=0x35473a:s=90x160:r=10", "-t", "2", "-an", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-movflags", "frag_keyframe+empty_moov", "-f", "mp4", "pipe:1"]);
  const picker = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Choose videos of your app", exact: true }).click();
  await (await picker).setFiles({ name: "demo.mp4", mimeType: "video/mp4", buffer: video });
  await expect(page.getByTestId("demo-moments-gallery")).toBeVisible();
  await expect(page.getByTestId("demo-moments-invitation")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Choose more videos of your app", exact: true })).toBeEnabled();
  await expect(page.locator("video")).toHaveJSProperty("paused", false);
  await expect(page.getByText("demo.mp4", { exact: true })).toHaveCount(0);
  await page.getByRole("textbox", { name: "What recording 1 shows" }).fill("Starting a focus timer");
  await page.screenshot({ path: "/tmp/hypejuice-app-moments-gallery.png" });
  await page.getByRole("button", { name: "Remove clip 1", exact: true }).click();
  await expect(page.getByTestId("demo-moments-invitation")).toBeVisible();
  expect(errors).toEqual([]);
});
