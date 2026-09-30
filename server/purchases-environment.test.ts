import { afterEach, describe, expect, it, vi } from "vitest";
const device = vi.hoisted(() => ({ OS: "ios", executionEnvironment: "storeClient" }));
vi.mock("react-native", () => ({ Platform: device }));
vi.mock("expo-constants", () => ({ default: device, ExecutionEnvironment: { StoreClient: "storeClient" } }));
import { purchaseEnvironment, purchaseWasCancelled } from "../src/lib/purchases.js";
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); device.OS = "ios"; device.executionEnvironment = "storeClient"; });

describe("RevenueCat runtime safety", () => {
  it("allows Test Store in Expo Go and web during development", () => {
    vi.stubGlobal("__DEV__", true); vi.stubEnv("EXPO_PUBLIC_REVENUECAT_TEST_API_KEY", "test_fixture");
    expect(purchaseEnvironment()).toMatchObject({ available: true, testStore: true });
    device.OS = "web";
    expect(purchaseEnvironment()).toMatchObject({ available: true, testStore: true });
  });
  it("never selects a Test Store key in release", () => {
    vi.stubGlobal("__DEV__", false); vi.stubEnv("EXPO_PUBLIC_REVENUECAT_TEST_API_KEY", "test_fixture");
    vi.stubEnv("EXPO_PUBLIC_REVENUECAT_IOS_API_KEY", "");
    expect(purchaseEnvironment().available).toBe(false);
    vi.stubEnv("EXPO_PUBLIC_REVENUECAT_IOS_API_KEY", "test_fixture");
    expect(purchaseEnvironment().available).toBe(false);
  });
  it("rejects native store keys in Expo Go and handles cancellation", () => {
    vi.stubGlobal("__DEV__", true); vi.stubEnv("EXPO_PUBLIC_REVENUECAT_TEST_API_KEY", "");
    vi.stubEnv("EXPO_PUBLIC_REVENUECAT_IOS_API_KEY", "appl_fixture");
    expect(purchaseEnvironment().available).toBe(false);
    device.executionEnvironment = "bare";
    expect(purchaseEnvironment().available).toBe(true);
    expect(purchaseWasCancelled({ userCancelled: true })).toBe(true);
    expect(purchaseWasCancelled(new Error("offline"))).toBe(false);
  });
});
