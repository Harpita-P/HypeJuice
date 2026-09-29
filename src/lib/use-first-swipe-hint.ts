import { useEffect, useState } from "react";

/** Claim the first playable, interactive card actually shown during this visit. */
export function useFirstSwipeHint(videoId: string | undefined, ready: boolean, focused: boolean) {
  const [firstId, setFirstId] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);
  useEffect(() => {
    if (!focused) { setFirstId(null); setFinished(false); }
    else if (ready && videoId && firstId === null) setFirstId(videoId);
  }, [focused, ready, videoId, firstId]);
  useEffect(() => {
    if (!focused || firstId === null) return;
    const timer = setTimeout(() => setFinished(true), 3000);
    return () => clearTimeout(timer);
  }, [focused, firstId]);
  return focused && ready && !finished && firstId === videoId;
}
