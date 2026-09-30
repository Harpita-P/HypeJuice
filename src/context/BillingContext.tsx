import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { AppState, Platform } from "react-native";
import type { PurchasesPackage } from "react-native-purchases";
import { type BillingStatus, type PlanId, PLANS } from "@shared/billing";
import { useAuth } from "./AuthContext";
import { getBillingStatus } from "@/lib/billing-api";
import { purchaseEnvironment, purchaseWasCancelled, withPurchases } from "@/lib/purchases";

type Billing = {
  status: BillingStatus | null; loading: boolean; productsLoading: boolean; busy: boolean; error: string; notice: string;
  packages: Partial<Record<"pro" | "power", PurchasesPackage>>;
  plusTrialEligible: boolean;
  refresh: () => Promise<void>; purchase: (tier: Exclude<PlanId, "free">) => Promise<boolean>;
  restore: () => Promise<boolean>; manage: () => Promise<boolean>;
};
const Context = createContext<Billing | null>(null);
export const useBilling = () => { const value = useContext(Context); if (!value) throw new Error("BillingProvider is missing."); return value; };

export function BillingProvider({ children }: { children: ReactNode }) {
  const { userId } = useAuth();
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [productsLoading, setProductsLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [packages, setPackages] = useState<Billing["packages"]>({});
  const [plusTrialEligible, setPlusTrialEligible] = useState(false);
  const [productsVersion, setProductsVersion] = useState(0);
  const mounted = useRef(true);
  const working = useRef(false);
  const sequence = useRef(0);
  const refresh = useCallback(async () => {
    const request = ++sequence.current;
    setLoading(true);
    try {
      const value = await getBillingStatus();
      if (!mounted.current || request !== sequence.current) return;
      setStatus(value); setError("");
      return value;
    } catch (reason) {
      if (mounted.current && request === sequence.current) { setStatus(null); setError(reason instanceof Error ? reason.message : "Couldn’t check your plan."); }
    } finally { if (mounted.current && request === sequence.current) setLoading(false); }
  }, []);
  useEffect(() => {
    mounted.current = true; void refresh();
    const listener = AppState.addEventListener("change", (state) => { if (state === "active") void refresh(); });
    const timer = setInterval(() => { if (AppState.currentState === "active") void refresh(); }, 60000);
    return () => { mounted.current = false; sequence.current++; listener.remove(); clearInterval(timer); };
  }, [refresh, userId]);
  useEffect(() => {
    const appUserId = status?.appUserId;
    if (!appUserId || !purchaseEnvironment().available) { setProductsLoading(false); return; }
    let active = true; let remove: (() => void) | undefined;
    setPackages({}); setPlusTrialEligible(false); setProductsLoading(true);
    void withPurchases(appUserId, async (sdk) => {
      if (!active) return;
      const listener = () => { if (active) void refresh(); };
      sdk.addCustomerInfoUpdateListener(listener);
      remove = () => { sdk.removeCustomerInfoUpdateListener(listener); };
      const offerings = await sdk.getOfferings();
      await sdk.getCustomerInfo();
      if (!active) return;
      const available = offerings.current?.availablePackages ?? [];
      setPackages(Object.fromEntries((["pro", "power"] as const).map((tier) => [tier, available.find((item) => item.identifier === PLANS[tier].packageId && item.product.subscriptionPeriod === "P1M")])));
      const plus = available.find((item) => item.identifier === PLANS.pro.packageId);
      if (plus && Platform.OS === "ios" && !purchaseEnvironment().testStore) {
        const eligibility = await sdk.checkTrialOrIntroductoryPriceEligibility([plus.product.identifier]);
        if (active) setPlusTrialEligible(eligibility[plus.product.identifier]?.status === 2);
      }
    }).catch(() => { if (active) setError("Couldn’t load subscription products. Check RevenueCat’s current offering and retry."); }).finally(() => { if (active) setProductsLoading(false); });
    return () => { active = false; remove?.(); };
  }, [status?.appUserId, refresh, productsVersion]);

  async function act(kind: "purchase" | "restore" | "manage", tier?: "pro" | "power") {
    if (working.current || !status) return false;
    working.current = true; setBusy(true); setError(""); setNotice("");
    try {
      await withPurchases(status.appUserId, async (sdk) => {
        if (!mounted.current) return;
        if (kind === "purchase") {
          const item = tier && packages[tier];
          if (!item) throw new Error("This plan isn’t configured in the current RevenueCat offering yet.");
          await sdk.purchasePackage(item);
        } else if (kind === "restore") await sdk.restorePurchases();
        else await sdk.showManageSubscriptions();
      });
      if (mounted.current) {
        const verified = await refresh();
        const unlocked = Boolean(verified?.verified && verified.tier !== "free");
        if (kind !== "manage") setNotice(unlocked ? "Pro is ready. Let’s make something great." : kind === "restore" ? "No active subscription was verified. Refresh your plan if you recently purchased." : "Purchase received. We’re checking your access. Tap Refresh plan if it hasn’t appeared yet.");
        return unlocked;
      }
    } catch (reason) {
      if (mounted.current && !purchaseWasCancelled(reason)) setError(reason instanceof Error ? reason.message : "The purchase couldn’t finish. Restore or refresh before trying again.");
    } finally { working.current = false; if (mounted.current) setBusy(false); }
    return false;
  }
  return <Context.Provider value={{ status, loading, productsLoading, busy, error, notice, packages, plusTrialEligible, refresh: async () => { setProductsVersion((value) => value + 1); await refresh(); }, purchase: (tier) => act("purchase", tier), restore: () => act("restore"), manage: () => act("manage") }}>{children}</Context.Provider>;
}
