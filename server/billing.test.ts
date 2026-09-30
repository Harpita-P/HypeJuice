import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it, vi } from "vitest";
import { billingEnforced, billingStatus, requireStudioAccess, verifiedTier } from "./billing.js";
import { asUser } from "./identity.js";
import { app } from "./app.js";

const now = Date.parse("2026-09-28T12:00:00Z");
const future = "2026-10-28T12:00:00Z";
const past = "2026-09-01T12:00:00Z";
const subscriber = (expiration = future, sandbox = false) => ({ entitlements: { growth_pro: { product_identifier: "pro_monthly", expires_date: expiration } }, subscriptions: { pro_monthly: { is_sandbox: sandbox, refunded_at: null, store: "app_store" } } });
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("RevenueCat integration foundation (mock API only)", () => {
  it("resolves active tiers, expires access, honors grace and prefers Power", () => {
    expect(verifiedTier(subscriber(), false, now)).toBe("pro");
    expect(verifiedTier(subscriber(past), false, now)).toBe("free");
    const grace = subscriber(past);
    expect(verifiedTier({ ...grace, entitlements: { growth_pro: { ...grace.entitlements.growth_pro, grace_period_expires_date: future } } }, false, now)).toBe("pro");
    const both = subscriber();
    expect(verifiedTier({ ...both, entitlements: { ...both.entitlements, growth_power: { product_identifier: "power_monthly", expires_date: future } }, subscriptions: { ...both.subscriptions, power_monthly: { is_sandbox: false } } }, false, now)).toBe("power");
  });
  it("rejects sandbox access unless allowed, refunds, and malformed entitlement data", () => {
    expect(verifiedTier(subscriber(future, true), false, now)).toBe("free");
    expect(verifiedTier(subscriber(future, true), true, now)).toBe("pro");
    const refunded = { ...subscriber(), subscriptions: { pro_monthly: { is_sandbox: false, refunded_at: future } } };
    expect(verifiedTier(refunded, true, now)).toBe("free");
    expect(() => verifiedTier({ entitlements: { growth_pro: {} } }, false, now)).toThrow();
  });
  it("keeps unconfigured local development unlocked without pretending it is subscribed", async () => {
    vi.stubEnv("AUTH_MODE", "local"); vi.stubEnv("NODE_ENV", "test"); vi.stubEnv("REVENUECAT_ENFORCE_ENTITLEMENTS", "false"); vi.stubEnv("REVENUECAT_SECRET_API_KEY", "");
    const directory = await mkdtemp(join(tmpdir(), "growthbanana-billing-")); vi.stubEnv("STUDIO_DATA_DIR", directory);
    const network = vi.fn(); vi.stubGlobal("fetch", network);
    try {
      const first = await billingStatus();
      expect(first).toMatchObject({ tier: "free", enforced: false, verified: false, studioAccess: true });
      expect((await billingStatus()).appUserId).toBe(first.appUserId);
      expect(network).not.toHaveBeenCalled();
      vi.stubEnv("REVENUECAT_ENFORCE_ENTITLEMENTS", "true");
      await expect(requireStudioAccess()).rejects.toThrow("not configured");
    } finally { await rm(directory, { recursive: true, force: true }); }
  });
  it("verifies only the authenticated owner, rejects outages and never allows production sandbox", async () => {
    vi.stubEnv("AUTH_MODE", "supabase"); vi.stubEnv("NODE_ENV", "production"); vi.stubEnv("REVENUECAT_SECRET_API_KEY", "secret-for-test-only"); vi.stubEnv("REVENUECAT_ALLOW_SANDBOX", "true");
    const network = vi.fn().mockImplementation(async () => Response.json({ subscriber: subscriber("2099-10-28T00:00:00Z", true) })); vi.stubGlobal("fetch", network);
    const user = "10000000-0000-4000-8000-000000000001";
    expect(billingEnforced()).toBe(true);
    await asUser(user, async () => {
      expect(await billingStatus()).toMatchObject({ appUserId: user, tier: "free", studioAccess: false });
      expect(network.mock.calls[0][0]).toBe(`https://api.revenuecat.com/v1/subscribers/${user}`);
      await expect(requireStudioAccess()).rejects.toThrow("requires a Pro");
      network.mockRejectedValue(new Error("offline"));
      await expect(requireStudioAccess()).rejects.toThrow("Couldn’t verify");
    });
  });
  it("gates creator catalog and ideas before any generation while keeping status reads separate", async () => {
    vi.stubEnv("AUTH_MODE", "local"); vi.stubEnv("NODE_ENV", "test"); vi.stubEnv("REVENUECAT_ENFORCE_ENTITLEMENTS", "true"); vi.stubEnv("REVENUECAT_SECRET_API_KEY", "secret-for-test-only");
    vi.stubEnv("SUPABASE_URL", "https://test.supabase.co"); vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-key"); vi.stubEnv("STUDIO_ALLOW_UNAUTHENTICATED", "true");
    const directory = await mkdtemp(join(tmpdir(), "growthbanana-billing-route-")); vi.stubEnv("STUDIO_DATA_DIR", directory);
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => Response.json({ subscriber: { entitlements: {}, subscriptions: {} } })));
    try {
      expect((await app.request("/api/studio/creators")).status).toBe(403);
      expect((await app.request("/api/studio/ideas", { method: "POST", body: "{}" })).status).toBe(403);
    } finally { await rm(directory, { recursive: true, force: true }); }
  });
  it("returns a free identity for new RevenueCat customers so the SDK can configure", async () => {
    vi.stubEnv("AUTH_MODE", "supabase"); vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("REVENUECAT_SECRET_API_KEY", "test-secret");
    const network = vi.fn().mockResolvedValue(new Response("", { status: 404 }));
    vi.stubGlobal("fetch", network);
    await asUser("10000000-0000-4000-8000-000000000001", async () => {
      expect(await billingStatus()).toMatchObject({ tier: "free", verified: true, enforced: true, studioAccess: false });
      network.mockResolvedValue(new Response("", { status: 401 }));
      await expect(billingStatus()).rejects.toThrow("Couldn’t verify");
    });
  });
});
