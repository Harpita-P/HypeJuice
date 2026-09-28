import { readRecord, saveRecord } from "./records.js";
import { allowance, authenticatedMode } from "./identity.js";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { z } from "zod";
import { StudioVideoInputSchema } from "../shared/studio.js";
import { MAX_DEMO_BYTES } from "../shared/creative-profile.js";
import { createJob, listJobs, readJob, studioDirectory, tickJob, type StoredStudioJob } from "./studio-jobs.js";
import { mediaConfig, studioConfig, uploadMedia, signedMedia } from "./studio-providers.js";
import { creatorLibrary } from "./creator-library.js";
import { CreatorIdeaRequestSchema } from "../shared/creator-library.js";
import { writeCreatorIdeas } from "./studio-ideas.js";
import { publicJob } from "./studio-public.js";
import { requireStudioAccess, BillingError } from "./billing.js";

export const studioRoutes = new Hono();
studioRoutes.get("/config", (c) => c.json(studioConfig()));
studioRoutes.use("*", async (c, next) => {
  const config = mediaConfig();
  if (!config.ready) return c.json({ error: `Studio setup needed: ${config.missing.join(", ")}` }, 503);
  await next();
});
studioRoutes.use("/uploads", bodyLimit({ maxSize: MAX_DEMO_BYTES + 65536, onError: (c) => c.json({ error: "Choose a clip under 250 MB." }, 413) }));
studioRoutes.use("/jobs", bodyLimit({ maxSize: 100000 }));
studioRoutes.use("/ideas", bodyLimit({ maxSize: 100000 }));
studioRoutes.get("/creators", async (c) => {
  try { await requireStudioAccess(); }
  catch (error) { return c.json({ error: error instanceof BillingError ? error.message : "Subscription verification unavailable." }, error instanceof BillingError ? error.status : 503); }
  const creators = await creatorLibrary();
  const missing = process.env.GEMINI_API_KEY ? [] : ["GEMINI_API_KEY"];
  return c.json({ ready: !missing.length, missing, creators: await Promise.all(creators.map(async ({ path, ...creator }) => ({ ...creator, name: creator.name ?? creator.id, previewUrl: await signedMedia(path).catch(() => undefined) }))) });
});
studioRoutes.post("/ideas", async (c) => {
  try { await requireStudioAccess(); }
  catch (error) { return c.json({ error: error instanceof BillingError ? error.message : "Subscription verification unavailable." }, error instanceof BillingError ? error.status : 503); }
  const parsed = CreatorIdeaRequestSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: parsed.error.issues[0]?.message }, 400);
  try { return c.json(await writeCreatorIdeas(parsed.data)); }
  catch { return c.json({ error: "Couldn’t write these angles. Check Gemini setup and the selected creator, then retry. No video generation was requested." }, 422); }
});

studioRoutes.post("/uploads", async (c) => {
  try {
    const data = await c.req.formData();
    const id = z.uuid().parse(data.get("id"));
    const file = data.get("file");
    if (!(file instanceof File) || !file.size || file.size > MAX_DEMO_BYTES) return c.json({ error: "Choose a video file under 250 MB." }, 400);
    const header = new Uint8Array(await file.slice(0, 16).arrayBuffer());
    const mp4 = new TextDecoder().decode(header.slice(4, 8)) === "ftyp";
    const webm = header[0] === 0x1a && header[1] === 0x45 && header[2] === 0xdf && header[3] === 0xa3;
    if (!mp4 && !webm) return c.json({ error: "Use an MP4, MOV, or WebM video." }, 400);
    const path = `demo/${id}.${webm ? "webm" : "mp4"}`;
    const record = `upload-${id}.json`;
    const existing = await readRecord<{ path?: string; status?: string; createdAt?: string }>(record);
    if (existing?.path) return c.json({ id });
    if (existing?.status === "uploading" && Date.now() - Date.parse(existing.createdAt ?? "") < 15 * 60_000) return c.json({ error: "This demo is still uploading. Retry shortly using the same ID." }, 409);
    await allowance("demo-uploads", 12);
    await saveRecord(record, { status: "uploading", createdAt: new Date().toISOString() });
    // A retry reuses this private object, not another provider generation.
    try {
      await uploadMedia(path, file, webm ? "video/webm" : "video/mp4");
      await saveRecord(record, { path, status: "succeeded" });
    } catch (error) { await saveRecord(record, { status: "failed" }); throw error; }
    return c.json({ id });
  } catch { return c.json({ error: "Demo upload failed. Check the private Supabase bucket, file type, and size limit, then retry." }, 422); }
});

studioRoutes.post("/jobs", async (c) => {
  try {
    const parsed = StudioVideoInputSchema.safeParse(await c.req.json());
    if (!parsed.success) return c.json({ error: parsed.error.issues[0]?.message ?? "Invalid generation request." }, 400);
    let input = parsed.data;
    const requestKey = JSON.stringify(input);
    const existing = await readJob(input.id);
    if (existing) {
      if (existing.requestKey !== requestKey) return c.json({ error: "This request ID already belongs to another video. Check the existing job first." }, 409);
      tickJob(existing.id); return c.json(await publicJob(existing));
    }
    await requireStudioAccess();
    if (!input.post && (!process.env.GEMINI_API_KEY || /your_|placeholder/i.test(process.env.GEMINI_API_KEY))) return c.json({ error: "Configure GEMINI_API_KEY to write the post caption and hashtags before generating this video." }, 503);
    let demoPath: string; let creatorPath: string | undefined; let origin: StoredStudioJob["origin"];
    if (input.reuseJobId) {
      const original = await readJob(input.reuseJobId);
      if (!original?.creatorPath) return c.json({ error: "No reusable creator clip was saved for that job." }, 400);
      if (!["succeeded", "failed"].includes(original.status)) return c.json({ error: "Wait for the existing job to finish before another render." }, 409);
      // Keep both source clips and timing, including legacy renders.
      input = { ...original.input, creatorId: undefined, savedCreatorJobId: undefined, post: undefined, brief: original.input.brief ?? input.brief, id: input.id, reuseJobId: original.id, uploadId: undefined, hook: input.hook, demoCaption: input.demoCaption, demoTextPosition: input.demoTextPosition };
      demoPath = original.demoPath; creatorPath = original.creatorPath;
      origin = original.origin ? { ...original.origin, formatId: input.hook === original.input.hook && input.demoCaption === original.input.demoCaption ? original.origin.formatId : undefined } : undefined;
    } else {
      const upload = await readRecord<{ path: string }>(`upload-${input.uploadId}.json`);
      if (!upload?.path) return c.json({ error: "Demo not found for this account." }, 404);
      demoPath = upload.path;
      if (input.creatorId) {
        const creator = (await creatorLibrary()).find((entry) => entry.id === input.creatorId);
        if (!creator) return c.json({ error: "Creator not found in the shared library." }, 404);
        creatorPath = creator.path;
        input = { ...input, prompt: creator.sourcePrompt ?? creator.description };
      } else if (input.savedCreatorJobId) {
        const source = await readJob(input.savedCreatorJobId);
        if (!source || source.input.profileKey !== input.profileKey || source.input.savedCreatorJobId) return c.json({ error: "Creator source not found for this app, or chained reuse is not supported." }, 400);
        if (source.status === "failed" && !source.creatorPath) return c.json({ error: "The original creator generation failed. Check that job before starting again." }, 409);
        creatorPath = source.creatorPath;
        input = { ...input, prompt: source.input.prompt };
      } else {
        if (authenticatedMode() && process.env.ENABLE_PAID_GENERATION !== "true") return c.json({ error: "Paid creator generation has not been enabled by the server operator." }, 403);
        if (!studioConfig().ready) return c.json({ error: "Configure HF_CREDENTIALS before generating a new creator in Studio." }, 503);
      }
    }
    const reusing = Boolean(input.reuseJobId || input.creatorId || input.savedCreatorJobId);
    await allowance(reusing ? "video-revisions" : "paid-creator", reusing ? 20 : 3);
    input = { ...input, hookSeconds: input.reuseJobId ? input.hookSeconds ?? 5 : 4 };
    const job = await createJob({ id: input.id, input, requestKey, status: "queued", createdAt: new Date().toISOString(), demoPath, creatorPath, origin, assembly: "ffmpeg", post: input.post, generatePost: !input.post });
    if (job.requestKey !== requestKey) return c.json({ error: "Request ID already used by another video." }, 409);
    tickJob(job.id);
    return c.json(await publicJob(job), 202);
  } catch (error) {
    if (error instanceof BillingError) return c.json({ error: error.message }, error.status);
    return c.json({ error: "Couldn’t start this job. Check that the demo was uploaded, then retry using the same request ID." }, 422);
  }
});
studioRoutes.get("/jobs", async (c) => {
  const offset = z.coerce.number().int().min(0).max(100000).safeParse(c.req.query("offset") ?? 0);
  const limit = z.coerce.number().int().min(1).max(50).safeParse(c.req.query("limit") ?? 20);
  if (!offset.success || !limit.success) return c.json({ error: "Invalid page." }, 400);
  const page = (await listJobs(Infinity)).slice(offset.data, offset.data + limit.data);
  return c.json(await Promise.all(page.map(publicJob)));
});
studioRoutes.get("/jobs/:id", async (c) => {
  if (!z.uuid().safeParse(c.req.param("id")).success) return c.json({ error: "Invalid job ID." }, 400);
  const job = await readJob(c.req.param("id"));
  if (!job) return c.json({ error: "Job not found on this server." }, 404);
  tickJob(job.id);
  return c.json(await publicJob(job));
});
