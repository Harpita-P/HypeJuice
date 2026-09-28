// Only expose known classifications, not raw errors that may contain credentials
// or signed media URLs.
export class ProviderHttpError extends Error {
  constructor(public readonly statusCode: number) { super(`Provider HTTP ${statusCode}`); }
}
export class MissingRenderIdError extends Error {}

export function submissionFailure(reason: unknown, provider: "Higgsfield" | "Creatomate") {
  const error = reason as { name?: string; statusCode?: number; code?: string } | null;
  const status = error?.name === "AuthenticationError" ? 401 : error?.statusCode;
  let detail = "Submission failed or the response was lost.";
  if (status === 401) detail = "Authentication failed (HTTP 401). Check the server API key.";
  else if (status === 402) detail = "Payment required (HTTP 402). Check the provider balance.";
  else if (status === 403) detail = "Access denied (HTTP 403). Check API permissions and available credits.";
  else if (status === 400 || status === 422) detail = `The provider rejected the request parameters (HTTP ${status}). Check its API log for details.`;
  else if (status === 429) detail = "Rate limit reached (HTTP 429).";
  else if (typeof status === "number" && status >= 400 && status <= 599) detail = `Provider returned HTTP ${status}.`;
  else if (reason instanceof MissingRenderIdError) detail = "The response contained no usable render ID; the render may have been accepted.";
  else if (["TimeoutError", "AbortError"].includes(error?.name ?? "") || ["ETIMEDOUT", "ECONNABORTED"].includes(error?.code ?? "")) detail = "The submission timed out; it may have been accepted.";
  return `${provider}: ${detail} Check its dashboard before another paid attempt; no automatic retry was made.`;
}
