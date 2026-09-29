import { readFile, stat } from "node:fs/promises";
import { resolve, join } from "node:path";
import { Hono } from "hono";
import { z } from "zod";
import { authenticatedMode } from "./identity.js";
import type { AppMedia } from "../shared/app-brief.js";

// Optional, Git-ignored operator assets. Never scraped or sent to the model.
const imageFile = z.string().regex(/^[a-zA-Z0-9_-]+\.(?:png|jpe?g)$/i);
const manifestSchema = z.object({ apps: z.array(z.object({
  id: z.string().regex(/^[a-zA-Z0-9_-]+$/),
  websiteUrl: z.url(), icon: imageFile, screenshots: z.array(imageFile).max(10),
})).max(20) });
const enabled = () => process.env.NODE_ENV !== "production" && !authenticatedMode() &&
  (process.env.STUDIO_ALLOW_UNAUTHENTICATED === "true" || process.env.NODE_ENV === "test");
const directory = () => resolve(process.env.LOCAL_DEMO_MEDIA_DIR || ".studio-data/demo-apps");
function websiteKey(value: string) {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password) throw new Error("Invalid demo website");
  return url.origin + url.pathname.replace(/\/+$/, "");
}
async function manifest() {
  if (!enabled()) return [];
  try { return manifestSchema.parse(JSON.parse(await readFile(join(directory(), "manifest.json"), "utf8"))).apps; }
  catch { return []; } // Removing the local folder cleanly disables the override.
}

export async function localDemoMedia(websiteUrl: string, apiOrigin: string): Promise<AppMedia | undefined> {
  try {
    const entry = (await manifest()).find((app) => websiteKey(app.websiteUrl) === websiteKey(websiteUrl));
    if (!entry) return;
    const available = async (file: string) => { try { return (await stat(join(directory(), entry.id, file))).isFile(); } catch { return false; } };
    const url = (file: string) => new URL(`/local-demo-media/${entry.id}/${file}`, apiOrigin).toString();
    const iconUrl = await available(entry.icon) ? url(entry.icon) : null;
    const screenshotUrls = (await Promise.all(entry.screenshots.map(async (file) => await available(file) ? url(file) : null))).filter((value): value is string => Boolean(value));
    if (iconUrl || screenshotUrls.length) return { iconUrl, screenshotUrls };
  } catch { /* Demo assets must never prevent ordinary website analysis. */ }
}

export const localDemoMediaRoutes = new Hono();
localDemoMediaRoutes.get("/:id/:file", async (c) => {
  const entry = (await manifest()).find((app) => app.id === c.req.param("id"));
  const file = c.req.param("file");
  if (!entry || ![entry.icon, ...entry.screenshots].includes(file)) return c.notFound();
  try {
    const bytes = await readFile(join(directory(), entry.id, file));
    c.header("Content-Type", /\.png$/i.test(file) ? "image/png" : "image/jpeg");
    c.header("Cache-Control", "no-store");
    return c.body(new Uint8Array(bytes));
  } catch { return c.notFound(); }
});
