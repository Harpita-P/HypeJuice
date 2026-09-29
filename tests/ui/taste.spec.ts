import { expect, test } from "@playwright/test";
import { execFileSync } from "node:child_process";
import type { BriefResponse } from "../../shared/app-brief";
import { demoSetKey, type DiscoverBatch, type DiscoverRequest } from "../../shared/discover";
import type { CaptionFeedback, FeedbackRequest } from "../../shared/feedback";

test("Content Taste keeps liked videos, Discover saves to Library, and Library downloads locally", async ({ page }) => {
  // A tiny in-memory clip makes autoplay checks real; no media enters the repo.
  const previewVideo = execFileSync("ffmpeg", ["-v", "error", "-f", "lavfi", "-i", "color=c=0x35473a:s=90x160:r=15", "-t", "1", "-an", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-movflags", "frag_keyframe+empty_moov", "-f", "mp4", "pipe:1"]);
  await page.addInitScript(() => {
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      this.dataset.playAttempts = String(Number(this.dataset.playAttempts ?? 0) + 1);
      return play.call(this);
    };
  });
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
  let failLastRating = true;
  let failDiscoverRating = true;
  let studioGenerations = 0;
  let studioFinished = false;
  let finishTaste!: () => void;
  const tasteReady = new Promise<void>((resolve) => { finishTaste = resolve; });
  let finishDiscover!: () => void;
  let discoverStarts = 0;
  const discoverReady = new Promise<void>((resolve) => { finishDiscover = resolve; });
  const studioInputs: Record<string, unknown>[] = [];
  let tracked = false;
  let finishAnalysis!: () => void;
  const analysisReady = new Promise<void>((resolve) => { finishAnalysis = resolve; });
  // No request can fall through to a real paid API during this test.
  await page.route("**/api/**", (route) => route.fulfill({ status: 404, json: { error: "Unmocked test request" } }));
  await page.route("**/api/billing/status", (route) => route.fulfill({ json: { appUserId: "test-local", tier: "free", enforced: false, verified: false, studioAccess: true, checkedAt: new Date().toISOString() } }));
  await page.route("**/api/app-brief", async (route) => { await analysisReady; return route.fulfill({ json: profile }); });
  await page.route("**/api/liftoff/chat", (route) => {
    const input = route.request().postDataJSON();
    expect(input.jobIds).toEqual(["00000000-0000-4000-8000-000000000001"]);
    expect(input.messages.at(-1).text).toBe("Which video has the most views?");
    expect(input).not.toHaveProperty("metrics");
    return route.fulfill({ json: { answer: "Your little focus moment has 1,600 recorded views. Let’s try another small task hook.", checkedAt: new Date().toISOString() } });
  });
  await page.route("**/api/youtube-tracking/**", (route) => {
    if (route.request().url().endsWith("/connect")) { expect(route.request().postDataJSON().confirmed).toBe(true); tracked = true; }
    if (route.request().url().endsWith("/disconnect")) tracked = false;
    return route.fulfill({ json: { configured: true, connection: tracked ? { jobId: "00000000-0000-4000-8000-000000000001", trackingId: "40000000-0000-4000-8000-000000000001", videoId: "abcdefghijk", linkedAt: "2026-09-28T12:00:00Z" } : null,
      snapshots: tracked ? [{ checkedAt: "2026-09-28T12:00:00Z", counts: { views: 1200, likes: 30, comments: 0 } }, { checkedAt: "2026-09-28T13:00:00Z", counts: { views: 1600, likes: 45, comments: 3 }, channel: "Focus Fox" }] : [] } });
  });
  await page.route("**/api/studio/config", (route) => route.fulfill({ json: { ready: true, missing: [] } }));
  await page.route("**/api/studio/creators", (route) => route.fulfill({ json: { ready: true, missing: [], creators: [
    { id: "creator-1", name: "Wide-eyed discovery", description: "An adult woman reacting with surprise at home", previewUrl: "https://media.test/creator-1.mp4", seconds: 4, tagSource: "prompt", tags: { emotion: ["surprised"], gender: ["woman"], context: ["at home"], actions: ["hand over mouth"], appearance: ["adult"], style: ["candid"] } },
    { id: "creator-2", name: "Quiet realization", description: "A brown-haired adult woman with a subtle reaction", previewUrl: "https://media.test/creator-2.mp4", seconds: 4, tagSource: "prompt", tags: { emotion: ["surprised"], gender: ["woman"], context: ["at home"], actions: ["wide eyes"], appearance: ["brown hair"], style: ["understated"] } },
  ] } }));
  await page.route("**/api/studio/ideas", (route) => {
    const input = route.request().postDataJSON();
    expect(input.creatorId).toBeUndefined();
    expect(input.description).toContain("adult creator");
    expect(input.count).toBe(3);
    return route.fulfill({ json: { id: input.id, message: "One creator, three angles", ideas: Array.from({ length: 3 }, (_, i) => ({ id: `20000000-0000-4000-8000-00000000000${i}`, clipId: "taste-demo", angle: `Angle ${i + 1}`, audience: "Busy students", vibes: ["Funny", "Relatable"], hook: `my little discovery ${i + 1}`, demoCaption: "i start one task", post: { caption: "my quiet reset", hashtags: ["#Focus"] } })) } });
  });
  await page.route("**/api/studio/uploads", (route) => route.fulfill({ json: { id: "fixture-upload" } }));
  await page.route("**/api/studio/jobs", (route) => {
    if (route.request().method() === "GET") return route.fulfill({ json: [] });
    studioGenerations++;
    const input = route.request().postDataJSON(); studioInputs.push(input);
    return route.fulfill({ status: 202, json: { id: input.id, input, createdAt: new Date().toISOString(), status: "assembling_local", canReuse: true } });
  });
  await page.route("**/api/studio/jobs/*", (route) => {
    const input = studioInputs.find((entry) => route.request().url().endsWith(String(entry.id)));
    return route.fulfill({ json: input ? { id: input.id, input, createdAt: "2026-09-28T14:00:00Z", status: studioFinished ? "succeeded" : "assembling_local", canReuse: true, footageKey: "shared-studio-footage", ...(studioFinished ? { videoUrl: `https://media.test/studio-${input.id}.mp4` } : {}) } : batches.flatMap((batch) => batch.jobs).find((job) => route.request().url().endsWith(job.id)) });
  });
  await page.route("https://media.test/**", (route) => route.fulfill({ contentType: "video/mp4", body: previewVideo }));
  await page.route("**/api/discover/config", (route) => route.fulfill({ json: { ready: true, missing: [], creatorCount: 2 } }));
  await page.route("**/api/discover/batches**", async (route) => {
    if (route.request().method() === "GET") return route.fulfill({ json: [
      { id: "aaaaaaaa-0000-4000-8000-000000000001", profileKey: "https://focus.test", purpose: "discover", onboardingId: "previous-setup", demoSetKey: "old-demos", number: 1, createdAt: "2026-09-27", status: "failed", jobs: [] },
      { id: "aaaaaaaa-0000-4000-8000-000000000002", profileKey: "https://focus.test", purpose: "discover", onboardingId: profile.analyzedAt, demoSetKey: "removed-demos", number: 2, createdAt: "2026-09-27", status: "rendering", jobs: [] },
      ...batches,
    ] });
    const input = route.request().postDataJSON() as DiscoverRequest;
    expect(input.approved).toBe(true);
    expect(input.onboardingId).toBe(profile.analyzedAt);
    expect(input.demoSetKey).toBe(demoSetKey(profile.demoClips));
    expect(input.demos.map((demo) => demo.clipId)).toEqual(["taste-demo"]);
    const isTaste = input.purpose === "taste";
    if (isTaste) await tasteReady;
    else { discoverStarts++; await discoverReady; }
    const number = isTaste ? 1 : discoverStarts;
    const prefix = isTaste ? "00000000" : String(9999999 + number);
    const batch: DiscoverBatch = { id: input.id, profileKey: input.profileKey, purpose: input.purpose, onboardingId: input.onboardingId, demoSetKey: input.demoSetKey, number, createdAt: "2026-09-28T12:01:00Z", status: "succeeded",
      jobs: Array.from({ length: isTaste ? 3 : 5 }, (_, index) => ({
        id: `${prefix}-0000-4000-8000-${String(index + 1).padStart(12, "0")}`, status: "succeeded", createdAt: "2026-09-28T12:01:00Z", canReuse: true,
        videoUrl: `https://media.test/${isTaste ? "" : "discover-"}${index}.mp4`,
        post: { caption: `my focus reset ${index + 1}`, hashtags: ["#Focus", "#StudyRoutine"] },
        input: { id: `${prefix}-0000-4000-8000-${String(index + 1).padStart(12, "0")}`, appName: input.brief.appName, profileKey: input.profileKey,
          clipId: input.demos[0].clipId, uploadId: input.demos[0].uploadId, prompt: "A fictional adult creator", hook: `my little focus moment ${index + 1}`, demoCaption: "i start one tiny task", demoSeconds: 5, hookSeconds: 3, demoTextPosition: "top", approved: true },
        origin: { type: "discover", purpose: input.purpose, batchId: input.id, batchNumber: number, index, title: `${isTaste ? "Taste" : "Discover"} ${index + 1 + (isTaste ? 0 : (number - 1) * 5)}`, audience: "Students", creatorId: "creator-1" },
      })) };
    batches.push(batch); return route.fulfill({ json: batch });
  });
  await page.route("**/api/discover/feedback**", async (route) => {
    if (route.request().method() === "GET") return route.fulfill({ json: ratings });
    if (failFirstRating) { failFirstRating = false; return route.fulfill({ status: 503, json: { error: "Temporary write failure" } }); }
    const input = route.request().postDataJSON() as FeedbackRequest;
    if (input.jobId.startsWith("10000000") && failDiscoverRating) { failDiscoverRating = false; return route.fulfill({ status: 503, json: { error: "Temporary Discover-rating failure" } }); }
    if (input.jobId === "00000000-0000-4000-8000-000000000003" && failLastRating) { failLastRating = false; return route.fulfill({ status: 503, json: { error: "Temporary final-rating failure" } }); }
    const job = batches.flatMap((batch) => batch.jobs).find((job) => job.id === input.jobId)!;
    const rating: CaptionFeedback = { ...input, hook: job.input.hook, demoCaption: job.input.demoCaption, title: job.origin!.title, audience: "Students", styleTags: [], updatedAt: new Date().toISOString() };
    ratings.push(rating); return route.fulfill({ json: rating });
  });
  await page.goto("/connect");
  await expect(page.getByRole("img", { name: "HypeJuice", exact: true })).toBeVisible();
  await expect(page.getByRole("img", { name: "HypeJuice", exact: true }).locator("img")).toHaveJSProperty("naturalWidth", 1254);
  await expect(page.getByText("GrowthBanana", { exact: true })).toHaveCount(0);
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
  await expect(page.getByRole("heading", { name: "I’m finding your app’s edge.", exact: true })).toBeVisible();
  await expect(page.getByText("Who could fall for it", { exact: true })).toBeVisible();
  await expect(page.getByText("What makes it different", { exact: true })).toBeVisible();
  await page.screenshot({ path: "/tmp/hypejuice-learning.png" });
  finishAnalysis();
  await page.getByRole("button", { name: /Step 2/ }).click();
  await page.getByRole("button", { name: "Step 3 · Content Taste" }).click();
  await expect(page.getByRole("heading", { name: "Let’s turn your app into a conversation.", exact: true })).toBeVisible();
  await expect(page.getByText("Your app. Three fresh angles.", { exact: true })).toBeVisible();
  await page.screenshot({ path: "/tmp/hypejuice-preparing-taste.png" });
  await expect(page.getByRole("heading", { name: "I made you 3 samples. Pick ones you like. I'll tailor what's next.", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Make my 3 videos" })).toHaveCount(0);
  finishTaste();
  const renderedVideo = page.locator('video[src="https://media.test/0.mp4"]');
  await expect(renderedVideo).toBeVisible();
  await expect(page.getByTestId("taste-reading-overlay")).toBeVisible();
  await expect(page.getByTestId("swipe-decision-card").getByTestId("swipe-hand-hint")).toBeVisible();
  await expect(page.getByRole("button", { name: "Love video 1", exact: true })).toBeDisabled();
  await expect(page.getByTestId("taste-rear-card").getByTestId("swipe-hand-hint")).toHaveCount(0);
  await expect(renderedVideo).toHaveJSProperty("paused", false);
  await expect(page.getByTestId("taste-reading-overlay")).toBeVisible();
  await expect(page.getByRole("button", { name: "Play or pause video", exact: true })).toBeEnabled();
  await expect(page.getByRole("img", { name: "HypeJuice agent", exact: true })).toBeVisible();
  await expect(page.getByTestId("taste-rear-card")).toHaveCount(2);
  await expect(page.getByTestId("taste-rear-card").locator('video[src="https://media.test/1.mp4"]')).toHaveCount(1);
  await expect(page.getByTestId("taste-rear-card").locator('video[src="https://media.test/2.mp4"]')).toHaveCount(1);
  for (const video of await page.getByTestId("taste-rear-card").locator("video").all()) {
    await expect(video).toHaveJSProperty("paused", true);
    expect(await video.getAttribute("data-play-attempts")).toBeNull();
  }
  await expect(page.getByTestId("taste-reading-overlay")).toHaveCount(0);
  await expect(renderedVideo).toHaveJSProperty("paused", false);
  await page.screenshot({ path: "/tmp/hypejuice-taste-stack.png" });
  await expect(page.getByTestId("swipe-hand-hint")).toBeVisible();
  await expect(page.getByText(/of 3 rated|Love it keeps it in Library/)).toHaveCount(0);
  const footer = page.getByRole("button", { name: "View post caption and hashtags", exact: true });
  await expect(footer).toHaveCount(0);
  await expect(page.getByText("my focus reset 1", { exact: true })).toHaveCount(0);
  const videoBounds = (await renderedVideo.boundingBox())!;
  const hintBounds = (await page.getByTestId("swipe-hand-hint").boundingBox())!;
  expect(hintBounds.y).toBeGreaterThan(videoBounds.y + videoBounds.height * 0.6);
  expect(videoBounds.height).toBeGreaterThan(480);
  expect(videoBounds.width).toBeCloseTo(page.viewportSize()!.width - 52, 0);
  expect(videoBounds.height / videoBounds.width).toBeLessThan(16 / 9);
  await expect(renderedVideo).toHaveCSS("object-fit", "contain");
  for (const name of ["Love video 1", "Toss video 1", "Review video 3"]) {
    const bounds = (await page.getByRole("button", { name, exact: true }).boundingBox())!;
    expect(bounds.y).toBeGreaterThanOrEqual(0);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(page.viewportSize()!.height);
  }
  await expect(page.getByRole("button", { name: "Download video", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Share video", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Edit captions", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Open my workspace" })).toHaveCount(0);
  await page.getByRole("button", { name: "Love video 1", exact: true }).click();
  await expect(page.getByText(/Couldn’t save that preference/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "I made you 3 samples. Pick ones you like. I'll tailor what's next.", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Love video 1", exact: true }).click();
  await expect(page.getByRole("button", { name: "Toss video 2", exact: true })).toBeEnabled();
  await expect(page.getByTestId("swipe-hand-hint")).toBeVisible();
  await expect(page.getByTestId("taste-rear-card")).toHaveCount(1);
  await expect(page.getByTestId("taste-reading-overlay")).toHaveCount(0);
  await expect(page.getByTestId("swipe-decision-card").locator("video")).toHaveJSProperty("paused", false);
  const tasteCard = page.getByTestId("swipe-decision-card");
  const swipeBounds = (await tasteCard.boundingBox())!;
  const tasteHeading = page.getByRole("heading", { name: "I made you 3 samples. Pick ones you like. I'll tailor what's next.", exact: true });
  const headingBeforeSwipe = (await tasteHeading.boundingBox())!;
  await page.mouse.move(swipeBounds.x + swipeBounds.width * 0.7, swipeBounds.y + swipeBounds.height * 0.4);
  await page.mouse.down();
  await page.mouse.move(swipeBounds.x + swipeBounds.width * 0.2, swipeBounds.y + swipeBounds.height * 0.4, { steps: 12 });
  expect((await tasteHeading.boundingBox())!.x).toBeCloseTo(headingBeforeSwipe.x, 0);
  await expect(page.getByTestId("swipe-toss-sheen")).toHaveCSS("opacity", "1");
  await expect(page.getByTestId("swipe-keep-sheen")).toHaveCSS("opacity", "0");
  await expect(page.getByTestId("swipe-toss-sheen")).toHaveCSS("background-color", "rgba(255, 48, 70, 0.38)");
  await page.mouse.up();
  await expect(page.getByTestId("taste-rear-card")).toHaveCount(0);
  await expect(page.getByTestId("swipe-hand-hint")).toBeVisible();
  await page.getByRole("button", { name: "Love video 3", exact: true }).click();
  await expect(page.getByText(/Couldn’t save that preference/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Love video 3", exact: true })).toBeEnabled();
  expect(ratings).toHaveLength(2);
  await expect(page.getByRole("heading", { name: "Discover", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Love video 3", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Getting your personalized content ready", exact: true })).toBeVisible();
  expect(discoverStarts).toBe(1);
  finishDiscover();
  await expect(page.getByRole("heading", { name: "Awesome, I’ve got your vibe.", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Discover", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "I’ve made you tons of fresh content. Scroll to explore.", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Download video", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Share video", exact: true })).toBeVisible();
  await expect(page.getByTestId("swipe-hand-hint")).toBeVisible();
  await expect(page.getByRole("img", { name: "HypeJuice", exact: true })).toBeVisible();
  await expect(page.locator('video[src="https://media.test/discover-0.mp4"]')).toBeVisible();
  const nextDiscover = page.locator('video[src="https://media.test/discover-1.mp4"]');
  await expect(nextDiscover).toHaveJSProperty("paused", true);
  await expect.poll(() => nextDiscover.evaluate((video: HTMLVideoElement) => video.readyState)).toBeGreaterThanOrEqual(3);
  await nextDiscover.evaluate((video) => { (video as HTMLVideoElement).dataset.preloaded = "true"; });
  await expect(footer).toHaveCSS("background-color", "rgba(0, 0, 0, 0.5)");
  await expect(footer).toContainText("#Focus #StudyRoutine");
  await expect(page.getByRole("button", { name: "Create my first 5 videos" })).toHaveCount(0);
  expect(discoverStarts).toBe(1);
  expect(ratings.map((rating) => rating.verdict)).toEqual(["loved", "tossed", "loved"]);
  await page.getByRole("button", { name: "Save Content: Discover 1", exact: true }).click();
  await expect(page.getByText(/Couldn’t save that preference/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Save Content: Discover 1", exact: true })).toBeEnabled();
  const discoverCard = (await page.getByTestId("swipe-decision-card").first().boundingBox())!;
  await page.mouse.move(discoverCard.x + discoverCard.width * 0.2, discoverCard.y + 140);
  await page.mouse.down();
  await page.mouse.move(discoverCard.x + discoverCard.width * 0.75, discoverCard.y + 140, { steps: 12 });
  await page.mouse.up();
  await expect(page.getByRole("button", { name: "Toss Discover 2", exact: true })).toBeEnabled();
  await expect(nextDiscover).toHaveAttribute("data-preloaded", "true");
  await expect(nextDiscover).toHaveJSProperty("paused", false);
  await expect(page.locator('video[src="https://media.test/discover-0.mp4"]')).toHaveJSProperty("paused", true);
  await expect(page.getByTestId("swipe-hand-hint")).toHaveCount(0);
  await page.getByRole("button", { name: "Toss Discover 2", exact: true }).click();
  await expect(page.getByRole("button", { name: "Save Content: Discover 3", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Save Content: Discover 3", exact: true }).click();
  await expect(page.getByRole("button", { name: "Toss Discover 4", exact: true })).toBeEnabled();
  const fourth = (await page.getByTestId("swipe-decision-card").filter({ has: page.locator('video[src="https://media.test/discover-3.mp4"]') }).boundingBox())!;
  await page.mouse.move(fourth.x + fourth.width * 0.75, fourth.y + 140);
  await page.mouse.down();
  await page.mouse.move(fourth.x + fourth.width * 0.2, fourth.y + 140, { steps: 12 });
  await page.mouse.up();
  await expect(page.getByRole("button", { name: "Toss Discover 5", exact: true })).toBeInViewport();
  await page.getByRole("button", { name: "Toss Discover 5", exact: true }).click();
  await expect(page.getByRole("button", { name: "Yes, explore 5 more", exact: true })).toBeVisible();
  await expect(page.getByText(/shared creator clips|Refresh saved batches/)).toHaveCount(0);
  await page.getByTestId("discover-feed").filter({ visible: true }).evaluate((element) => { element.scrollTop = 0; });
  await expect(page.getByRole("button", { name: "Save Content: Discover 1", exact: true })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Save Content: Discover 1", exact: true })).toHaveText("Saved");
  await expect(page.locator('video[src="https://media.test/discover-0.mp4"]')).toHaveJSProperty("paused", false);
  await expect(page.getByTestId("swipe-hand-hint")).toHaveCount(0);
  await page.getByTestId("discover-feed").filter({ visible: true }).evaluate((element) => { element.scrollTop = element.clientHeight; });
  await expect(page.getByRole("button", { name: "Toss Discover 2", exact: true })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Toss Discover 2", exact: true })).toHaveText("Tossed");
  await expect(page.locator('video[src="https://media.test/discover-1.mp4"]')).toHaveJSProperty("paused", false);
  await page.getByTestId("discover-feed").filter({ visible: true }).evaluate((element) => { element.scrollTop = element.scrollHeight; });
  await expect(page.getByRole("button", { name: "Yes, explore 5 more", exact: true })).toBeVisible();
  await page.screenshot({ path: "/tmp/growthbanana-discover-more.png", fullPage: true });
  await page.getByText("Library", { exact: true }).click();
  await expect(page.getByRole("button", { name: "Open Discover 1", exact: true })).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Open Discover 2", exact: true })).toHaveCount(0);
  await page.getByRole("tab", { name: "Home", exact: true }).click();
  await expect(page.getByRole("button", { name: "Yes, explore 5 more", exact: true })).toBeVisible();
  expect(discoverStarts).toBe(1);
  await page.getByText("Library", { exact: true }).click();
  await expect(page.getByRole("button", { name: "Open Taste 1", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Open Taste 2", exact: true })).toHaveCount(0);
  await page.getByRole("tab", { name: "Starred", exact: true }).click();
  await expect(page.getByRole("button", { name: "Open Taste 1", exact: true })).toHaveCount(0);
  await page.getByRole("tab", { name: "All", exact: true }).click();
  await expect(page.getByRole("button", { name: "Save to bookmarks: Taste 1", exact: true })).toHaveCount(0);
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download video: Taste 1", exact: true }).click();
  const downloaded = await downloadEvent;
  expect(downloaded.suggestedFilename()).toBe("hypejuice-video.mp4");
  expect(await downloaded.failure()).toBeNull();
  await expect(page.getByText("Download started.", { exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Starred", exact: true }).click();
  await expect(page.getByRole("button", { name: "Open Taste 1", exact: true })).toHaveCount(0);
  expect(ratings).toHaveLength(8); // Downloading never changes preferences or bookmarks.
  await page.getByRole("tab", { name: "All", exact: true }).click();
  await page.getByRole("button", { name: "Star: Taste 1", exact: true }).click();
  await page.getByRole("tab", { name: "Starred", exact: true }).click();
  await expect(page.getByRole("button", { name: "Open Taste 1", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Let’s get your next post ready. Tap a rocket to add it to Liftoff.", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Unstar: Taste 1", exact: true }).click();
  await expect(page.getByRole("button", { name: "Open Taste 1", exact: true })).toHaveCount(0);
  await page.getByRole("tab", { name: "All", exact: true }).click();
  await page.getByRole("tab", { name: "Liftoff", exact: true }).click();
  await expect(page.getByText("Give your content a runway", { exact: true })).toBeVisible();
  await page.getByText("Library", { exact: true }).click();
  await page.getByRole("button", { name: "Add to Liftoff: Taste 1", exact: true }).click();
  await expect(page.getByRole("heading", { name: "You’ve got 1 video ready to post. Let’s make some noise!", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Add to Liftoff: Taste 3", exact: true }).click();
  await expect(page.getByRole("heading", { name: "You’ve got 2 videos ready to post. Let’s make some noise!", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Remove from Liftoff: Taste 3", exact: true }).click();
  await expect(page.getByRole("heading", { name: "You’ve got 1 video ready to post. Let’s make some noise!", exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Liftoff", exact: true }).click();
  await page.getByRole("button", { name: "TikTok: coming soon", exact: true }).click();
  await expect(page.getByText("Integration coming soon", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Got it", exact: true }).click();
  await expect(page.getByText("READY TO POST", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Plan", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Star video", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "YouTube Shorts: connect posted video", exact: true }).click();
  await page.getByRole("textbox", { name: "Post link", exact: true }).fill("https://youtube.com/shorts/abcdefghijk");
  await expect(page.getByRole("button", { name: "Connect & track", exact: true })).toBeDisabled();
  await page.getByRole("checkbox").click();
  await page.getByRole("button", { name: "Connect & track", exact: true }).click();
  await expect(page.getByText("1,600", { exact: true })).toBeVisible();
  await expect(page.getByText(/Last checked|Last attempt|Waiting for the first check/)).toHaveCount(0);
  await expect(page.getByTestId("liftoff-card").getByText("Focus Fox", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Top views", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Ask your growth agent", exact: true }).click();
  await page.getByRole("button", { name: "Which video has the most views?", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Your little focus moment has 1,600 recorded views. Let’s try another small task hook.", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Close agent chat", exact: true }).click();
  await page.getByRole("button", { name: "Show metrics history", exact: true }).click();
  await expect(page.getByText("Views · captured totals · last 28 days", { exact: true })).toBeVisible();
  await page.screenshot({ path: "/tmp/growthbanana-launch-metrics.png", fullPage: true });
  await page.getByText("Library", { exact: true }).click();
  await page.getByRole("button", { name: "Open Taste 1", exact: true }).click();
  await expect(page.getByRole("button", { name: "View post caption and hashtags", exact: true })).toContainText("my focus reset 1");
  await page.getByRole("button", { name: "Edit captions", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Hook caption", exact: true })).toHaveValue("my little focus moment 1");
  expect(studioGenerations).toBe(0);
  const studioErrors: string[] = [];
  page.on("pageerror", (error) => studioErrors.push(error.message));
  await page.getByText("← Back to creator library", { exact: true }).click();
  await expect(page.getByRole("radio", { name: "Wide-eyed discovery", exact: true })).toBeVisible();
  await expect(page.getByRole("img", { name: "HypeJuice", exact: true })).toBeVisible();
  await expect(page.getByText("Recent videos", { exact: true })).toHaveCount(0);
  const creatorTile = page.getByRole("radio", { name: "Wide-eyed discovery", exact: true });
  const creatorVideo = creatorTile.locator("video");
  await expect(creatorVideo).toHaveAttribute("data-play-attempts", /[1-9]/);
  await expect(creatorVideo).toHaveJSProperty("muted", true);
  await expect(creatorVideo).toHaveJSProperty("loop", true);
  await expect(creatorVideo).toHaveJSProperty("paused", false);
  await expect(creatorTile).not.toContainText("Wide-eyed discovery");
  await expect(creatorTile).toContainText("surprised");
  await expect(creatorTile).toContainText("at home");
  await expect(page.getByRole("button", { name: "Find creative angles" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Use this creator" })).toBeDisabled();
  await page.getByRole("radio", { name: "Wide-eyed discovery", exact: true }).click();
  await page.getByRole("button", { name: "Use this creator" }).click();
  await expect(page.getByRole("button", { name: "Find creative angles" })).toBeVisible();
  await expect(page.getByRole("radio", { name: "Straight to the point", exact: true })).toHaveAttribute("aria-checked", "true");
  await page.getByRole("button", { name: "Change creator", exact: true }).click();
  await page.getByRole("textbox", { name: "Search creator clips" }).fill("brown hair");
  await expect(page.getByRole("radio", { name: "Wide-eyed discovery", exact: true })).toHaveCount(0);
  await expect(page.getByRole("radio", { name: "Quiet realization", exact: true })).toBeVisible();
  await page.getByRole("radio", { name: "Quiet realization", exact: true }).click();
  await page.getByRole("button", { name: "Filter: candid", exact: true }).click();
  await expect(page.getByRole("heading", { name: "0 available premade clips", exact: true })).toBeVisible();
  await expect(page.getByRole("radio", { name: "Quiet realization", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Use this creator" })).toBeDisabled();
  await page.getByRole("button", { name: "Clear filters", exact: true }).click();
  await expect(page.getByRole("radio", { name: "Wide-eyed discovery", exact: true })).toBeVisible();
  await expect(page.getByRole("radio", { name: "Quiet realization", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Use this creator" })).toBeDisabled();
  expect(studioErrors).toEqual([]);
  await page.getByRole("tab", { name: "Describe your creator", exact: true }).click();
  await page.getByRole("textbox", { name: "Creator prompt" }).fill("An adult creator quietly smiling in a casual iPhone selfie at home");
  await expect(page.getByRole("button", { name: "Find creative angles" })).toHaveCount(0);
  await page.getByRole("button", { name: "Continue to captions" }).click();
  await expect(page.getByText("How many creative angles?", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Your app demos are mixed in automatically", { exact: true })).toHaveCount(0);
  await expect(page.getByTestId("studio-step-body")).toHaveCSS("opacity", "1");
  await page.screenshot({ path: "/tmp/growthbanana-studio-captions.png", fullPage: true });
  await expect(page.getByRole("button", { name: "Find creative angles" })).toBeDisabled();
  await page.getByRole("checkbox", { name: "Approve paid generation" }).click();
  expect(studioGenerations).toBe(0); // Early approval alone never submits a paid job.
  await page.getByRole("button", { name: "Find creative angles" }).click();
  await expect(page.getByRole("button", { name: "Toss angle 1", exact: true })).toBeVisible();
  await expect(page.getByText("ANGLE 1 OF 3", { exact: true })).toHaveCount(0);
  await expect(page.getByText("0 kept", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Angle 1", { exact: true })).toHaveCount(0);
  await expect(page.getByTestId("swipe-decision-card").getByText("Busy students", { exact: true })).toBeVisible();
  await expect(page.getByTestId("swipe-decision-card").getByText("Relatable", { exact: true })).toBeVisible();
  await expect(page.getByTestId("swipe-decision-card").getByText("POST CAPTION", { exact: true })).toHaveCount(0);
  await expect(page.getByTestId("studio-step-body")).toHaveCSS("opacity", "1");
  await page.screenshot({ path: "/tmp/growthbanana-studio-angles.png", fullPage: true });
  await page.getByRole("button", { name: "Toss angle 1", exact: true }).click();
  await expect(page.getByRole("button", { name: "Keep angle 2", exact: true })).toBeEnabled();
  const studioCard = page.getByTestId("studio-step-body").getByTestId("swipe-decision-card");
  const angleBounds = (await studioCard.boundingBox())!;
  const bodyBeforeSwipe = (await page.getByTestId("studio-step-body").boundingBox())!;
  await page.mouse.move(angleBounds.x + angleBounds.width * 0.2, angleBounds.y + 100);
  await page.mouse.down();
  await page.mouse.move(angleBounds.x + angleBounds.width * 0.7, angleBounds.y + 100, { steps: 12 });
  expect((await page.getByTestId("studio-step-body").boundingBox())!.x).toBeCloseTo(bodyBeforeSwipe.x, 0);
  expect((await studioCard.boundingBox())!.x).toBeGreaterThan(angleBounds.x + 50);
  await expect(studioCard.getByTestId("swipe-keep-sheen")).toHaveCSS("opacity", "1");
  await expect(studioCard.getByTestId("swipe-toss-sheen")).toHaveCSS("opacity", "0");
  await expect(studioCard.getByTestId("swipe-keep-sheen")).toHaveCSS("background-color", "rgba(14, 211, 105, 0.38)");
  await page.mouse.up();
  expect(studioGenerations).toBe(0); // Wait for all three decisions.
  await page.getByRole("button", { name: "Keep angle 3", exact: true }).click();
  await expect.poll(() => studioInputs.length).toBe(2);
  await expect(page.getByRole("button", { name: "Continue to produce" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Create 2 videos", exact: true })).toHaveCount(0);
  await expect(page.getByText("YOUR SHORTLIST", { exact: true })).toHaveCount(0);
  expect(studioInputs.map((input) => input.id)).toEqual(["20000000-0000-4000-8000-000000000001", "20000000-0000-4000-8000-000000000002"]);
  expect(studioInputs[0].savedCreatorJobId).toBeUndefined();
  expect(studioInputs[1].savedCreatorJobId).toBe(studioInputs[0].id);
  await expect(page.getByTestId("content-making-loader")).toBeVisible();
  await expect(page.getByText("assembling local", { exact: true })).toHaveCount(0);
  await expect(page.getByText("queued", { exact: true })).toHaveCount(0);
  await page.screenshot({ path: "/tmp/growthbanana-making.png", fullPage: true });
  studioFinished = true;
  await expect(page.getByText("Variation 1 of 2", { exact: true })).toBeVisible();
  await expect(page.getByTestId("content-making-loader")).toHaveCount(0);
  await expect(page.locator('video[src^="https://media.test/studio-"]')).toHaveCount(1);
  await page.getByRole("button", { name: "Next variation", exact: true }).click();
  await expect(page.getByText("Variation 2 of 2", { exact: true })).toBeVisible();
  await expect(page.locator(`video[src="https://media.test/studio-${studioInputs[1].id}.mp4"]`)).toBeVisible();
  await expect(page.getByRole("button", { name: "Edit these captions", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Edit captions", exact: true })).toHaveCSS("position", "absolute");
  await page.screenshot({ path: "/tmp/growthbanana-results.png", fullPage: true });
  await page.getByRole("button", { name: "Create something new", exact: true }).click();
  await page.getByRole("button", { name: "Continue to captions" }).click();
  await page.getByRole("checkbox", { name: "Approve paid generation" }).click();
  await page.getByRole("button", { name: "Find creative angles" }).click();
  for (const number of [1, 2, 3]) await page.getByRole("button", { name: `Toss angle ${number}`, exact: true }).click();
  await expect(page.getByRole("button", { name: "Try a different direction" })).toBeVisible();
  expect(studioGenerations).toBe(2); // All tossed means no production at all.
  await page.getByRole("tab", { name: "Library", exact: true }).click();
  await page.getByRole("tab", { name: "All", exact: true }).click();
  await expect(page.getByRole("button", { name: "Open 2 caption variations", exact: true })).toHaveCount(1);
  await page.getByRole("button", { name: "View 2 caption variations", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Caption variations", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Back to Library", exact: true })).toHaveCSS("border-radius", "24px");
  await page.getByRole("button", { name: "Choose variation 2", exact: true }).click();
  await expect(page.getByText("Variation 2 of 2", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Download video", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Edit captions", exact: true })).toBeVisible();
  await page.screenshot({ path: "/tmp/growthbanana-variations.png", fullPage: true });
  await page.getByRole("button", { name: "Back to Library", exact: true }).click();
  await page.getByRole("tab", { name: "Home", exact: true }).click();
  await page.getByTestId("discover-feed").filter({ visible: true }).evaluate((element) => { element.scrollTop = element.scrollHeight; });
  await page.getByRole("button", { name: "Yes, explore 5 more", exact: true }).click();
  await expect(page.getByRole("button", { name: "Save Content: Discover 6", exact: true })).toBeEnabled();
  await expect(page.getByTestId("swipe-hand-hint")).toHaveCount(0);
  expect(discoverStarts).toBe(2);
  await page.getByTestId("discover-feed").filter({ visible: true }).evaluate((element) => { element.scrollTop = 0; });
  await expect(page.getByRole("button", { name: "Save Content: Discover 1", exact: true })).toBeEnabled();
  await page.getByRole("tab", { name: "Library", exact: true }).click();
  await page.getByRole("button", { name: "View 2 caption variations", exact: true }).click();
  await page.getByRole("button", { name: "Choose variation 2", exact: true }).click();
  const selectedVideoUrl = await page.locator('video[src^="https://media.test/studio-"]').first().getAttribute("src");
  const selectedInput = studioInputs.find((input) => selectedVideoUrl === `https://media.test/studio-${input.id}.mp4`)!;
  await page.getByRole("button", { name: "Edit captions", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Hook caption", exact: true })).toHaveValue(String(selectedInput.hook));
  await page.getByRole("textbox", { name: "Hook caption", exact: true }).fill("my new hook");
  await page.getByRole("textbox", { name: "Demo caption", exact: true }).fill("my new demo caption");
  await page.getByRole("button", { name: "Regenerate video", exact: true }).click();
  await expect.poll(() => studioInputs.length).toBe(3);
  expect(studioInputs[2]).toMatchObject({ reuseJobId: selectedInput.id, hook: "my new hook", demoCaption: "my new demo caption" });
  for (const field of ["creatorId", "savedCreatorJobId", "uploadId"]) expect(studioInputs[2][field]).toBeUndefined();
  await expect(page.getByText("Your video is ready", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Edit captions", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Hook caption", exact: true })).toHaveValue("my new hook");
});
