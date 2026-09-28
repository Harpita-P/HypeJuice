import Constants, { ExecutionEnvironment } from "expo-constants";
import { Platform } from "react-native";
import type Purchases from "react-native-purchases";

export function purchaseEnvironment(): { available: boolean; testStore: boolean; message: string; key?: string } {
  if (Platform.OS !== "ios" && Platform.OS !== "android") return { available: false, testStore: false, message: "Purchases are available in the mobile app." };
  const test = __DEV__ ? process.env.EXPO_PUBLIC_REVENUECAT_TEST_API_KEY?.trim() : undefined;
  const key = test || (Platform.OS === "ios" ? process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY : process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY)?.trim();
  if (!key || /placeholder|your_/i.test(key)) return { available: false, testStore: false, message: "RevenueCat setup pending. You can keep developing without configuring purchases yet." };
  if (!/^(test_|appl_|goog_)/.test(key) || (!__DEV__ && key.startsWith("test_"))) return { available: false, testStore: false, message: "Use the platform’s public RevenueCat SDK key. Test Store keys are restricted to development builds." };
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return { available: false, testStore: key.startsWith("test_"), message: "Expo Go keeps the app usable. Purchase testing will be enabled in a development build later." };
  return { available: true, testStore: key.startsWith("test_"), key, message: key.startsWith("test_") ? "Test Store · simulated purchases, no subscription charge." : "Subscriptions managed by your app store." };
}

let queue: Promise<unknown> = Promise.resolve();
// Serialize identity changes and purchase operations across account switches.
// No anonymous/device entitlement is ever treated as backend authorization.
export function withPurchases<T>(appUserId: string, work: (sdk: typeof Purchases) => Promise<T>): Promise<T> {
  const task = queue.catch(() => {}).then(async () => {
    const environment = purchaseEnvironment();
    if (!environment.available || !environment.key) throw new Error(environment.message);
    const { default: sdk, LOG_LEVEL } = await import("react-native-purchases");
    if (!await sdk.isConfigured()) {
      await sdk.setLogLevel(LOG_LEVEL.ERROR);
      sdk.configure({ apiKey: environment.key, appUserID: appUserId });
    } else if (await sdk.getAppUserID() !== appUserId) await sdk.logIn(appUserId);
    return work(sdk);
  });
  queue = task; return task;
}
export function purchaseWasCancelled(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "userCancelled" in error && error.userCancelled === true);
}
