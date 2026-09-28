import type { BillingStatus } from "@shared/billing";
import { API_URL, authHeaders, requireSecureApi } from "./auth-client";

export async function getBillingStatus(): Promise<BillingStatus> {
  requireSecureApi();
  const response = await fetch(`${API_URL}/api/billing/status`, { headers: await authHeaders() });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "Couldn’t check your subscription.");
  return body;
}
