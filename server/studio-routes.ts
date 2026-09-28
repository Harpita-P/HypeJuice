import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { z } from "zod";
import { CREATOR_HOOK_SECONDS, StudioVideoInputSchema } from "../shared/studio.js";
import { MAX_DEMO_BYTES } from "../shared/creative-profile.js";
import { createJob, listJobs, readJob, studioDirectory, tickJob, type StoredStudioJob } from "./studio-jobs.js";
import { mediaConfig, studioConfig, uploadMedia } from "./studio-providers.js";
import { publicJob } from "./studio-public.js";

export const studioRoutes = new Hono();
studioRoutes.get("/config", (c) => c.json(studioConfig()));
studioRoutes.use("*", async (c, next) => {
  const config = mediaConfig();
  if (!config.ready) return c.json({ error: `Studio setup needed: ${config.missing.join(", ")}` }, 503);
  await next();
});
studioRoutes.use("/uploads", bodyLimit({ maxSize: MAX_DEMO_BYTES + 65536, onError: (c) => c.json({ error: "Choose a clip under 250 MB." }, 413) }));
studioRoutes.use("/jobs", bodyLimit({ maxSize: 100000 }));

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
    const record = join(studioDirectory(), `upload-${id}.json`);
    try { await readFile(record); return c.json({ id }); }
    catch (reason) { if ((reason as NodeJS.ErrnoException).code !== "ENOENT") throw reason; }
    // A retry reuses this private object, not another provider generation.
    await uploadMedia(path, file, webm ? "video/webm" : "video/mp4");
    await mkdir(studioDirectory(), { recursive: true });
    await writeFile(record, JSON.stringify({ path }), { mode: 0o600 });
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
    if (!process.env.GEMINI_API_KEY || /your_|placeholder/i.test(process.env.GEMINI_API_KEY)) return c.json({ error: "Configure GEMINI_API_KEY to write the post caption and hashtags before generating this video." }, 503);
    let demoPath: string; let creatorPath: string | undefined; let origin: StoredStudioJob["origin"];
    if (input.reuseJobId) {
      const original = await readJob(input.reuseJobId);
      if (!original?.creatorPath) return c.json({ error: "No reusable creator clip was saved for that job." }, 400);
      if (!["succeeded", "failed"].includes(original.status)) return c.json({ error: "Wait for the existing job to finish before another render." }, 409);
      // Keep both source clips and demo timing. New revisions use the 3-second hook standard.
      input = { ...original.input, brief: original.input.brief ?? input.brief, id: input.id, reuseJobId: original.id, uploadId: undefined, hook: input.hook, demoCaption: input.demoCaption, demoTextPosition: input.demoTextPosition };
      demoPath = original.demoPath; creatorPath = original.creatorPath;
      origin = original.origin ? { ...original.origin, formatId: input.hook === original.input.hook && input.demoCaption === original.input.demoCaption ? original.origin.formatId : undefined } : undefined;
    } else {
      if (!studioConfig().ready) return c.json({ error: "Configure HF_CREDENTIALS before generating a new creator in Studio." }, 503);
      demoPath = JSON.parse(await readFile(join(studioDirectory(), `upload-${input.uploadId}.json`), "utf8")).path;
    }
    input = { ...input, hookSeconds: CREATOR_HOOK_SECONDS };
    const job = await createJob({ id: input.id, input, requestKey, status: "queued", createdAt: new Date().toISOString(), demoPath, creatorPath, origin, assembly: "ffmpeg", generatePost: true });
    if (job.requestKey !== requestKey) return c.json({ error: "Request ID already used by another video." }, 409);
    tickJob(job.id);
    return c.json(await publicJob(job), 202);
  } catch { return c.json({ error: "Couldn’t start this job. Check that the demo was uploaded, then retry using the same request ID." }, 422); }
});
studioRoutes.get("/jobs", async (c) => c.json(await Promise.all((await listJobs()).map(publicJob))));
studioRoutes.get("/jobs/:id", async (c) => {
  if (!z.uuid().safeParse(c.req.param("id")).success) return c.json({ error: "Invalid job ID." }, 400);
  const job = await readJob(c.req.param("id"));
  if (!job) return c.json({ error: "Job not found on this server." }, 404);
  tickJob(job.id);
  return c.json(await publicJob(job));
});
