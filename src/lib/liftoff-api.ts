import { fetch } from "expo/fetch";
import type { LiftoffChatInput, LiftoffChatReply } from "@shared/liftoff";
import { API_URL, authHeaders, requireSecureApi } from "./auth-client";

export async function askLiftoff(input: LiftoffChatInput): Promise<LiftoffChatReply> {
  requireSecureApi();
  const response = await fetch(`${API_URL}/api/liftoff/chat`, {
    method: "POST", headers: { ...await authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(input), signal: AbortSignal.timeout(60000),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Your agent is unavailable. Try again.");
  return result;
}
