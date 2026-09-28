import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { z } from "zod";
import { TrackYouTubeSchema } from "../shared/youtube-tracking.js";
import { connectTracking, disconnectTracking, refreshTracking, trackingView, TrackingError } from "./youtube-tracking.js";

export const youtubeTrackingRoutes = new Hono();
youtubeTrackingRoutes.use("*", bodyLimit({ maxSize: 4096 }));
youtubeTrackingRoutes.use("/:jobId/*", async (c, next) => {
  if (!z.uuid().safeParse(c.req.param("jobId")).success) return c.json({ error: "Invalid video ID." }, 400);
  await next();
});
youtubeTrackingRoutes.onError((error, c) => c.json({ error: error instanceof TrackingError ? error.message : "Couldn’t update YouTube tracking. Try again." }, error instanceof TrackingError ? error.status : 500));
youtubeTrackingRoutes.get("/:jobId", async (c) => {
  if (!z.uuid().safeParse(c.req.param("jobId")).success) return c.json({ error: "Invalid video ID." }, 400);
  return c.json(await trackingView(c.req.param("jobId")));
});
youtubeTrackingRoutes.post("/:jobId/connect", async (c) => {
  const input = TrackYouTubeSchema.safeParse(await c.req.json());
  if (!input.success) return c.json({ error: "Confirm this is your post and paste its YouTube link." }, 400);
  return c.json(await connectTracking(c.req.param("jobId"), input.data.url));
});
youtubeTrackingRoutes.post("/:jobId/refresh", async (c) => c.json(await refreshTracking(c.req.param("jobId"))));
youtubeTrackingRoutes.post("/:jobId/disconnect", async (c) => c.json(await disconnectTracking(c.req.param("jobId"))));
