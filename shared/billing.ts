export type PlanId = "free" | "pro" | "power";
export const PLANS = {
  free: { name: "Free", entitlement: null, packageId: null },
  pro: { name: "Pro", entitlement: "growth_pro", packageId: "growth_pro_monthly" },
  power: { name: "Power", entitlement: "growth_power", packageId: "growth_power_monthly" },
} as const;
export const paidPlans = ["pro", "power"] as const;
export type BillingStatus = {
  appUserId: string; tier: PlanId; studioAccess: boolean;
  enforced: boolean; verified: boolean; checkedAt: string;
};
export function tierFromEntitlements(active: Record<string, unknown>): PlanId {
  return active[PLANS.power.entitlement] ? "power" : active[PLANS.pro.entitlement] ? "pro" : "free";
}
