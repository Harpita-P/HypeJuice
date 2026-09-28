import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import type { BriefResponse } from "@shared/app-brief";
import type { StudioJob } from "@shared/studio";
import { DiscoverRequestSchema, type BatchPurpose, type DiscoverBatch, type DiscoverConfig, type DiscoverRequest } from "@shared/discover";
import { getDiscoverBatch, getDiscoverBatches, getDiscoverConfig, retryDiscoverBatch, startDiscoverBatch } from "./discover-api";
import { studioRequestId, uploadStudioDemo } from "./studio-api";

export type DemoUploadCache = Map<string, { id: string; done: boolean }>;
export function useDiscover(analysis: BriefResponse | null, importJobs: (jobs: StudioJob[]) => void, purpose: BatchPurpose = "discover", sharedUploads?: RefObject<DemoUploadCache>) {
  const [batch, setBatch] = useState<DiscoverBatch | null>(null);
  const [config, setConfig] = useState<DiscoverConfig | null>(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hasPendingRequest, setHasPendingRequest] = useState(false);
  const pending = useRef<DiscoverRequest | null>(null);
  const ownUploads = useRef<DemoUploadCache>(new Map());
  const uploads = sharedUploads ?? ownUploads;
  const imported = useRef(new Set<string>());
  const locked = useRef(false);
  const profile = useRef(analysis?.analyzedAt); profile.current = analysis?.analyzedAt;
  const importer = useRef(importJobs); importer.current = importJobs;
  const profileKey = analysis?.sources.find((source) => source.url)?.url ?? analysis?.brief.appName ?? "";
  const profileId = analysis?.analyzedAt;

  useEffect(() => {
    setBatch(null); setConfig(null); setError(""); setSubmitting(false); setHasPendingRequest(false);
    pending.current = null; uploads.current.clear(); imported.current.clear();
  }, [profileId]);

  const accept = useCallback((value: DiscoverBatch) => {
    const ready = value.jobs.filter((job) => job.status === "succeeded" && job.videoUrl && !imported.current.has(job.id));
    if (ready.length) { importer.current(ready); ready.forEach((job) => imported.current.add(job.id)); }
    setBatch(value);
  }, []);

  const refresh = useCallback(async () => {
    if (!profileId || !profileKey) return;
    setLoading(true);
    try {
      const nextConfig = await getDiscoverConfig();
      if (profile.current !== profileId) return;
      setConfig(nextConfig);
      const batches = await getDiscoverBatches(profileKey);
      if (profile.current !== profileId) return;
      for (const value of batches) if ((value.purpose ?? "discover") === purpose) accept(value);
      if (batches.some((value) => value.id === pending.current?.id)) { pending.current = null; setHasPendingRequest(false); }
      setError("");
    } catch (reason) {
      if (profile.current === profileId) setError(reason instanceof Error ? reason.message : "Couldn’t refresh Discover.");
    } finally { if (profile.current === profileId) setLoading(false); }
  }, [profileId, profileKey, purpose, accept]);

  useEffect(() => {
    if (!batch || ["succeeded", "failed"].includes(batch.status)) return;
    let active = true; let checking = false;
    const id = batch.id;
    const timer = setInterval(() => {
      if (checking) return;
      checking = true;
      void getDiscoverBatch(id).then((value) => {
        if (active && profile.current === profileId) { accept(value); setError(""); }
      }).catch(() => {
        if (active && profile.current === profileId) setError("Connection interrupted. The server keeps your batch; checking again shortly…");
      }).finally(() => { checking = false; });
    }, 3000);
    return () => { active = false; clearInterval(timer); };
  }, [batch?.id, batch?.status, profileId, accept]);

  async function generate() {
    if (locked.current || !analysis || (batch && !["succeeded", "failed"].includes(batch.status))) return;
    locked.current = true; setSubmitting(true); setError("");
    const startProfile = analysis.analyzedAt;
    try {
      const ready = await getDiscoverConfig();
      if (profile.current !== startProfile) return;
      setConfig(ready);
      if (!ready.ready) throw new Error(`Discover setup needed: ${ready.missing.join(", ")}`);
      if (!pending.current) {
        const demos = (analysis.demoClips ?? []).map((clip) => {
          const key = `${clip.id}:${clip.importedAt}:${clip.localPath}`;
          if (!uploads.current.has(key)) uploads.current.set(key, { id: studioRequestId(), done: false });
          return { clipId: clip.id, uploadId: uploads.current.get(key)!.id, shows: clip.shows, durationMs: clip.durationMs };
        });
        const parsed = DiscoverRequestSchema.safeParse({ id: studioRequestId(), profileKey, brief: analysis.brief, purpose, demos, approved: true });
        if (!parsed.success) throw new Error("Add 1–4 demo clips of at least one second, with a short description of what they show.");
        pending.current = parsed.data; setHasPendingRequest(true);
      }
      const input = pending.current;
      for (const demo of input.demos) {
        const clip = analysis.demoClips?.find((entry) => entry.id === demo.clipId);
        const upload = [...uploads.current.values()].find((entry) => entry.id === demo.uploadId);
        if (!clip || !upload) throw new Error("A demo clip is no longer available. Refresh your app context first.");
        if (!upload.done) { await uploadStudioDemo(clip, upload.id); upload.done = true; }
        if (profile.current !== startProfile) return;
      }
      const value = await startDiscoverBatch(input);
      if (profile.current === startProfile) { pending.current = null; setHasPendingRequest(false); accept(value); }
    } catch (reason) {
      if (profile.current === startProfile) setError(reason instanceof Error ? reason.message : "Couldn’t start Discover. Retry the same request.");
    } finally { locked.current = false; if (profile.current === startProfile) setSubmitting(false); }
  }
  async function retry() {
    if (!batch || locked.current) return;
    locked.current = true; setSubmitting(true); setError("");
    const startProfile = profile.current;
    try {
      const value = await retryDiscoverBatch(batch.id);
      if (profile.current === startProfile) accept(value);
    } catch (reason) { if (profile.current === startProfile) setError(reason instanceof Error ? reason.message : "Couldn’t retry this batch."); }
    finally { locked.current = false; if (profile.current === startProfile) setSubmitting(false); }
  }
  return { batch, config, error, loading, hasPendingRequest, generate, retry, refresh,
    preparing: submitting || Boolean(batch && !["succeeded", "failed"].includes(batch.status)) };
}
