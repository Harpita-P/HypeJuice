import { Platform } from "react-native";
import { File } from "expo-file-system";
import { fetch } from "expo/fetch";
import type { DemoClip } from "@shared/app-brief";
import type { StudioConfig, StudioJob, StudioVideoInput } from "@shared/studio";
import { getDemoClipUri, releaseDemoClipUri } from "./demo-storage";

const API = (process.env.EXPO_PUBLIC_API_URL ?? "http://127.0.0.1:8787").replace(/\/$/, "");
async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API}/api/studio${path}`, options);
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "Studio request failed.");
  return body as T;
}
export const getStudioConfig = () => request<StudioConfig>("/config");
export const getStudioJob = (id: string) => request<StudioJob>(`/jobs/${encodeURIComponent(id)}`);
export const getStudioJobs = () => request<StudioJob[]>("/jobs");
export const startStudioJob = (input: StudioVideoInput) => request<StudioJob>("/jobs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
export async function uploadStudioDemo(clip: DemoClip, id: string) {
  const uri = await getDemoClipUri(clip);
  try {
    const body = new FormData(); body.append("id", id);
    if (Platform.OS === "web") body.append("file", await (await fetch(uri)).blob(), "demo.mp4");
    // Expo fetch accepts File/Blob bytes, not React Native's legacy { uri } parts.
    else body.append("file", new File(uri));
    return await request<{ id: string }>("/uploads", { method: "POST", body });
  } finally { releaseDemoClipUri(uri); }
}

// UUID generation without adding a native dependency to the Expo Go test build.
export function studioRequestId() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (letter) => {
    const number = Math.floor(Math.random() * 16);
    return (letter === "x" ? number : (number & 3) | 8).toString(16);
  });
}
