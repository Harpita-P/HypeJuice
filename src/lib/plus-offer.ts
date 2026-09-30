import type { PurchasesPackage } from "react-native-purchases";

// Preview copy is never evidence of a trial or an entitlement. Actual purchases
// always use the package returned by RevenueCat and verified backend access.
export function plusOffer(item: PurchasesPackage | undefined, options: {
  testStore: boolean; preview: boolean; platform: string; eligible: boolean;
}) {
  const product = item?.product;
  const intro = product?.introPrice;
  const freePhase = product?.defaultOption?.freePhase;
  const trial = options.platform === "android"
    ? freePhase?.billingPeriod.iso8601 === "P3D" && freePhase.price.amountMicros === 0
    : options.eligible && intro?.price === 0 && intro.period === "P3D" && intro.cycles === 1;
  const preview = options.testStore || (!item && options.preview);
  return {
    trial: Boolean(trial),
    preview,
    showTrial: preview || Boolean(trial),
    price: product?.priceString ?? (preview ? "$25" : null),
    cta: trial || preview ? "Start my 3 day free trial" : "Get Pro",
  };
}
