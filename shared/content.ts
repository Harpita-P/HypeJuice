import type { BriefResponse } from "./app-brief";
import type { DiscoverOrigin, StudioJob } from "./studio";
import type { PostCopy } from "./post-copy";

export const CREATORS = ["Candid selfie", "Playful reaction", "Calm storyteller"] as const;
export type ContentConcept = {
  id: string;
  createdAt?: string;
  title: string;
  hook: string;
  demoCaption: string;
  payoff: string;
  creator: string;
  clipId: string;
  status: "pending" | "loved" | "tossed";
  source: "agent" | "studio";
  collection: "taste" | "discover" | "studio";
  batch: number;
  saved: boolean;
  queued: boolean;
  ignored: boolean;
  creatorPrompt?: string;
  rendered?: { jobId: string; url: string };
  footageKey?: string;
  discoverOrigin?: DiscoverOrigin;
  post?: PostCopy;
  plan?: { channel: string; date: string; time: string; timezone: string };
};

// Local storyboard templates, NOT rendered videos or a generation-provider call.
export function createStarterConcepts(profile: BriefResponse): ContentConcept[] {
  const clips = profile.demoClips ?? [];
  if (!clips.length) throw new Error("Add a demo clip before preparing content previews.");
  const name = profile.brief.appName;
  const createdAt = new Date().toISOString();
  const hooks = [
    `Wait, why am I only just finding ${name}?`,
    `POV: you try ${name} instead of your usual routine`,
    `A quick look at what using ${name} actually feels like`,
  ];
  return ["The discovery", "The everyday switch", "Show, don’t tell"].map((title, index) => ({
    id: `${profile.analyzedAt}-starter-${index}`,
    createdAt,
    title,
    hook: hooks[index],
    demoCaption: clips[index % clips.length].shows,
    payoff: profile.brief.features[index % profile.brief.features.length]?.userOutcome || profile.brief.oneLiner,
    creator: CREATORS[index],
    clipId: clips[index % clips.length].id,
    status: "pending",
    source: "agent",
    collection: "taste",
    batch: 0,
    saved: false,
    queued: false,
    ignored: false,
  }));
}

export function reviewConcept(items: ContentConcept[], id: string, status: ContentConcept["status"]) {
  return items.map((item) => item.id === id ? { ...item, status, ignored: status === "tossed" } : item);
}

export type Captions = Pick<ContentConcept, "hook" | "demoCaption" | "payoff">;
export function importRenderedVideo(items: ContentConcept[], job: StudioJob): ContentConcept[] {
  if (job.status !== "succeeded" || !job.videoUrl) return items;
  const existing = items.find((item) => item.rendered && (item.rendered.jobId === job.id || (job.input.reuseJobId && item.rendered.jobId === job.input.reuseJobId)
    || (job.origin && item.discoverOrigin?.batchId === job.origin.batchId && item.discoverOrigin.index === job.origin.index)));
  if (existing?.createdAt && Date.parse(existing.createdAt) > Date.parse(job.createdAt)) return items;
  const origin = job.origin ?? existing?.discoverOrigin;
  const item: ContentConcept = { id: existing?.id ?? `${origin ? "discover" : "studio"}-${job.id}`, createdAt: job.createdAt, title: origin?.title ?? "Your studio video", hook: job.input.hook,
    demoCaption: job.input.demoCaption, payoff: "", creator: "Custom prompt", creatorPrompt: job.input.prompt, clipId: job.input.clipId,
    source: origin ? "agent" : "studio", collection: origin ? origin.purpose === "taste" ? "taste" : "discover" : "studio", batch: origin?.batchNumber ?? 0,
    status: existing?.status ?? "pending", saved: existing?.saved ?? false, queued: existing?.queued ?? false,
    ignored: existing?.ignored ?? false, plan: existing?.plan, discoverOrigin: origin, post: job.post, footageKey: job.footageKey ?? existing?.footageKey, rendered: { jobId: job.id, url: job.videoUrl } };
  return existing ? items.map((old) => old.id === existing.id ? item : old) : [...items, item];
}
export type ContentAction = "save" | "unsave" | "queue" | "unqueue" | "ignore";
export function actOnContent(item: ContentConcept, action: ContentAction): ContentConcept {
  switch (action) {
    case "save": return { ...item, saved: true, ignored: false };
    case "unsave": return { ...item, saved: false };
    case "queue": return { ...item, queued: true, ignored: false };
    case "unqueue": return { ...item, queued: false, plan: undefined };
    case "ignore": return { ...item, ignored: true }; // Does not erase existing saves or plans.
  }
}

export function editCaptions(item: ContentConcept, captions: Captions): ContentConcept {
  if (item.rendered) return item; // Burned-in captions require a real re-render, not a local text edit.
  // Deliberately whitelist text fields: an existing video's footage/creator is immutable.
  return { ...item, hook: captions.hook.trim(), demoCaption: captions.demoCaption.trim(), payoff: captions.payoff.trim() };
}

export const DISCOVER_BATCH_SIZE = 5;
export function createDiscoverBatch(profile: BriefResponse, batch: number): ContentConcept[] {
  const base = createStarterConcepts(profile);
  const name = profile.brief.appName;
  const angles = ["A little discovery", "The daily ritual", "Worth a closer look", "Try this with me", "The small switch", "A fresh perspective", "Your next app find", "Less explaining, more showing", "A quiet recommendation", "An everyday moment"];
  const hooks = [
    `This is your sign to take a look at ${name}`,
    `One small thing to try in your daily routine: ${name}`,
    `Let me show you what caught my eye in ${name}`,
    `Come try ${name} with me for a moment`,
    `What if you tried ${name} for this instead?`,
    `A different way to look at ${name}`,
    `Adding ${name} to my apps-to-try list`,
    `No long explanation. Just ${name} in action`,
    `For anyone curious about ${name}, start here`,
    `A little moment with ${name} that’s worth showing`,
  ];
  return Array.from({ length: DISCOVER_BATCH_SIZE }, (_, index) => {
    const offset = (batch - 1) * DISCOVER_BATCH_SIZE + index;
    const clip = profile.demoClips![offset % profile.demoClips!.length];
    const cycle = Math.floor(offset / hooks.length);
    const audience = profile.brief.audiences[cycle % profile.brief.audiences.length].segment;
    return { ...base[index % base.length], id: `${profile.analyzedAt}-discover-${batch}-${index}`,
      title: angles[offset % angles.length], hook: `${hooks[offset % hooks.length]}${cycle ? ` · For ${audience.toLowerCase()}` : ""}`,
      demoCaption: clip.shows, clipId: clip.id, creator: CREATORS[offset % CREATORS.length],
      collection: "discover", batch,
    };
  });
}

export type StudioInput = Captions & { creator: string; creatorPrompt?: string; clipId: string };
export function createStudioConcept(profile: BriefResponse, input: StudioInput, id: string): ContentConcept {
  if (!profile.demoClips?.some((clip) => clip.id === input.clipId)) throw new Error("Choose an available demo clip.");
  if (![input.hook, input.demoCaption, input.payoff].every((value) => value.trim())) throw new Error("Add each caption before creating your concept.");
  if (input.creator === "Custom prompt" ? !input.creatorPrompt?.trim() : !CREATORS.includes(input.creator as typeof CREATORS[number])) throw new Error("Choose a creator or describe one in a prompt.");
  return { ...createStarterConcepts(profile)[0], ...input, hook: input.hook.trim(), demoCaption: input.demoCaption.trim(), payoff: input.payoff.trim(),
    id, title: "Your studio creation", source: "studio", collection: "studio", batch: 0 };
}

export function planError(plan: NonNullable<ContentConcept["plan"]>): string | null {
  if (!["TikTok", "Instagram Reels", "YouTube Shorts"].includes(plan.channel)) return "Choose a channel.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(plan.date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(plan.time)) return "Use YYYY-MM-DD and a 24-hour time (HH:MM).";
  const date = new Date(`${plan.date}T${plan.time}:00`);
  if (Number.isNaN(date.getTime()) || date.getFullYear() !== Number(plan.date.slice(0, 4)) || date.getMonth() + 1 !== Number(plan.date.slice(5, 7)) || date.getDate() !== Number(plan.date.slice(8, 10))) return "Choose a valid date.";
  if (date.getTime() <= Date.now()) return "Choose a future date and time.";
  return null;
}
