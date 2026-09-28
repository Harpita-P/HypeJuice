import { randomUUID } from "node:crypto";
import { z } from "zod";
import { type BillingStatus, type PlanId, PLANS } from "../shared/billing.js";
import { authenticatedMode, ownerId } from "./identity.js";
import { readRecord, saveRecord } from "./records.js";

export class BillingError extends Error {
  constructor(message: string, public status: 403 | 503) { super(message); }
}
// Only the explicitly opted-in local prototype can run without billing.
export function billingEnforced() {
  return authenticatedMode() || process.env.NODE_ENV === "production" || process.env.REVENUECAT_ENFORCE_ENTITLEMENTS === "true";
}
async function billingUserId() {
  if (authenticatedMode()) return ownerId();
  const key = "billing-identity.json";
  const saved = await readRecord<{ appUserId: string }>(key);
  if (saved) return saved.appUserId;
  return (await saveRecord(key, { appUserId: `gb-local-${randomUUID()}` }, true)).appUserId;
}
const Entitlement = z.object({ product_identifier: z.string(), expires_date: z.string().nullable(), grace_period_expires_date: z.string().nullable().optional() });
const Subscription = z.object({ is_sandbox: z.boolean(), refunded_at: z.string().nullable().optional(), store: z.string().optional() });
const Subscriber = z.object({
  entitlements: z.record(z.string(), Entitlement),
  subscriptions: z.record(z.string(), Subscription).default({}),
});

export function verifiedTier(value: unknown, allowSandbox: boolean, now = Date.now()): PlanId {
  const subscriber = Subscriber.parse(value);
  for (const tier of ["power", "pro"] as const) {
    const entitlement = subscriber.entitlements[PLANS[tier].entitlement];
    if (!entitlement) continue;
    const purchase = subscriber.subscriptions[entitlement.product_identifier];
    // These plans are subscriptions; don't infer access from an unknown product
    // or accept Test Store/sandbox purchases on the production backend.
    if (!purchase || purchase.refunded_at || (!allowSandbox && (purchase.is_sandbox || purchase.store === "test_store"))) continue;
    const expiration = Math.max(Date.parse(entitlement.expires_date ?? ""), 0);
    const grace = entitlement.grace_period_expires_date ? Date.parse(entitlement.grace_period_expires_date) : 0;
    if (entitlement.expires_date === null || expiration > now || grace > now) return tier;
  }
  return "free";
}

export async function billingStatus(): Promise<BillingStatus> {
  const enforced = billingEnforced();
  const appUserId = await billingUserId();
  const key = process.env.REVENUECAT_SECRET_API_KEY?.trim();
  const base = { appUserId, enforced, checkedAt: new Date().toISOString() };
  if (!key || /placeholder|your_/i.test(key)) {
    if (enforced) throw new BillingError("Subscription verification is not configured on the server.", 503);
    return { ...base, tier: "free", studioAccess: true, verified: false };
  }
  try {
    const response = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(appUserId)}`, {
      headers: { Authorization: `Bearer ${key}`, Accept: "application/json" }, signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error("Verification unavailable");
    const body = await response.json();
    const allowSandbox = process.env.NODE_ENV !== "production" && process.env.REVENUECAT_ALLOW_SANDBOX === "true";
    const tier = verifiedTier(body.subscriber, allowSandbox);
    return { ...base, tier, studioAccess: !enforced || tier !== "free", verified: true };
  } catch { throw new BillingError("Couldn’t verify your subscription. Retry shortly; no new video was started.", 503); }
}
export async function requireStudioAccess() {
  if (!billingEnforced()) return;
  if (!(await billingStatus()).studioAccess) throw new BillingError("Studio requires a Pro or Power subscription.", 403);
}
