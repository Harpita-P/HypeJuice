import { useCallback, useEffect, useRef, useState } from "react";
import type { BriefResponse } from "@shared/app-brief";
import type { CaptionFeedback, FeedbackRequest } from "@shared/feedback";
import { getCaptionFeedback, postCaptionFeedback } from "./discover-api";

export function useCaptionFeedback(analysis: BriefResponse | null, apply: (ratings: CaptionFeedback[]) => void) {
  const profileId = analysis?.analyzedAt;
  const profileKey = analysis?.sources.find((source) => source.url)?.url ?? analysis?.brief.appName ?? "";
  const active = useRef(profileId); active.current = profileId;
  const applyLatest = useRef(apply); applyLatest.current = apply;
  const ratings = useRef<CaptionFeedback[]>([]);
  const locked = useRef(new Set<string>());
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [loadError, setLoadError] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const refreshing = useRef<string | undefined>(undefined);

  const refresh = useCallback(async () => {
    if (!profileId || locked.current.size || refreshing.current === profileId) return;
    refreshing.current = profileId; setReady(false); setLoadError("");
    try {
      const result = await getCaptionFeedback(profileKey);
      if (active.current !== profileId) return;
      ratings.current = result; applyLatest.current(result); setErrors({}); setReady(true);
    } catch { if (active.current === profileId) setLoadError("Couldn’t load your caption preferences. Check the API connection and retry."); }
    finally { if (refreshing.current === profileId) refreshing.current = undefined; }
  }, [profileId, profileKey]);

  useEffect(() => {
    ratings.current = []; locked.current.clear(); setSaving({}); setErrors({}); setReady(false); setLoadError("");
    // Loading is initiated by the screen, so a profile change cannot overlap the previous read.
  }, [profileId]);

  async function rate(jobId: string, verdict: FeedbackRequest["verdict"]): Promise<boolean> {
    if (!profileId || !ready || refreshing.current === profileId || locked.current.has(jobId)) return false;
    locked.current.add(jobId); setSaving((state) => ({ ...state, [jobId]: true }));
    setErrors((state) => ({ ...state, [jobId]: "" }));
    try {
      const result = await postCaptionFeedback({ profileKey, jobId, verdict });
      if (active.current !== profileId) return false;
      ratings.current = ratings.current.filter((entry) => entry.jobId !== jobId).concat(result);
      applyLatest.current([result]);
      return true;
    } catch {
      if (active.current === profileId) setErrors((state) => ({ ...state, [jobId]: "Couldn’t save that preference. Your previous rating is unchanged—tap your choice again to retry." }));
      return false;
    } finally {
      locked.current.delete(jobId);
      if (active.current === profileId) setSaving((state) => ({ ...state, [jobId]: false }));
    }
  }
  return { ratings, ready, saving, busy: Object.values(saving).some(Boolean), error: loadError || Object.values(errors).find(Boolean) || "", refresh, rate };
}
