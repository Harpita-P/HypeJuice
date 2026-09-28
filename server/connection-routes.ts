import { Hono } from "hono";
import { beginYouTubeAuth, disconnectYouTube, finishYouTubeAuth, mobileRedirect, youtubeConfig } from "./youtube-auth.js";
import { allowance, authenticatedMode } from "./identity.js";

export const connectionRoutes = new Hono();
connectionRoutes.get("/youtube", async (c) => c.json(await youtubeConfig()));
connectionRoutes.post("/youtube/start", async (c) => {
  await allowance("channel-connections", 10, 3600);
  return c.json(await beginYouTubeAuth());
});
connectionRoutes.post("/youtube/disconnect", async (c) => { await disconnectYouTube(); return c.json({ ok: true }); });
export const oauthRoutes = new Hono();
oauthRoutes.get("/youtube/callback", async (c) => {
  c.header("Cache-Control", "no-store"); c.header("Referrer-Policy", "no-referrer");
  if (!authenticatedMode()) return c.text("Authenticated mode required.", 503);
  try {
    await finishYouTubeAuth(c.req.query("state") ?? "", c.req.query("code"));
    return c.redirect(`${mobileRedirect()}?status=connected`);
  } catch { return c.redirect(`${mobileRedirect()}?status=failed`); }
});
