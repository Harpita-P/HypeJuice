import { Platform } from "react-native";
import { File } from "expo-file-system";
import { fetch } from "expo/fetch";
import type { DemoClip } from "@shared/app-brief";
import type { StudioConfig, StudioJob, StudioVideoInput } from "@shared/studio";
import type { CreatorCatalog, CreatorIdeaRequest, CreatorIdeas } from "@shared/creator-library";
import { getDemoClipUri, releaseDemoClipUri } from "./demo-storage";
import { authHeaders, requireSecureApi } from "./auth-client";

const API = (process.env.EXPO_PUBLIC_API_URL ?? "http://127.0.0.1:8787").replace(/\/$/, "");
async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  requireSecureApi();
  const response = await fetch(`${API}/api/studio${path}`, { ...options, headers: { ...await authHeaders(), ...options.headers } });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "Studio request failed.");
  return body as T;
}
export const getStudioConfig = () => request<StudioConfig>("/config");
export const getCreatorCatalog = () => request<CreatorCatalog>("/creators");
export const getCreatorIdeas = (input: CreatorIdeaRequest) => request<CreatorIdeas>("/ideas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
export const getStudioJob = (id: string) => request<StudioJob>(`/jobs/${encodeURIComponent(id)}`);
export async function getStudioJobs() {
  const jobs: StudioJob[] = [];
  for (let offset = 0; ; offset += 50) {
    const page = await request<StudioJob[]>(`/jobs?offset=${offset}&limit=50`);
    jobs.push(...page); if (page.length < 50) return jobs;
  }
}
export const startStudioJob = (input: StudioVideoInput) => request<StudioJob>("/jobs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
export async function uploadStudioDemo(clip: DemoClip, id: string) {
  if (clip.uploadId === id) return { id };
  const headers = await authHeaders();
  const uri = await getDemoClipUri(clip);
  try {
    const body = new FormData(); body.append("id", id);
    if (Platform.OS === "web" || clip.storage === "cloud") body.append("file", await (await fetch(uri)).blob(), "demo.mp4");
    // Expo fetch accepts File/Blob bytes, not React Native's legacy { uri } parts.
    else body.append("file", new File(uri));
    return await request<{ id: string }>("/uploads", { method: "POST", body, headers });
  } finally { releaseDemoClipUri(uri); }
}

// UUID generation without adding a native dependency to the Expo Go test build.
export function studioRequestId() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (letter) => {
    const number = Math.floor(Math.random() * 16);
    return (letter === "x" ? number : (number & 3) | 8).toString(16);
  });
}
