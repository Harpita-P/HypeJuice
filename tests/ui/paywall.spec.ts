import { expect, test } from "@playwright/test";

test("Get Started opens Pro and never bypasses checkout when products are unavailable", async ({ page }) => {
  await page.route("**/api/**", (route) => route.fulfill({ status: 404, json: { error: "No live APIs" } }));
  await page.route("**/api/billing/status", (route) => route.fulfill({ json: { appUserId: "paywall-fixture", tier: "free", enforced: false, verified: false, studioAccess: true, checkedAt: new Date().toISOString() } }));
  // Never make a real RevenueCat request, even if the developer has a Test Store key.
  await page.route(/https:\/\/[^/]*revenuecat\.com\//, (route) => route.abort());
  await page.route("**/storage/v1/object/public/hypejuice-showcase/**", (route) => route.abort());
  await page.goto("/");
  await page.getByRole("button", { name: "Get Started", exact: true }).click();
  await expect(page.getByText("Pro Plan", { exact: true })).toBeVisible();
  await expect(page.getByText("3 DAYS FREE", { exact: true })).toBeVisible();
  await expect(page.getByText("Then $25 / month", { exact: true })).toBeVisible();
  await expect(page.getByText(/Connect RevenueCat|setup pending|Check the current offering|must be configured|Add a Test Store key/i)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Start my 3 day free trial", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Choose Pro plan", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Continue with Free", exact: true })).toHaveCount(0);
  await page.screenshot({ path: "/tmp/hypejuice-plus-paywall.png" });
  await page.getByRole("button", { name: "Back to welcome", exact: true }).click();
  await page.getByRole("button", { name: "Get Started", exact: true }).click();
  await expect(page.getByRole("button", { name: "Start my 3 day free trial", exact: true })).toBeDisabled();
  await expect(page).toHaveURL(/\/paywall$/);
});

test("verified subscribers can continue without purchasing again", async ({ page }) => {
  await page.route("**/api/**", (route) => route.fulfill({ status: 404, json: {} }));
  await page.route("**/api/billing/status", (route) => route.fulfill({ json: { appUserId: "paywall-fixture", tier: "pro", enforced: true, verified: true, studioAccess: true, checkedAt: new Date().toISOString() } }));
  await page.route(/https:\/\/[^/]*revenuecat\.com\//, (route) => route.abort());
  await page.goto("/paywall");
  await expect(page.getByText("YOUR PLAN", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /Start my 3 day free trial|Test Pro subscription/ })).toHaveCount(0);
  await page.getByRole("button", { name: "Let’s get started", exact: true }).click();
  await expect(page.getByRole("button", { name: "Analyze with Growth Agent", exact: true })).toBeVisible();
});
