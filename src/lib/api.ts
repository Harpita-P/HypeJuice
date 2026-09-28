import type { BriefRequest, BriefResponse } from "@shared/app-brief";

const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? "http://127.0.0.1:8787").replace(
  /\/$/,
  "",
);

export async function createAppBrief(input: BriefRequest): Promise<BriefResponse> {
  const response = await fetch(`${API_URL}/api/app-brief`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  const payload = (await response.json()) as BriefResponse | { error?: string };

  if (!response.ok) {
    throw new Error("error" in payload && payload.error ? payload.error : "Could not analyze your app.");
  }

  return payload as BriefResponse;
}
