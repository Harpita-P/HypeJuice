import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { z } from "zod";
import { AppBriefSchema } from "../shared/app-brief.js";
import { readRecord, saveRecord, deleteRecord } from "./records.js";
import { adminDb, authenticatedMode, ownerId } from "./identity.js";
import { signedMedia } from "./studio-providers.js";
import { disconnectYouTube } from "./youtube-auth.js";

const demoSchema = z.object({ id: z.string().max(200), name: z.string().max(500), localPath: z.literal(""), storage: z.literal("cloud"), uploadId: z.uuid(),
  durationMs: z.number().nullable(), width: z.number(), height: z.number(), sizeBytes: z.number(), shows: z.string().max(600), importedAt: z.string().max(100) });
const profileSchema = z.object({ brief: AppBriefSchema, analyzedAt: z.string().max(100), confirmedAt: z.string().nullable().optional(),
  mode: z.enum(["ai", "source_draft"]), warnings: z.array(z.string()).max(30), sources: z.array(z.object({ kind: z.enum(["app_store", "website", "founder_note"]),
    url: z.string().nullable(), title: z.string(), appStoreMedia: z.object({ iconUrl: z.string().nullable(), screenshotUrls: z.array(z.string()) }).optional() })).max(10),
  demoClips: z.array(demoSchema).max(4).optional(), creativePreferences: z.object({ tones: z.array(z.string()), note: z.string(), selectedAudiences: z.array(z.string()).optional(), exploreMoreAudiences: z.boolean().optional(), scope: z.literal("automatic_feed").optional() }).optional() });
const planSchema = z.object({ channel: z.enum(["YouTube Shorts", "Instagram Reels", "TikTok"]), date: z.string().max(10), time: z.string().max(5), timezone: z.string().max(100) });
export const accountRoutes = new Hono();
accountRoutes.use("*", bodyLimit({ maxSize: 500000 }));
accountRoutes.get("/profile", async (c) => c.json(await readRecord("profile.json")));
accountRoutes.post("/profile", async (c) => {
  const result = profileSchema.safeParse(await c.req.json());
  if (!result.success) return c.json({ error: "Invalid app profile." }, 400);
  for (const clip of result.data.demoClips ?? []) {
    const uploaded = await readRecord<{ path?: string }>(`upload-${clip.uploadId}.json`);
    if (!uploaded?.path) return c.json({ error: "Demo is unavailable or does not belong to this account." }, 404);
  }
  await saveRecord("profile.json", result.data); return c.json({ ok: true });
});
accountRoutes.post("/profile/clear", async (c) => { await deleteRecord("profile.json"); return c.json({ ok: true }); });
accountRoutes.get("/workspace", async (c) => c.json(await readRecord("workspace.json") ?? {}));
accountRoutes.post("/workspace", async (c) => {
  const schema = z.record(z.string().max(250), z.object({ queued: z.boolean(), ignored: z.boolean(), saved: z.boolean().optional(), plan: planSchema.optional() }));
  const result = schema.safeParse(await c.req.json());
  if (!result.success || Object.keys(result.data).length > 2000) return c.json({ error: "Invalid workspace state." }, 400);
  await saveRecord("workspace.json", result.data); return c.json({ ok: true });
});
accountRoutes.get("/demos/:id", async (c) => {
  const id = z.uuid().safeParse(c.req.param("id"));
  if (!id.success) return c.json({ error: "Invalid demo." }, 400);
  const record = await readRecord<{ path: string }>(`upload-${id.data}.json`);
  if (!record?.path) return c.json({ error: "Demo not found." }, 404);
  return c.json({ url: await signedMedia(record.path) });
});
accountRoutes.post("/delete", async (c) => {
  if (!authenticatedMode()) return c.json({ error: "Account deletion is only available in authenticated mode." }, 400);
  const input = await c.req.json();
  if (input.confirm !== "DELETE") return c.json({ error: "Confirm account deletion." }, 400);
  // Do not delete while work is in flight: avoids jobs recreating media after cleanup.
  const db = adminDb(); const user = ownerId();
  const { data: mayDelete, error } = await db.rpc("gb_begin_deletion", { p_owner: user });
  if (error || mayDelete !== true) return c.json({ error: "Wait for running generation/uploads to finish before deleting your account." }, 409);
  await disconnectYouTube();
  const bucket = db.storage.from(process.env.SUPABASE_STUDIO_BUCKET || "growthbanana-studio");
  for (const directory of ["demo", "creator", "final"]) {
    const prefix = `users/${user}/${directory}`;
    while (true) {
      const { data, error } = await bucket.list(prefix, { limit: 100 });
      if (error) return c.json({ error: "Media cleanup failed. Please retry account deletion." }, 503);
      if (!data.length) break;
      const removed = await bucket.remove(data.map((file) => `${prefix}/${file.name}`));
      if (removed.error) return c.json({ error: "Media cleanup failed. Please retry account deletion." }, 503);
    }
  }
  const removed = await db.auth.admin.deleteUser(user);
  if (removed.error) return c.json({ error: "Could not delete the account. Please retry." }, 503);
  return c.json({ ok: true });
});
