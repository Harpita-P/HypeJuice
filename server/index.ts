import "dotenv/config";

import { serve } from "@hono/node-server";

import { app } from "./app.js";
import { authenticatedMode } from "./identity.js";
import { startWorker } from "./worker.js";
import { startYouTubeTrackingWorker } from "./youtube-tracking-worker.js";

const port = Number(process.env.PORT || 8787);

if (process.env.NODE_ENV === "production" && (!authenticatedMode() || process.env.STUDIO_ALLOW_UNAUTHENTICATED === "true" || !process.env.PUBLIC_API_URL?.startsWith("https://"))) {
  throw new Error("Production requires AUTH_MODE=supabase, STUDIO_ALLOW_UNAUTHENTICATED=false and an HTTPS PUBLIC_API_URL.");
}
if (!authenticatedMode() && process.env.STUDIO_ALLOW_UNAUTHENTICATED === "true" && process.env.NODE_ENV !== "production") {
  console.warn("Studio local testing mode: no authentication. Use only a trusted LAN; never expose this API through public URLs or tunnels. Anyone who can reach it can access videos and spend provider credits.");
}

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`HypeJuice API listening on http://localhost:${info.port}`);
});
startWorker();
startYouTubeTrackingWorker();
