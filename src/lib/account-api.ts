import { fetch } from "expo/fetch";
import { API_URL, authHeaders, requireSecureApi } from "./auth-client";
import type { BriefResponse } from "@shared/app-brief";
import type { ContentConcept } from "@shared/content";

export async function accountRequest<T>(path: string, body?: unknown, expectedUser?: string): Promise<T> {
  requireSecureApi();
  const response = await fetch(`${API_URL}/api/account${path}`, { method: body === undefined ? "GET" : "POST", headers: { ...await authHeaders(expectedUser), "Content-Type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const result = await response.json(); if (!response.ok) throw new Error(result.error || "Couldn’t access your account."); return result;
}
export const getSavedProfile = () => accountRequest<BriefResponse | null>("/profile");
export type WorkspaceState = Record<string, Pick<ContentConcept, "queued" | "ignored" | "plan"> & { saved?: boolean }>;
