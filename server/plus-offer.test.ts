import { describe, expect, it } from "vitest";
import type { PurchasesPackage } from "react-native-purchases";
import { plusOffer } from "../src/lib/plus-offer.js";

const item = (overrides = {}) => ({ product: { priceString: "$25.00", introPrice: null, ...overrides } }) as PurchasesPackage;
const live = { testStore: false, preview: false, platform: "ios", eligible: false };

describe("Pro paywall terms", () => {
  it("previews the intended offer without inventing an actual trial", () => {
    expect(plusOffer(undefined, { ...live, preview: true })).toMatchObject({ price: "$25", preview: true, showTrial: true, trial: false });
    expect(plusOffer(item(), { ...live, testStore: true })).toMatchObject({ preview: true, showTrial: true, trial: false, cta: "Start my 3 day free trial" });
  });
  it("uses store prices and only promises the configured trial for eligible iOS customers", () => {
    const product = item({ priceString: "€24.99", introPrice: { price: 0, period: "P3D", cycles: 1 } });
    expect(plusOffer(product, { ...live, eligible: true })).toMatchObject({ price: "€24.99", trial: true, preview: false, cta: "Start my 3 day free trial" });
    expect(plusOffer(product, live)).toMatchObject({ showTrial: false, cta: "Get Pro" });
    expect(plusOffer(item({ introPrice: { price: 5, period: "P3D", cycles: 1 } }), { ...live, eligible: true }).trial).toBe(false);
    expect(plusOffer(item({ introPrice: { price: 0, period: "P7D", cycles: 1 } }), { ...live, eligible: true }).trial).toBe(false);
  });
  it("reads the eligible Android default option rather than iOS eligibility", () => {
    expect(plusOffer(item({ defaultOption: { freePhase: { billingPeriod: { iso8601: "P3D" }, price: { amountMicros: 0 } } } }), { ...live, platform: "android" }).trial).toBe(true);
    expect(plusOffer(item(), { ...live, platform: "android" }).trial).toBe(false);
  });
  it("never invents a live price or trial when the offering is missing", () => {
    expect(plusOffer(undefined, live)).toMatchObject({ price: null, preview: false, trial: false, showTrial: false });
  });
});
