import { createContext, useContext, useRef, useState, type ReactNode } from "react";
import { actOnContent, createStudioConcept, editCaptions, importRenderedVideo, type Captions, type ContentAction, type ContentConcept, type StudioInput } from "@shared/content";
import type { BriefResponse } from "@shared/app-brief";
import type { StudioJob } from "@shared/studio";
import { removeLibraryItem } from "@shared/library";
import { applyCaptionFeedback } from "@shared/feedback";
import { useAppProfile } from "./AppProfileContext";
import { useDiscover, type DemoUploadCache } from "@/lib/use-discover";
import { useCaptionFeedback } from "@/lib/use-caption-feedback";

type ContentState = {
  concepts: ContentConcept[];
  review: (id: string, status: ContentConcept["status"]) => Promise<boolean>;
  act: (id: string, action: ContentAction) => void;
  remove: (id: string) => void;
  captions: (id: string, value: Captions) => void;
  plan: (id: string, value: ContentConcept["plan"]) => void;
  generateDiscover: () => Promise<void>;
  discover: ReturnType<typeof useDiscover>;
  taste: ReturnType<typeof useDiscover>;
  feedback: ReturnType<typeof useCaptionFeedback>;
  createStudio: (input: StudioInput) => Promise<string | undefined>;
  preparing: boolean;
  importVideo: (job: StudioJob) => void;
};
const Context = createContext<ContentState | null>(null);

export function ContentProvider({ children }: { children: ReactNode }) {
  const { analysis } = useAppProfile();
  const [session, setSession] = useState<{ profileId: string | null; concepts: ContentConcept[] }>({ profileId: null, concepts: [] });
  const concepts = session.profileId === analysis?.analyzedAt ? session.concepts : [];
  const busy = useRef(false);
  const [preparing, setPreparing] = useState(false);
  const activeProfile = useRef(analysis?.analyzedAt);
  activeProfile.current = analysis?.analyzedAt;
  const uploadCache = useRef<DemoUploadCache>(new Map());
  const feedback = useCaptionFeedback(analysis, (ratings) => {
    setSession((current) => ({ ...current, concepts: applyCaptionFeedback(current.concepts, ratings) }));
  });
  function importJobs(jobs: StudioJob[]) {
    if (!analysis) return;
    const profileKey = analysis.sources.find((source) => source.url)?.url ?? analysis.brief.appName;
    setSession((current) => {
      let items = current.profileId === analysis.analyzedAt ? current.concepts : [];
      for (const job of jobs) if (job.input.profileKey === profileKey) items = importRenderedVideo(items, job);
      return { profileId: analysis.analyzedAt, concepts: applyCaptionFeedback(items, feedback.ratings.current) };
    });
  }
  const discover = useDiscover(analysis, importJobs, "discover", uploadCache);
  const taste = useDiscover(analysis, importJobs, "taste", uploadCache);
  async function preparePreview(build: (profile: BriefResponse, current: ContentConcept[]) => ContentConcept[]) {
    if (busy.current || !analysis) return;
    busy.current = true; setPreparing(true);
    const profile = analysis;
    try {
      // Brief UI-only preview transition; no provider call or banana charge.
      await new Promise((resolve) => setTimeout(resolve, 450));
      if (activeProfile.current !== profile.analyzedAt) return;
      const added = build(profile, concepts);
      setSession((current) => ({ profileId: profile.analyzedAt, concepts: [...(current.profileId === profile.analyzedAt ? current.concepts : []), ...added] }));
      return added[0]?.id;
    } finally { busy.current = false; setPreparing(false); }
  }
  return <Context.Provider value={{ concepts,
    importVideo: (job) => {
      if (!analysis || job.status !== "succeeded" || !job.videoUrl) return;
      const profileKey = analysis.sources.find((source) => source.url)?.url ?? analysis.brief.appName;
      if (job.input.profileKey !== profileKey) return;
      setSession((current) => {
        const items = current.profileId === analysis.analyzedAt ? current.concepts : [];
        return { profileId: analysis.analyzedAt, concepts: applyCaptionFeedback(importRenderedVideo(items, job), feedback.ratings.current) };
      });
    },
    review: (id, status) => {
      const item = concepts.find((entry) => entry.id === id);
      return item?.rendered ? feedback.rate(item.rendered.jobId, status) : Promise.resolve(false);
    },
    act: (id, action) => {
      const item = concepts.find((entry) => entry.id === id);
      if (item?.rendered && (action === "save" || action === "unsave")) {
        void feedback.rate(item.rendered.jobId, action === "save" ? "loved" : "pending");
      } else setSession((current) => ({ ...current, concepts: current.concepts.map((item) => item.id === id ? actOnContent(item, action) : item) }));
    },
    remove: (id) => setSession((current) => ({ ...current, concepts: removeLibraryItem(current.concepts, id) })),
    captions: (id, value) => setSession((current) => ({ ...current, concepts: current.concepts.map((item) => item.id === id ? editCaptions(item, value) : item) })),
    plan: (id, value) => setSession((current) => ({ ...current, concepts: current.concepts.map((item) => item.id === id && item.queued ? { ...item, plan: value } : item) })),
    preparing,
    discover,
    taste,
    feedback,
    generateDiscover: discover.generate,
    createStudio: (input) => preparePreview((profile) => [createStudioConcept(profile, input, `${profile.analyzedAt}-studio-${Date.now()}`)]),
  }}>{children}</Context.Provider>;
}

export function useContent() {
  const value = useContext(Context);
  if (!value) throw new Error("ContentProvider is required");
  return value;
}
