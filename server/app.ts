import { cors } from "hono/cors";
import { Hono } from "hono";

import { BriefRequestSchema } from "../shared/app-brief.js";
import { generateBrief } from "./brief-generator.js";
import { extractSources } from "./source-extraction.js";
import { studioRoutes } from "./studio-routes.js";
import { discoverRoutes } from "./discover-routes.js";

export const app = new Hono();

app.use("*", cors({ origin: "*", allowMethods: ["GET", "POST", "OPTIONS"], allowHeaders: ["Content-Type", "Authorization"] }));
app.route("/api/studio", studioRoutes);
app.route("/api/discover", discoverRoutes);

app.get("/health", (context) => context.json({ ok: true, service: "growthbanana-api" }));

app.post("/api/app-brief", async (context) => {
  try {
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
