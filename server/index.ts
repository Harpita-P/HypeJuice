import "dotenv/config";

import { serve } from "@hono/node-server";

import { app } from "./app.js";

const port = Number(process.env.PORT || 8787);

if (process.env.STUDIO_ALLOW_UNAUTHENTICATED === "true" && process.env.NODE_ENV !== "production") {
  console.warn("Studio local testing mode: no authentication. Use only a trusted LAN; never expose this API through public URLs or tunnels. Anyone who can reach it can access videos and spend provider credits.");
}

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`GrowthBanana API listening on http://localhost:${info.port}`);
});
