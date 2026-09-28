import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { z } from "zod";
import { authenticatedMode, allowance } from "./identity.js";
import { DiscoverRequestSchema } from "../shared/discover.js";
import { FeedbackRequestSchema } from "../shared/feedback.js";
import { readCaptionFeedback, saveCaptionFeedback } from "./caption-memory.js";
import { creatorLibrary } from "./creator-library.js";
import { mediaConfig } from "./studio-providers.js";
import { createDiscoverBatch, listDiscoverBatches, publicDiscoverBatch, readDiscoverBatch, retryDiscoverBatch, scheduleDiscoverBatch } from "./discover-jobs.js";

export const discoverRoutes = new Hono();
async function discoverConfig() {
  const { missing } = mediaConfig();
  if (!process.env.GEMINI_API_KEY || /your_|placeholder/i.test(process.env.GEMINI_API_KEY)) missing.push("GEMINI_API_KEY");
  let creatorCount = 0;
  try { creatorCount = (await creatorLibrary()).length; } catch { missing.push("A valid server creator-library.json catalog"); }
  if (!creatorCount) missing.push("At least one saved creator in the shared catalog");
  return { ready: !missing.length, missing, creatorCount };
}
discoverRoutes.get("/config", async (c) => c.json(await discoverConfig()));
discoverRoutes.use("*", async (c, next) => {
  const config = mediaConfig();
  if (!config.ready) return c.json({ error: `Discover setup needed: ${config.missing.join(", ")}` }, 503);
  await next();
});
discoverRoutes.use("*", bodyLimit({ maxSize: 100000 }));
discoverRoutes.get("/feedback", async (c) => {
  const key = z.string().min(1).max(600).safeParse(c.req.query("profileKey"));
  if (!key.success) return c.json({ error: "Choose an app first." }, 400);
  try { return c.json(await readCaptionFeedback(key.data)); }
  catch { return c.json({ error: "Couldn’t load caption taste memory. Retry before rating videos." }, 503); }
});
discoverRoutes.post("/feedback", async (c) => {
  let data;
  try { data = FeedbackRequestSchema.safeParse(await c.req.json()); }
  catch { return c.json({ error: "Invalid feedback request." }, 400); }
  if (!data.success) return c.json({ error: "Choose a finished video and a valid rating." }, 400);
  try { return c.json(await saveCaptionFeedback(data.data)); }
  catch { return c.json({ error: "Couldn’t save this rating. Check that the finished video belongs to this app, then retry." }, 422); }
});
const start = (id: string) => { if (!authenticatedMode()) void scheduleDiscoverBatch(id).catch(() => { /* Retry persisted state; no secrets logged. */ }); };
discoverRoutes.post("/batches", async (c) => {
  const config = await discoverConfig();
  if (!config.ready) return c.json({ error: `Discover setup needed: ${config.missing.join(", ")}` }, 503);
  let value;
  try { value = await c.req.json(); } catch { return c.json({ error: "Invalid batch request." }, 400); }
  const parsed = DiscoverRequestSchema.safeParse(value);
  if (!parsed.success) return c.json({ error: parsed.error.issues[0]?.message ?? "Check your app and demo clips." }, 400);
  try {
    if (!await readDiscoverBatch(parsed.data.id)) await allowance("discover-batches", 10);
    const batch = await createDiscoverBatch(parsed.data);
    start(batch.id);
    return c.json(await publicDiscoverBatch(batch), 202);
  } catch { return c.json({ error: "Couldn’t start a new batch. Refresh Discover to resume any existing batch; retry the same request if the connection failed." }, 409); }
});
discoverRoutes.get("/batches", async (c) => {
  const key = z.string().min(1).max(600).safeParse(c.req.query("profileKey"));
  if (!key.success) return c.json({ error: "Choose an app first." }, 400);
  try {
    const batches = await listDiscoverBatches(key.data);
    for (const batch of batches) if (!["succeeded", "failed"].includes(batch.status)) start(batch.id);
    return c.json(await Promise.all(batches.map(publicDiscoverBatch)));
  } catch { return c.json({ error: "Couldn’t load Discover. Check the API server and private storage." }, 503); }
});
discoverRoutes.get("/batches/:id", async (c) => {
  if (!z.uuid().safeParse(c.req.param("id")).success) return c.json({ error: "Invalid batch ID." }, 400);
  try {
    const batch = await readDiscoverBatch(c.req.param("id"));
    if (!batch) return c.json({ error: "Batch not found." }, 404);
    if (!["succeeded", "failed"].includes(batch.status)) start(batch.id);
    return c.json(await publicDiscoverBatch(batch));
  } catch { return c.json({ error: "Couldn’t refresh the batch. Your saved progress is safe; try again." }, 503); }
});
discoverRoutes.post("/batches/:id/retry", async (c) => {
  if (!z.uuid().safeParse(c.req.param("id")).success) return c.json({ error: "Invalid batch ID." }, 400);
  try {
    const batch = await readDiscoverBatch(c.req.param("id"));
    if (!batch) return c.json({ error: "Batch not found." }, 404);
    await retryDiscoverBatch(batch.id); start(batch.id);
    return c.json(await publicDiscoverBatch((await readDiscoverBatch(batch.id))!), 202);
  } catch { return c.json({ error: "Couldn’t resume this batch. Try refreshing its status." }, 503); }
});
