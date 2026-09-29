import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import type { BriefResponse } from "@shared/app-brief";
import type { StudioJob } from "@shared/studio";
import { demoSetKey, DiscoverRequestSchema, restorableContentBatches, type BatchPurpose, type DiscoverBatch, type DiscoverConfig, type DiscoverRequest } from "@shared/discover";
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
  const locked = useRef<string | null>(null);
  const latestBatch = useRef<DiscoverBatch | null>(null);
  const initialTask = useRef<{ profileId: string; task: Promise<void> } | null>(null);
  const onboardingId = analysis?.analyzedAt;
  const demosKey = demoSetKey(analysis?.demoClips);
  const profileId = onboardingId ? JSON.stringify([onboardingId, demosKey]) : undefined;
  const profile = useRef(profileId); profile.current = profileId;
  const [accepted, setAccepted] = useState<{ scope?: string; ids: string[] }>({ ids: [] });
  const importer = useRef(importJobs); importer.current = importJobs;
  const profileKey = analysis?.sources.find((source) => source.url)?.url ?? analysis?.brief.appName ?? "";
  useEffect(() => () => { profile.current = undefined; }, []);

  useEffect(() => {
    setBatch(null); setConfig(null); setError(""); setSubmitting(false); setLoading(false); setHasPendingRequest(false); setAccepted({ scope: profileId, ids: [] });
    pending.current = null; uploads.current.clear(); imported.current.clear();
    latestBatch.current = null; initialTask.current = null;
  }, [profileId]);

  const accept = useCallback((value: DiscoverBatch) => {
    if (profile.current !== profileId || !onboardingId || !restorableContentBatches([value], purpose, onboardingId, demosKey).length) return;
    latestBatch.current = value;
    const ready = value.jobs.filter((job) => job.status === "succeeded" && job.videoUrl && !imported.current.has(job.id));
    if (ready.length) { importer.current(ready); ready.forEach((job) => imported.current.add(job.id)); }
    setBatch(value);
    setAccepted((current) => ({ scope: profileId, ids: [...new Set([...(current.scope === profileId ? current.ids : []), value.id])] }));
  }, [profileId, onboardingId, demosKey, purpose]);

  const refresh = useCallback(async () => {
    if (!profileId || !profileKey) return;
    setLoading(true);
    try {
      const nextConfig = await getDiscoverConfig();
      if (profile.current !== profileId) return;
      setConfig(nextConfig);
      const batches = await getDiscoverBatches(profileKey, onboardingId, demosKey);
      if (profile.current !== profileId) return;
      const currentBatches = restorableContentBatches(batches, purpose, onboardingId!, demosKey);
      for (const value of currentBatches) accept(value);
      if (currentBatches.some((value) => value.id === pending.current?.id)) { pending.current = null; setHasPendingRequest(false); }
      setError("");
      // Callers can resume an existing batch before deciding to start a new one.
      return currentBatches.at(-1) ?? null;
    } catch (reason) {
      if (profile.current === profileId) setError(reason instanceof Error ? reason.message : "Couldn’t refresh Discover.");
    } finally { if (profile.current === profileId) setLoading(false); }
  }, [profileId, profileKey, purpose, accept, onboardingId, demosKey]);

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
    if (locked.current === profileId || !analysis || !profileId || (batch && batch.onboardingId === onboardingId && batch.demoSetKey === demosKey && !["succeeded", "failed"].includes(batch.status))) return;
    locked.current = profileId; setSubmitting(true); setError("");
    const startProfile = profileId;
    if (pending.current && (pending.current.onboardingId !== onboardingId || pending.current.demoSetKey !== demosKey)) pending.current = null;
    try {
      const ready = await getDiscoverConfig();
      if (profile.current !== startProfile) return;
      setConfig(ready);
      if (!ready.ready) throw new Error(`Discover setup needed: ${ready.missing.join(", ")}`);
      if (!pending.current) {
        const demos = (analysis.demoClips ?? []).map((clip) => {
          const key = `${clip.id}:${clip.importedAt}:${clip.localPath}`;
          if (!uploads.current.has(key)) uploads.current.set(key, { id: clip.uploadId ?? studioRequestId(), done: Boolean(clip.uploadId) });
          return { clipId: clip.id, uploadId: uploads.current.get(key)!.id, shows: clip.shows, durationMs: clip.durationMs };
        });
        const parsed = DiscoverRequestSchema.safeParse({ id: studioRequestId(), profileKey, brief: analysis.brief, purpose,
          onboardingId, demoSetKey: demosKey, demos, approved: true });
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
    } finally { if (locked.current === startProfile) locked.current = null; if (profile.current === startProfile) setSubmitting(false); }
  }
  async function retry() {
    if (!batch || !profileId || locked.current === profileId || batch.onboardingId !== onboardingId || batch.demoSetKey !== demosKey) return;
    locked.current = profileId; setSubmitting(true); setError("");
    const startProfile = profile.current;
    try {
      const value = await retryDiscoverBatch(batch.id);
      if (profile.current === startProfile) accept(value);
    } catch (reason) { if (profile.current === startProfile) setError(reason instanceof Error ? reason.message : "Couldn’t retry this batch."); }
    finally { if (locked.current === startProfile) locked.current = null; if (profile.current === startProfile) setSubmitting(false); }
  }
  const latestGenerate = useRef(generate); latestGenerate.current = generate;
  const ensureInitial = useCallback((): Promise<void> => {
    if (!profileId || (latestBatch.current?.onboardingId === onboardingId && latestBatch.current?.demoSetKey === demosKey)) return Promise.resolve();
    if (initialTask.current?.profileId === profileId) return initialTask.current.task;
    // Shared by onboarding and Home: refresh first, coalesce concurrent calls,
    // and never generate a replacement for an existing or failed batch.
    const task = (async () => {
      const existing = await refresh();
      if (profile.current === profileId && existing === null
        && !(latestBatch.current?.onboardingId === onboardingId && latestBatch.current?.demoSetKey === demosKey)) await latestGenerate.current();
    })().finally(() => { if (initialTask.current?.task === task) initialTask.current = null; });
    initialTask.current = { profileId, task };
    return task;
  }, [profileId, refresh, onboardingId, demosKey]);
  const currentBatch = batch?.onboardingId === onboardingId && batch?.demoSetKey === demosKey ? batch : null;
  return { batch: currentBatch, batchIds: accepted.scope === profileId ? accepted.ids : [], config, error, loading, hasPendingRequest, generate, retry, refresh, ensureInitial,
    preparing: submitting || Boolean(currentBatch && !["succeeded", "failed"].includes(currentBatch.status)) };
}
