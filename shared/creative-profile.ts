import type { AppBrief, CreativePreferences, DemoClip } from "./app-brief";

export const MIN_AUDIENCES = 5;
export const MAX_DEMO_BYTES = 250 * 1024 * 1024;
export const MAX_DEMO_CLIPS = 5;
export type FeedPreferences = CreativePreferences & {
  selectedAudiences: string[];
  exploreMoreAudiences: boolean;
  scope: "automatic_feed";
};

// Honest, editable hypotheses for offline drafts and older saved profiles.
// Fresh AI briefs brainstorm specific segments instead of using this fallback.
export function withAudienceStarters(brief: AppBrief): AppBrief {
  if (brief.audiences.length >= MIN_AUDIENCES) return brief;
  const audiences = [...brief.audiences];
  const outcome = brief.features[0]?.userOutcome || brief.oneLiner;
  const starters = [
    { segment: `Newcomers to ${brief.category.toLowerCase()}`, situation: `A starting hypothesis: people who need a simple introduction to ${brief.appName}'s core use case.` },
    { segment: "People with a packed schedule", situation: `A starting hypothesis: people fitting this outcome into a busy day: ${outcome}` },
    { segment: "People switching from another tool", situation: `A starting hypothesis: people comparing their current approach with ${brief.appName}.` },
    { segment: "People doing it manually", situation: `A starting hypothesis: people handling the same task without a dedicated app. Show whether ${brief.appName} actually helps.` },
    { segment: "People building a new routine", situation: `A starting hypothesis: people trying to make this use case a regular part of their life.` },
    { segment: "Curious app explorers", situation: `A starting hypothesis: people open to discovering a different way to ${outcome.replace(/[.!]$/, "").toLowerCase()}.` },
  ];
  for (const candidate of starters) {
    if (audiences.length >= 6) break;
    if (!audiences.some((audience) => audience.segment.toLowerCase() === candidate.segment.toLowerCase())) audiences.push(candidate);
  }
  return { ...brief, audiences };
}

export function normalizeFeedPreferences(brief: AppBrief, previous?: CreativePreferences): FeedPreferences {
  const valid = new Set(brief.audiences.map((audience) => audience.segment));
  const oldFocus = brief.audiences[previous?.priorityAudienceIndex ?? 0]?.segment;
  const selectedAudiences = previous?.selectedAudiences !== undefined
    ? [...new Set(previous.selectedAudiences.filter((segment) => valid.has(segment)))]
    : [...new Set([oldFocus, ...brief.audiences.map((audience) => audience.segment)].filter((segment): segment is string => Boolean(segment)))].slice(0, MIN_AUDIENCES);
  return { selectedAudiences, exploreMoreAudiences: previous?.exploreMoreAudiences ?? false, scope: "automatic_feed", tones: previous?.tones ?? [], note: previous?.note ?? "" };
}

export function profileReadiness(preferences: FeedPreferences, clips: DemoClip[]): string | null {
  if (!clips.length) return "Add at least one real app recording in Step 2.";
  if (clips.length > MAX_DEMO_CLIPS) return `Keep up to ${MAX_DEMO_CLIPS} demo clips for this setup.`;
  if (clips.some((clip) => !clip.shows.trim())) return "Tell me what each demo clip shows in Step 2.";
  if (preferences.selectedAudiences.length < MIN_AUDIENCES) return `Choose at least ${MIN_AUDIENCES} potential audiences. You can add your own.`;
  if (!preferences.tones.length && !preferences.note.trim()) return "Pick a content tone, or describe one in your own words.";
  return null;
}
