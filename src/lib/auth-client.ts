import { createClient } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

export const localAuthMode = __DEV__ && process.env.EXPO_PUBLIC_AUTH_MODE === "local";
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
// Native sessions stay in Keychain/Keystore. Chunk large tokens without falling back to plaintext.
const secureStorage = {
  async getItem(key: string) {
    const manifest = await SecureStore.getItemAsync(`${key}.manifest`);
    if (!manifest) return null;
    const { version, count } = JSON.parse(manifest);
    const parts = await Promise.all(Array.from({ length: count }, (_, i) => SecureStore.getItemAsync(`${key}.${version}.${i}`)));
    return parts.some((part) => part === null) ? null : parts.join("");
  },
  async setItem(key: string, value: string) {
    const old = await SecureStore.getItemAsync(`${key}.manifest`);
    const version = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const parts = value.match(/[\s\S]{1,1500}/g) ?? [""];
    await Promise.all(parts.map((part, i) => SecureStore.setItemAsync(`${key}.${version}.${i}`, part, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY })));
    await SecureStore.setItemAsync(`${key}.manifest`, JSON.stringify({ version, count: parts.length }), { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
    if (old) { const previous = JSON.parse(old); await Promise.all(Array.from({ length: previous.count }, (_, i) => SecureStore.deleteItemAsync(`${key}.${previous.version}.${i}`))).catch(() => {}); }
  },
  async removeItem(key: string) {
    const old = await SecureStore.getItemAsync(`${key}.manifest`);
    await SecureStore.deleteItemAsync(`${key}.manifest`);
    if (old) { const previous = JSON.parse(old); await Promise.all(Array.from({ length: previous.count }, (_, i) => SecureStore.deleteItemAsync(`${key}.${previous.version}.${i}`))); }
  },
};
export const authClient = !localAuthMode && url && key ? createClient(url, key, {
  auth: { ...(Platform.OS !== "web" ? { storage: secureStorage } : {}), persistSession: Platform.OS !== "web", autoRefreshToken: true, detectSessionInUrl: false },
}) : null;
export async function authHeaders(expectedUser?: string): Promise<Record<string, string>> {
  if (localAuthMode) return {};
  const session = (await authClient?.auth.getSession())?.data.session;
  if (!session || (expectedUser && session.user.id !== expectedUser)) throw new Error("Sign in to continue.");
  return { Authorization: `Bearer ${session.access_token}` };
}
export const API_URL = (process.env.EXPO_PUBLIC_API_URL || "http://127.0.0.1:8787").replace(/\/$/, "");
export function requireSecureApi() { if (!__DEV__ && !API_URL.startsWith("https://")) throw new Error("Release builds require an HTTPS API address."); }
