import { fetch } from "expo/fetch";
import { API_URL, authHeaders, requireSecureApi } from "./auth-client";
import type { YouTubeTrackingView } from "@shared/youtube-tracking";

export async function youtubeTrackingRequest(jobId: string, action?: "connect" | "refresh" | "disconnect", body?: unknown): Promise<YouTubeTrackingView> {
  requireSecureApi();
  const response = await fetch(`${API_URL}/api/youtube-tracking/${encodeURIComponent(jobId)}${action ? `/${action}` : ""}`, {
    method: action ? "POST" : "GET", headers: { ...await authHeaders(), "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(25000),
  });
  const data = await response.json(); if (!response.ok) throw new Error(data.error || "YouTube tracking is unavailable."); return data;
}
