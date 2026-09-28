import { readdir } from "node:fs/promises";
import { adminDb, asUser, authenticatedMode, accountActive } from "./identity.js";
import { deleteRecord, listRecords, recordDirectory } from "./records.js";
import { refreshTracking, trackingConfigured } from "./youtube-tracking.js";
import { TRACKING_INTERVAL_MS, TRACKING_RETENTION_MS, type YouTubeTracking } from "../shared/youtube-tracking.js";

// Read-only provider polling, independent from the paid-generation worker. Multiple
// replicas may repeat a read, but write the same hourly slot, never duplicate a post.
export function startYouTubeTrackingWorker() {
  if (process.env.RUN_YOUTUBE_TRACKING_WORKER === "false") return;
  let busy = false;
  const run = async () => {
    if (busy) return; busy = true;
    try {
      const cutoff = Date.now() - TRACKING_RETENTION_MS;
      if (authenticatedMode()) {
        const db = adminDb();
        const cleanup = await db.from("gb_records").delete().like("key", "youtube-sample-%").lt("updated_at", new Date(cutoff).toISOString());
        if (cleanup.error) throw new Error("Cleanup unavailable");
        if (!trackingConfigured()) return;
        for (let offset = 0; ; offset += 100) {
          const { data, error } = await db.from("gb_records").select("owner_id,key,data").like("key", "youtube-track-%").order("owner_id").order("key").range(offset, offset + 99);
          if (error) throw new Error("Tracking storage unavailable");
          for (const row of data) await asUser(row.owner_id, async () => {
            if (!await accountActive()) return;
            await refreshTracking((row.data as YouTubeTracking).jobId, true).catch(() => {});
          });
          if (data.length < 100) break;
        }
      } else {
        // A stopped local server cannot capture metrics or execute retention cleanup.
        const keys = await readdir(recordDirectory()).catch(() => [] as string[]);
        for (const key of keys) {
          const slot = /^youtube-sample-[0-9a-f-]{36}-(\d+)\.json$/.exec(key)?.[1];
          if (slot && (Number(slot) + 1) * TRACKING_INTERVAL_MS < cutoff) await deleteRecord(key);
        }
        if (!trackingConfigured()) return;
        for (const connection of await listRecords<YouTubeTracking>((key) => /^youtube-track-[0-9a-f-]{36}\.json$/.test(key))) await refreshTracking(connection.jobId, true).catch(() => {});
      }
    } catch { console.warn("YouTube metrics refresh/retention is unavailable; retrying later. No credentials logged."); }
    finally { busy = false; }
  };
  void run(); const timer = setInterval(() => void run(), 60_000); timer.unref();
}
