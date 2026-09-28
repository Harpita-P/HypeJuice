import { expect, test } from "@playwright/test";
import type { BriefResponse } from "../../shared/app-brief";

const profile: BriefResponse = {
  analyzedAt: "2026-09-27T00:00:00.000Z", mode: "ai", warnings: [],
  demoClips: [{ id: "fixture-demo", name: "Demo.mov", localPath: "fixture-demo", storage: "browser", durationMs: 12000, width: 390, height: 844, sizeBytes: 16, shows: "Start a focus session", importedAt: "2026-09-27T00:00:00.000Z" }],
  sources: [{ kind: "app_store", title: "Focus Fox", url: "https://apps.apple.com/us/app/focus-fox/id123456", appStoreMedia: { iconUrl: "https://is1-ssl.mzstatic.com/icon.png", screenshotUrls: ["https://is1-ssl.mzstatic.com/one.png", "https://is1-ssl.mzstatic.com/two.png", "https://is1-ssl.mzstatic.com/three.png"] } }],
  brief: {
    appName: "Focus Fox", category: "Productivity", oneLiner: "A little focus. A lot more done.",
    summary: "Focus Fox helps busy founders choose one meaningful task, block distractions, and turn their best intentions into focused work sessions.",
    audiences: [{ segment: "Solo founders", situation: "Building something they love, with too many tabs open and too little uninterrupted time." }, { segment: "University students", situation: "Looking for a calmer way to stay on track during study sessions." }],
    problems: ["Too many distractions"], features: [{ name: "Focus timer", userOutcome: "Finish one meaningful task" }],
    messagingAngles: [{ name: "Before / after", hook: "One task at a time", promise: "Focus on what matters" }],
    tone: ["clear"], avoidClaims: [], unknowns: [],
  },
};

test.beforeEach(async ({ page }) => {
  // Public-media fixtures keep UI tests deterministic and never call Gemini.
  await page.route("https://*.mzstatic.com/**", (route) => route.fulfill({ contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="400"><rect width="200" height="400" rx="20" fill="#dfeaab"/><text x="20" y="50" font-family="sans-serif" font-size="16" fill="#28451f">FOCUS FOX</text><text x="20" y="95" font-family="sans-serif" font-size="24" font-weight="bold">Find your</text><text x="20" y="125" font-family="sans-serif" font-size="24" font-weight="bold">flow.</text><rect x="20" y="155" width="160" height="200" rx="20" fill="#fcfdf6"/><circle cx="100" cy="240" r="52" fill="#f2d548"/><text x="55" y="248" font-family="sans-serif" font-size="28">25:00</text></svg>' }));
});

test("reviews three concepts, browses Discover batches, and creates Studio content", async ({ page }) => {
  let paidSubmissions = 0;
  let renderedJob: Record<string, unknown>;
  await page.route("**/api/studio/config", (route) => route.fulfill({ json: { ready: true, missing: [], model: "bytedance/seedance-2.0/text-to-video" } }));
  await page.route("**/api/studio/uploads", (route) => route.fulfill({ json: { id: "mock-upload" } }));
  await page.route("**/api/studio/jobs", (route) => {
    const input = route.request().postDataJSON();
    paidSubmissions++;
    expect(input.approved).toBe(true);
    renderedJob = { id: input.id, input, status: "succeeded", createdAt: new Date().toISOString(), canReuse: true, videoUrl: "https://media.example.test/final.mp4" };
    return route.fulfill({ json: renderedJob });
  });
  await page.route("https://media.example.test/**", (route) => route.abort());
  let request: Record<string, string> = {};
  await page.route("**/api/app-brief", (route) => {
    request = route.request().postDataJSON();
    return route.fulfill({ json: profile });
  });
  await page.goto("/connect");
  // This test covers metadata/persistence, not video decoding or native picking.
  await page.evaluate(() => new Promise<void>((resolve, reject) => {
    const request = indexedDB.open("growthbanana-demo-clips", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("clips");
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction("clips", "readwrite");
      transaction.objectStore("clips").put(new Blob(["fixture-metadata"], { type: "video/quicktime" }), "fixture-demo");
      transaction.oncomplete = () => { db.close(); resolve(); };
      transaction.onerror = () => { db.close(); reject(transaction.error); };
    };
  }));
  await expect(page.getByRole("radio", { name: "Use App Store link" })).toBeChecked();
  await page.getByRole("textbox", { name: "App Store link", exact: true }).fill(profile.sources[0].url!);
  await page.screenshot({ path: "test-results/connect.png", fullPage: true });
  await page.getByRole("button", { name: "Analyze with Growth Agent" }).click();
  await expect(page.getByText("Focus Fox", { exact: true }).first()).toBeVisible();
  expect(request.websiteUrl).toBe("");
  await expect(page.getByRole("img", { name: "Focus Fox app icon" }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "View Focus Fox screenshot 1" })).toBeVisible();
  await page.screenshot({ path: "test-results/brief-app.png", fullPage: true });
  await page.getByRole("button", { name: "View Focus Fox screenshot 1" }).click();
  await expect(page.getByRole("button", { name: "Close screenshot" })).toBeVisible();
  await page.getByRole("button", { name: "Close screenshot" }).click();

  await page.getByRole("button", { name: "Edit app details" }).click();
  await page.getByRole("textbox", { name: "App name", exact: true }).fill("Focus Fox Studio");
  await page.getByRole("dialog").getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Focus Fox Studio", { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "Step 2 · App in action" }).click();
  await page.getByRole("button", { name: "Step 3 · Content Taste" }).click();
  await expect(page.getByLabel("Step 3 of 3: Content Taste", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Open my workspace" })).toBeDisabled();
  await page.getByRole("button", { name: "Edit The discovery", exact: true }).click();
  await page.getByRole("textbox", { name: "Creator hook caption" }).fill("A tiny focus ritual worth trying");
  await page.getByRole("dialog").getByRole("button", { name: "Save changes" }).click();
  await page.getByRole("button", { name: "Love The discovery", exact: true }).click();
  await page.getByRole("button", { name: "Toss The everyday switch", exact: true }).click();
  await page.getByRole("button", { name: "Love Show, don’t tell", exact: true }).click();
  await page.getByRole("button", { name: "Open my workspace" }).click();
  await expect(page.getByRole("heading", { name: "Discover", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Save A little discovery", exact: true }).click();
  for (const title of ["A little discovery", "The daily ritual", "Worth a closer look", "Try this with me", "The small switch"]) {
    await page.getByRole("button", { name: "Ignore " + title, exact: true }).click();
  }
  await expect(page.getByRole("heading", { name: "Want some more fresh content?" })).toBeVisible();
  await page.getByRole("button", { name: "Yes, give me 5 more" }).click();
  await expect(page.getByRole("button", { name: "Save A fresh perspective", exact: true })).toBeVisible();
  await page.getByText("Library", { exact: true }).click();
  await expect(page.getByRole("tab", { name: "All", exact: true })).toHaveText("All · 13");
  await page.getByRole("tab", { name: "Saved", exact: true }).click();
  await expect(page.getByRole("button", { name: "Open A little discovery", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Open The discovery", exact: true }).click();
  await page.getByRole("button", { name: "Edit The discovery", exact: true }).click();
  await expect(page.getByRole("radio")).toHaveCount(0);
  await page.getByRole("textbox", { name: "Creator hook caption" }).fill("A new caption, same footage");
  await page.getByRole("dialog").getByRole("button", { name: "Save changes" }).click();
  await page.getByRole("button", { name: "Back to Library" }).click();
  await page.getByText("Launch Bucket", { exact: true }).click();
  await expect(page.getByText("2 items in your bucket", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "The discovery", exact: true }).locator("..").getByText("A new caption, same footage", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Plan The discovery", exact: true }).click();
  await page.getByRole("textbox", { name: "Posting date" }).fill("2099-12-01");
  await page.getByRole("textbox", { name: "Posting time" }).fill("14:30");
  await page.getByRole("dialog").getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText(/Draft plan · not scheduled/)).toBeVisible();
  await page.getByRole("tab", { name: "Studio", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Studio access code" })).toHaveCount(0);
  await page.getByRole("textbox", { name: "Creator prompt" }).fill("A candid desk reaction");
  await page.getByRole("textbox", { name: "Hook caption", exact: true }).fill("A focus ritual worth trying");
  await expect(page.getByRole("button", { name: "Generate 1 video" })).toBeDisabled();
  expect(paidSubmissions).toBe(0);
  await page.getByRole("checkbox", { name: "Approve paid generation" }).click();
  await page.getByRole("button", { name: "Generate 1 video" }).click();
  await expect(page.getByRole("heading", { name: "Your video is ready" })).toBeVisible();
  expect(paidSubmissions).toBe(1);
  await page.getByText("Library", { exact: true }).click();
  await page.getByRole("tab", { name: "All", exact: true }).click();
  await expect(page.getByRole("tab", { name: "All", exact: true })).toHaveText("All · 14");
  await page.getByRole("tab", { name: "Studio filter", exact: true }).click();
  await expect(page.getByRole("button", { name: "Open Your studio video", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Open The discovery", exact: true })).toHaveCount(0);
  await page.getByRole("tab", { name: "Your App", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Your App", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Focus Fox Studio", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Your app’s story", exact: true })).toBeVisible();
  await expect(page.getByRole("tab", { name: "App Impact", exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("button", { name: "Analyze with Growth Agent" })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("growthbanana.app-profile.v1"))).toBeNull();
});

test("website selection submits only its link and displays no media gallery", async ({ page }) => {
  let request: Record<string, string> = {};
  await page.route("**/api/app-brief", (route) => {
    request = route.request().postDataJSON();
    return route.fulfill({ json: { ...profile, sources: [{ kind: "website", title: "Focus Fox", url: "https://example.com" }] } });
  });
  await page.goto("/connect");
  await page.getByRole("textbox", { name: "App Store link", exact: true }).fill("https://apps.apple.com/us/app/other/id123456");
  await page.getByRole("radio", { name: "Use website link" }).click();
  await page.getByRole("textbox", { name: "Website link", exact: true }).fill("https://example.com");
  await page.getByRole("button", { name: "Analyze with Growth Agent" }).click();
  await expect(page.getByText("Focus Fox", { exact: true }).first()).toBeVisible();
  expect(request.appStoreUrl).toBe("");
  expect(request.websiteUrl).toBe("https://example.com");
  await expect(page.getByText("A LOOK INSIDE")).toHaveCount(0);
  await expect(page.getByRole("img", { name: /app icon/ })).toHaveCount(0);
});

test("fresh launches discard legacy saved app profiles", async ({ page }) => {
  await page.addInitScript((saved) => localStorage.setItem("growthbanana.app-profile.v1", JSON.stringify(saved)), { ...profile, sources: [{ kind: "app_store", title: "Focus Fox", url: profile.sources[0].url }] });
  await page.goto("/brief");
  await expect(page.getByText("Let’s meet your app first.")).toBeVisible();
  await expect(page.getByText("Focus Fox", { exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem("growthbanana.app-profile.v1"))).toBeNull();
});

test("learning panel leads to one Step 1 review with a pinned next step", async ({ page }) => {
  let complete!: () => void;
  const pending = new Promise<void>((resolve) => { complete = resolve; });
  await page.route("**/api/app-brief", async (route) => { await pending; await route.fulfill({ json: profile }); });
  await page.goto("/connect");
  await page.getByRole("textbox", { name: "App Store link", exact: true }).fill(profile.sources[0].url!);
  await page.getByRole("button", { name: "Analyze with Growth Agent" }).click();
  await expect(page.getByRole("heading", { name: "I’m learning about your app…" })).toBeVisible();
  complete();
  await expect(page.getByText("Focus Fox", { exact: true }).first()).toBeVisible();
  await expect(page.getByLabel("Step 1 of 3: Share what you built", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Turn to app story" })).toHaveCount(0);
  await page.getByText("Your app’s story", { exact: true }).scrollIntoViewIfNeeded();
  await expect(page.getByRole("button", { name: "Step 2 · App in action" })).toBeInViewport();
  await page.getByRole("button", { name: "Step 2 · App in action" }).click();
  await expect(page.getByLabel("Step 2 of 3: Show how it works", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Previous step" }).click();
  await expect(page.getByLabel("Step 1 of 3: Share what you built", { exact: true })).toBeVisible();
});

test("hides screenshot galleries when every image fails", async ({ page }) => {
  await page.route("https://*.mzstatic.com/**", (route) => route.abort());
  await page.route("**/api/app-brief", (route) => route.fulfill({ json: profile }));
  await page.goto("/connect");
  await page.getByRole("textbox", { name: "App Store link", exact: true }).fill(profile.sources[0].url!);
  await page.getByRole("button", { name: "Analyze with Growth Agent" }).click();
  await expect(page.getByText("Focus Fox", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("A LOOK INSIDE")).toHaveCount(0);
  await expect(page.getByRole("img", { name: /app icon/ })).toHaveCount(0);
});
