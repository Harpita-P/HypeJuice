import { expect, test } from "@playwright/test";
import type { BriefResponse } from "../../shared/app-brief";
import type { DiscoverBatch, DiscoverRequest } from "../../shared/discover";
import type { CaptionFeedback, FeedbackRequest } from "../../shared/feedback";

test("Content Taste rates three rendered videos, persists choices, and saves favorites without launching", async ({ page }) => {
  const profile: BriefResponse = {
    analyzedAt: "2026-09-28T12:00:00Z", mode: "ai", warnings: [],
    sources: [{ kind: "website", title: "Focus Fox", url: "https://focus.test" }],
    demoClips: [{ id: "taste-demo", name: "Demo.mp4", localPath: "taste-demo", storage: "browser", durationMs: 5000, width: 720, height: 1280, sizeBytes: 16, shows: "Starting a focus timer", importedAt: "2026-09-28" }],
    brief: { appName: "Focus Fox", category: "Productivity", oneLiner: "One task at a time", summary: "A timer for distraction-free work.",
      audiences: [{ segment: "Students", situation: "Studying" }], problems: ["Distractions"], features: [{ name: "Timer", userOutcome: "Focus on one task" }],
      messagingAngles: [{ name: "Small start", hook: "One tiny task", promise: "Start a session" }], tone: ["candid"], avoidClaims: [], unknowns: [] },
  };
  const batches: DiscoverBatch[] = [];
  const ratings: CaptionFeedback[] = [];
  let failFirstRating = true;
  let studioGenerations = 0;
  // No request can fall through to a real paid API during this test.
  await page.route("**/api/**", (route) => route.fulfill({ status: 404, json: { error: "Unmocked test request" } }));
  await page.route("**/api/app-brief", (route) => route.fulfill({ json: profile }));
  await page.route("**/api/studio/config", (route) => route.fulfill({ json: { ready: true, missing: [] } }));
  await page.route("**/api/studio/uploads", (route) => route.fulfill({ json: { id: "fixture-upload" } }));
  await page.route("**/api/studio/jobs", (route) => { studioGenerations++; return route.fulfill({ status: 400, json: { error: "Unexpected creator generation" } }); });
  await page.route("**/api/studio/jobs/*", (route) => route.fulfill({ json: batches.flatMap((batch) => batch.jobs).find((job) => route.request().url().endsWith(job.id)) }));
  await page.route("https://media.test/**", (route) => route.abort());
  await page.route("**/api/discover/config", (route) => route.fulfill({ json: { ready: true, missing: [], creatorCount: 2 } }));
  await page.route("**/api/discover/batches**", async (route) => {
    if (route.request().method() === "GET") return route.fulfill({ json: batches });
    const input = route.request().postDataJSON() as DiscoverRequest;
    expect(input.purpose).toBe("taste"); expect(input.approved).toBe(true);
    const batch: DiscoverBatch = { id: input.id, profileKey: input.profileKey, purpose: "taste", number: 1, createdAt: "2026-09-28T12:01:00Z", status: "succeeded",
      jobs: Array.from({ length: 3 }, (_, index) => ({
        id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`, status: "succeeded", createdAt: "2026-09-28T12:01:00Z", canReuse: true,
        videoUrl: `https://media.test/${index}.mp4`,
        post: { caption: `my focus reset ${index + 1}`, hashtags: ["#Focus", "#StudyRoutine"] },
        input: { id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`, appName: input.brief.appName, profileKey: input.profileKey,
          clipId: input.demos[0].clipId, uploadId: input.demos[0].uploadId, prompt: "A fictional adult creator", hook: `my little focus moment ${index + 1}`, demoCaption: "i start one tiny task", demoSeconds: 5, hookSeconds: 3, demoTextPosition: "top", approved: true },
        origin: { type: "discover", purpose: "taste", batchId: input.id, batchNumber: 1, index, title: `Taste ${index + 1}`, audience: "Students", creatorId: "creator-1" },
      })) };
    batches.push(batch); return route.fulfill({ json: batch });
  });
  await page.route("**/api/discover/feedback**", async (route) => {
    if (route.request().method() === "GET") return route.fulfill({ json: ratings });
    if (failFirstRating) { failFirstRating = false; return route.fulfill({ status: 503, json: { error: "Temporary write failure" } }); }
    const input = route.request().postDataJSON() as FeedbackRequest;
    const job = batches.flatMap((batch) => batch.jobs).find((job) => job.id === input.jobId)!;
    const rating: CaptionFeedback = { ...input, hook: job.input.hook, demoCaption: job.input.demoCaption, title: job.origin!.title, audience: "Students", styleTags: [], updatedAt: new Date().toISOString() };
    ratings.push(rating); return route.fulfill({ json: rating });
  });
  await page.goto("/connect");
  await page.evaluate(() => new Promise<void>((resolve, reject) => {
    const request = indexedDB.open("growthbanana-demo-clips", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("clips");
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result; const transaction = db.transaction("clips", "readwrite");
      transaction.objectStore("clips").put(new Blob(["test clip metadata"], { type: "video/mp4" }), "taste-demo");
      transaction.oncomplete = () => { db.close(); resolve(); }; transaction.onerror = () => reject(transaction.error);
    };
  }));
  await page.getByRole("radio", { name: "Use website link" }).click();
  await page.getByRole("textbox", { name: "Website link", exact: true }).fill("https://focus.test");
  await page.getByRole("button", { name: "Analyze with Growth Agent" }).click();
  await page.getByRole("button", { name: /Step 2/ }).click();
  await page.getByRole("button", { name: "Step 3 · Content Taste" }).click();
  await page.getByRole("button", { name: "Make my 3 videos" }).click();
  const renderedVideo = page.locator('video[src="https://media.test/0.mp4"]');
  await expect(renderedVideo).toBeVisible();
  const footer = page.getByRole("button", { name: "View post caption and hashtags", exact: true });
  await expect(footer).toContainText("my focus reset 1");
  await expect(footer).toContainText("#Focus #StudyRoutine");
  const videoBounds = (await renderedVideo.boundingBox())!;
  expect(videoBounds.height).toBeGreaterThan(480);
  expect((await page.getByRole("button", { name: "Download video", exact: true }).boundingBox())!.width).toBeGreaterThanOrEqual(44);
  const footerBounds = (await footer.boundingBox())!;
  expect(footerBounds.y).toBeGreaterThanOrEqual(videoBounds.y);
  expect(footerBounds.y + footerBounds.height).toBeLessThanOrEqual(videoBounds.y + videoBounds.height);
  await footer.click();
  await expect(page.getByRole("heading", { name: "Post caption", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await expect(page.getByRole("button", { name: /Edit Taste/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Open my workspace" })).toBeDisabled();
  await page.getByRole("button", { name: "Love video 1", exact: true }).click();
  await expect(page.getByText(/Couldn’t save that preference/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Open my workspace" })).toBeDisabled();
  await page.getByRole("button", { name: "Love video 1", exact: true }).click();
  await page.getByRole("button", { name: "Toss video 2", exact: true }).click();
  await page.getByRole("button", { name: "Love video 3", exact: true }).click();
  await expect(page.getByRole("button", { name: "Open my workspace" })).toBeEnabled();
  expect(ratings.map((rating) => rating.verdict)).toEqual(["loved", "tossed", "loved"]);
  await page.getByRole("button", { name: "Open my workspace" }).click();
  await expect(page.getByRole("heading", { name: "Discover", exact: true })).toBeVisible();
  await page.getByText("Library", { exact: true }).click();
  await page.getByRole("tab", { name: "Favorites", exact: true }).click();
  await expect(page.getByRole("button", { name: "Open Taste 1", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Open Taste 2", exact: true })).toHaveCount(0);
  await page.getByText("Launch Bucket", { exact: true }).click();
  await expect(page.getByText("0 items in your bucket", { exact: true })).toBeVisible();
  await page.getByText("Library", { exact: true }).click();
  await page.getByRole("button", { name: "Open Taste 1", exact: true }).click();
  await expect(page.getByRole("button", { name: "View post caption and hashtags", exact: true })).toContainText("my focus reset 1");
  await page.getByRole("button", { name: "Edit Taste 1", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Hook caption", exact: true })).toHaveValue("my little focus moment 1");
  expect(studioGenerations).toBe(0);
});
