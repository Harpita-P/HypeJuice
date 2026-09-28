import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ rows: new Map<string, any>(), userA: "10000000-0000-4000-8000-000000000001", userB: "10000000-0000-4000-8000-000000000002" }));
vi.mock("./identity.js", async (original) => {
  const actual = await original<typeof import("./identity.js")>();
  function from(table: string) {
    let mutation = "read"; let payload: any; let single = false; let start = 0; let end = Infinity;
    const filters: [string, unknown][] = [];
    const query: any = {
      select: () => query, eq: (key: string, value: unknown) => { filters.push([key, value]); return query; },
      order: () => query, limit: (limit: number) => { end = limit - 1; return query; }, range: (a: number, b: number) => { start = a; end = b; return query; },
      maybeSingle: () => { single = true; return query; },
      insert: (value: any) => { mutation = "insert"; payload = value; return query; },
      upsert: (value: any) => { mutation = "upsert"; payload = value; return query; },
      delete: () => { mutation = "delete"; return query; },
      then: (resolve: (value: unknown) => void) => {
        if (table === "gb_accounts") return Promise.resolve({ data: null, error: null }).then(resolve);
        if (mutation === "insert" || mutation === "upsert") {
          const key = `${payload.owner_id}:${payload.key}`;
          if (mutation === "insert" && state.rows.has(key)) return Promise.resolve({ error: { code: "23505" } }).then(resolve);
          state.rows.set(key, structuredClone(payload)); return Promise.resolve({ error: null }).then(resolve);
        }
        const rows = [...state.rows.values()].filter((row) => filters.every(([key, value]) => row[key] === value)).slice(start, end + 1);
        if (mutation === "delete") rows.forEach((row) => state.rows.delete(`${row.owner_id}:${row.key}`));
        return Promise.resolve({ data: single ? rows[0] ?? null : rows, error: null }).then(resolve);
      },
    }; return query;
  }
  return { ...actual, adminDb: () => ({ from }), allowance: async () => {}, accountActive: async () => true,
    verifiedUser: async (token: string) => { if (![state.userA, state.userB].includes(token)) throw new Error("invalid"); return token; } };
});
vi.mock("./studio-providers.js", async (original) => ({ ...await original<typeof import("./studio-providers.js")>(), signedMedia: async () => "https://media.test/private.mp4" }));
// Ownership tests assume a subscribed user; billing rejection is tested separately.
vi.mock("./billing.js", async (original) => ({ ...await original<typeof import("./billing.js")>(), requireStudioAccess: async () => {} }));
import { asUser, storagePath } from "./identity.js";
import { readRecord, saveRecord } from "./records.js";
import { createJob, readJob, type StoredStudioJob } from "./studio-jobs.js";
import { saveCaptionFeedback, readCaptionFeedback } from "./caption-memory.js";
import { encryptConnection, decryptConnection } from "./youtube-auth.js";
import { StudioVideoInputSchema } from "../shared/studio.js";
import { app } from "./app.js";

const jobId = "20000000-0000-4000-8000-000000000001";
const uploadId = "20000000-0000-4000-8000-000000000002";
const input = StudioVideoInputSchema.parse({ id: jobId, uploadId, appName: "Focus", profileKey: "same-app.test", clipId: "demo", prompt: "An adult creator reacts", hook: "my small reset", demoCaption: "i start a timer", demoSeconds: 5, approved: true });
const job: StoredStudioJob = { id: jobId, input, status: "succeeded", createdAt: "2026-09-28", requestKey: JSON.stringify(input), demoPath: `demo/${uploadId}.mp4`, creatorPath: `creator/${jobId}.mp4`, finalPath: `final/${jobId}.mp4`, assembly: "ffmpeg" };
const auth = (id: string) => ({ Authorization: `Bearer ${id}` });
beforeEach(() => {
  state.rows.clear(); vi.stubEnv("NODE_ENV", "production"); vi.stubEnv("AUTH_MODE", "supabase"); vi.stubEnv("STUDIO_ALLOW_UNAUTHENTICATED", "false");
  vi.stubEnv("SUPABASE_URL", "https://storage.test"); vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-only-key"); vi.stubEnv("GEMINI_API_KEY", "test-only-key");
  vi.stubEnv("CONNECTION_ENCRYPTION_KEY", Buffer.alloc(32, 1).toString("base64"));
});
afterEach(() => { vi.unstubAllEnvs(); });

describe("authenticated ownership boundaries (mock database, no providers)", () => {
  it("rejects missing or forged bearer credentials throughout the API", async () => {
    for (const path of ["/api/app-brief", "/api/studio/jobs", "/api/discover/batches", "/api/account/profile", "/api/connections/youtube", `/api/youtube-tracking/${jobId}`]) {
      expect((await app.request(path)).status).toBe(401);
      expect((await app.request(path, { headers: auth("forged") })).status).toBe(401);
    }
  });
  it("isolates identical job IDs and cannot read, list, sign, or reuse another user's job", async () => {
    await asUser(state.userA, () => createJob(job));
    expect(await asUser(state.userB, () => readJob(jobId))).toBeNull();
    expect((await app.request(`/api/studio/jobs/${jobId}`, { headers: auth(state.userB) })).status).toBe(404);
    await asUser(state.userA, () => saveRecord(`youtube-track-${jobId}.json`, { jobId, videoId: "abcdefghijk", trackingId: uploadId, linkedAt: "2026-09-28" }));
    expect((await app.request(`/api/youtube-tracking/${jobId}`, { headers: auth(state.userB) })).status).toBe(404);
    expect((await app.request(`/api/youtube-tracking/${jobId}/disconnect`, { method: "POST", headers: auth(state.userB) })).status).toBe(404);
    expect(await (await app.request("/api/studio/jobs", { headers: auth(state.userB) })).json()).toEqual([]);
    const reuse = await app.request("/api/studio/jobs", { method: "POST", headers: { ...auth(state.userB), "Content-Type": "application/json" }, body: JSON.stringify({ ...input, id: uploadId, uploadId: undefined, reuseJobId: jobId }) });
    expect(reuse.status).toBe(400);
    await asUser(state.userB, () => createJob({ ...job, input: { ...input, hook: "my different hook" } }));
    expect((await asUser(state.userA, () => readJob(jobId)))?.input.hook).toBe("my small reset");
    expect((await asUser(state.userB, () => readJob(jobId)))?.input.hook).toBe("my different hook");
  });
  it("does not share demos, profiles or feedback when app URLs match", async () => {
    await asUser(state.userA, async () => {
      await createJob(job); await saveRecord(`upload-${uploadId}.json`, { path: `demo/${uploadId}.mp4` }); await saveRecord("profile.json", { app: "private A" });
      await saveCaptionFeedback({ profileKey: input.profileKey, jobId, verdict: "loved" });
    });
    expect((await app.request(`/api/account/demos/${uploadId}`, { headers: auth(state.userB) })).status).toBe(404);
    expect(await asUser(state.userB, () => readRecord("profile.json"))).toBeNull();
    expect(await asUser(state.userB, () => readCaptionFeedback(input.profileKey))).toEqual([]);
    await expect(asUser(state.userB, () => saveCaptionFeedback({ profileKey: input.profileKey, jobId, verdict: "tossed" }))).rejects.toThrow();
    expect(await asUser(state.userA, () => readCaptionFeedback(input.profileKey))).toHaveLength(1);
  });
  it("requires user context and prevents private path traversal or shared writes", async () => {
    await expect(readRecord("profile.json")).rejects.toThrow("context");
    expect(asUser(state.userA, () => storagePath("final/video.mp4"))).toBe(`users/${state.userA}/final/video.mp4`);
    expect(() => asUser(state.userB, () => storagePath(`users/${state.userA}/final/video.mp4`))).toThrow();
    expect(() => asUser(state.userA, () => storagePath("../creator/video.mp4"))).toThrow();
    expect(() => asUser(state.userA, () => storagePath("shared/creator/video.mp4", true))).toThrow();
  });
  it("encrypts provider credentials and binds ciphertext to the owning account", () => {
    const value = { refreshToken: "test-refresh-token", accessToken: "test-access-token" };
    const encrypted = asUser(state.userA, () => encryptConnection(value));
    expect(JSON.stringify(encrypted)).not.toContain("test-refresh-token");
    expect(asUser(state.userA, () => decryptConnection(encrypted))).toEqual(value);
    expect(() => asUser(state.userB, () => decryptConnection(encrypted))).toThrow();
    expect(() => asUser(state.userA, () => decryptConnection({ ...encrypted, ciphertext: Buffer.from("tampered").toString("base64") }))).toThrow();
  });
});
