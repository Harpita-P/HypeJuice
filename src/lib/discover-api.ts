import { fetch } from "expo/fetch";
import type { DiscoverBatch, DiscoverConfig, DiscoverRequest } from "@shared/discover";
import type { CaptionFeedback, FeedbackRequest } from "@shared/feedback";
import { authHeaders, requireSecureApi } from "./auth-client";

const API = (process.env.EXPO_PUBLIC_API_URL ?? "http://127.0.0.1:8787").replace(/\/$/, "");
async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  requireSecureApi();
  const response = await fetch(`${API}/api/discover${path}`, { ...options, headers: { ...await authHeaders(), ...options.headers } });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "Discover request failed.");
  return body as T;
}
export const getDiscoverConfig = () => request<DiscoverConfig>("/config");
export const getDiscoverBatches = (profileKey: string, onboardingId?: string, demosKey?: string) => request<DiscoverBatch[]>(`/batches?profileKey=${encodeURIComponent(profileKey)}${onboardingId ? `&onboardingId=${encodeURIComponent(onboardingId)}` : ""}${demosKey ? `&demoSetKey=${encodeURIComponent(demosKey)}` : ""}`);
export const getDiscoverBatch = (id: string) => request<DiscoverBatch>(`/batches/${encodeURIComponent(id)}`);
export const startDiscoverBatch = (input: DiscoverRequest) => request<DiscoverBatch>("/batches", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
export const retryDiscoverBatch = (id: string) => request<DiscoverBatch>(`/batches/${encodeURIComponent(id)}/retry`, { method: "POST" });
export const getCaptionFeedback = (profileKey: string) => request<CaptionFeedback[]>(`/feedback?profileKey=${encodeURIComponent(profileKey)}`);
export const postCaptionFeedback = (input: FeedbackRequest) => request<CaptionFeedback>("/feedback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
