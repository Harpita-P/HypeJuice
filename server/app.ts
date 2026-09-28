import { cors } from "hono/cors";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { secureHeaders } from "hono/secure-headers";
import { authenticatedMode, asUser, verifiedUser, allowance, adminDb, accountActive } from "./identity.js";
import { accountRoutes } from "./account-routes.js";
import { connectionRoutes, oauthRoutes } from "./connection-routes.js";
import { youtubeTrackingRoutes } from "./youtube-tracking-routes.js";
import { billingRoutes } from "./billing-routes.js";

import { BriefRequestSchema } from "../shared/app-brief.js";
import { generateBrief } from "./brief-generator.js";
import { extractSources } from "./source-extraction.js";
import { studioRoutes } from "./studio-routes.js";
import { discoverRoutes } from "./discover-routes.js";

export const app = new Hono();

app.use("*", secureHeaders());
app.use("*", cors({ origin: (origin) => {
  const allowed = (process.env.WEB_ORIGINS || (process.env.NODE_ENV !== "production" ? "http://localhost:8081,http://localhost:8083,http://127.0.0.1:8083" : "")).split(",");
  return allowed.includes(origin) ? origin : "";
}, allowMethods: ["GET", "POST", "OPTIONS"], allowHeaders: ["Content-Type", "Authorization"] }));
app.use("/api/*", async (c, next) => {
  c.header("Cache-Control", "no-store");
  if (!authenticatedMode()) {
    if (process.env.NODE_ENV === "production" || (process.env.NODE_ENV !== "test" && process.env.STUDIO_ALLOW_UNAUTHENTICATED !== "true")) return c.json({ error: "Unauthenticated access is disabled." }, 503);
    return next();
  }
  const match = /^Bearer ([^\s]+)$/.exec(c.req.header("Authorization") ?? "");
  if (!match) return c.json({ error: "Sign in to continue." }, 401);
  let user: string;
  try { user = await verifiedUser(match[1]); } catch { return c.json({ error: "Your session expired. Sign in again." }, 401); }
  return asUser(user, async () => {
    const account = await adminDb().from("gb_accounts").upsert({ owner_id: user, status: "active" }, { onConflict: "owner_id", ignoreDuplicates: true });
    if (account.error) return c.json({ error: "Account storage is not configured. Apply the database migration." }, 503);
    if (!await accountActive() && c.req.path !== "/api/account/delete") return c.json({ error: "Account deletion is in progress. Retry deletion to finish cleanup." }, 403);
    try { await allowance("api-requests", 600, 600); }
    catch { return c.json({ error: "Too many requests or usage service unavailable. Try again shortly." }, 429); }
    await next();
  });
});
app.route("/api/account", accountRoutes);
app.route("/api/billing", billingRoutes);
app.route("/api/connections", connectionRoutes);
app.route("/api/youtube-tracking", youtubeTrackingRoutes);
app.route("/oauth", oauthRoutes);
app.onError((_error, c) => c.json({ error: "The server could not complete this request. Check configuration or try again." }, 500));
app.route("/api/studio", studioRoutes);
app.route("/api/discover", discoverRoutes);

app.get("/health", (context) => context.json({ ok: true, service: "hypejuice-api" }));
app.get("/ready", async (c) => {
  if (!authenticatedMode()) return c.json({ ready: process.env.NODE_ENV !== "production" });
  try {
    const { error } = await adminDb().from("gb_accounts").select("owner_id").limit(0);
    return c.json({ ready: !error }, error ? 503 : 200);
  } catch { return c.json({ ready: false }, 503); }
});
app.use("/api/app-brief", bodyLimit({ maxSize: 12000 }));

app.post("/api/app-brief", async (context) => {
  try {
    await allowance("app-analysis", 20);
    const json = await context.req.json();
    const parsed = BriefRequestSchema.safeParse({
      appStoreUrl: json?.appStoreUrl ?? "",
      websiteUrl: json?.websiteUrl ?? "",
      founderNote: json?.founderNote ?? "",
    });
    if (!parsed.success) {
      return context.json({ error: parsed.error.issues[0]?.message ?? "Invalid app context." }, 400);
    }

    const { sources, warnings } = await extractSources(parsed.data);
    const { brief, mode } = await generateBrief(sources);
    return context.json({
      brief,
      mode,
      warnings,
      sources: sources.map(({ kind, url, title, appStoreMedia }) => ({
        kind, url, title,
        ...(kind === "app_store" && appStoreMedia ? { appStoreMedia } : {}),
      })),
      analyzedAt: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not analyze your app.";
    return context.json({ error: message }, 422);
  }
});
