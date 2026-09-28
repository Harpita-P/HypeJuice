import { randomUUID } from "node:crypto";
import { adminDb, asUser, authenticatedMode } from "./identity.js";
import { runJobStep } from "./studio-jobs.js";
import { scheduleDiscoverBatch } from "./discover-jobs.js";

// One elected worker globally; API replicas enqueue durable records only.
export function startWorker() {
  if (!authenticatedMode() || process.env.RUN_GENERATION_WORKER === "false") return;
  const holder = randomUUID(); let elected = false; let busy = false;
  const renew = async () => {
    try {
      const { data, error } = await adminDb().rpc("gb_worker_lock", { p_holder: holder });
      if (error || data !== true) {
        // Stop this process if leadership is lost mid-operation. Submission intent is already journaled.
        if (elected && busy) process.exit(1);
        elected = false; return;
      }
      elected = true;
    } catch { if (elected && busy) process.exit(1); elected = false; }
  };
  const scan = async () => {
    if (!elected || busy) return;
    busy = true;
    try {
      const { data, error } = await adminDb().from("gb_records").select("owner_id,key,data").in("data->>status", ["queued", "writing", "writing_post", "rendering", "generating", "assembling_local", "saving", "submitting_creator", "submitting_render"])
        .order("updated_at").limit(100);
      if (error) return;
      for (const row of data) {
        if (!elected) break;
        await asUser(row.owner_id, async () => {
          if (/^discover-[0-9a-f-]{36}\.json$/.test(row.key)) await scheduleDiscoverBatch(row.data.id);
          else if (/^[0-9a-f-]{36}\.json$/.test(row.key)) await runJobStep(row.data.id);
        });
      }
    } catch { console.warn("Generation worker could not advance pending work; it will retry. No provider response or credentials logged."); }
    finally { busy = false; }
  };
  void renew().then(scan);
  const heartbeat = setInterval(() => void renew(), 15000); heartbeat.unref();
  const timer = setInterval(() => void scan(), 5000); timer.unref();
}
