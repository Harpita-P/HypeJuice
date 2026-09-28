import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { AppState } from "react-native";
import type { PurchasesPackage } from "react-native-purchases";
import { type BillingStatus, type PlanId, PLANS } from "@shared/billing";
import { useAuth } from "./AuthContext";
import { getBillingStatus } from "@/lib/billing-api";
import { purchaseEnvironment, purchaseWasCancelled, withPurchases } from "@/lib/purchases";

type Billing = {
  status: BillingStatus | null; loading: boolean; busy: boolean; error: string; notice: string;
  packages: Partial<Record<"pro" | "power", PurchasesPackage>>;
  refresh: () => Promise<void>; purchase: (tier: Exclude<PlanId, "free">) => Promise<void>;
  restore: () => Promise<void>; manage: () => Promise<void>;
};
const Context = createContext<Billing | null>(null);
export const useBilling = () => { const value = useContext(Context); if (!value) throw new Error("BillingProvider is missing."); return value; };

export function BillingProvider({ children }: { children: ReactNode }) {
  const { userId } = useAuth();
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [packages, setPackages] = useState<Billing["packages"]>({});
  const [productsVersion, setProductsVersion] = useState(0);
  const mounted = useRef(true);
  const working = useRef(false);
  const sequence = useRef(0);
  const refresh = useCallback(async () => {
    const request = ++sequence.current;
    try {
      const value = await getBillingStatus();
      if (!mounted.current || request !== sequence.current) return;
      setStatus(value); setError("");
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
    if (!appUserId || !purchaseEnvironment().available) return;
    let active = true; let remove: (() => void) | undefined;
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
    }).catch(() => { if (active) setError("Couldn’t load subscription products. Check RevenueCat’s current offering and retry."); });
    return () => { active = false; remove?.(); };
  }, [status?.appUserId, refresh, productsVersion]);

  async function act(kind: "purchase" | "restore" | "manage", tier?: "pro" | "power") {
    if (working.current || !status) return;
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
        await refresh();
        if (kind !== "manage") setNotice(kind === "restore" ? "Restore checked. Your verified plan is shown above." : "Purchase flow completed. Your plan unlocks once server verification succeeds.");
      }
    } catch (reason) {
      if (mounted.current && !purchaseWasCancelled(reason)) setError(reason instanceof Error ? reason.message : "The purchase couldn’t finish. Restore or refresh before trying again.");
    } finally { working.current = false; if (mounted.current) setBusy(false); }
  }
  return <Context.Provider value={{ status, loading, busy, error, notice, packages, refresh: async () => { setProductsVersion((value) => value + 1); await refresh(); }, purchase: (tier) => act("purchase", tier), restore: () => act("restore"), manage: () => act("manage") }}>{children}</Context.Provider>;
}
