import { z } from "zod";

export const AppBriefSchema = z.object({
  appName: z.string().min(1),
  category: z.string().min(1),
  oneLiner: z.string().min(1),
  summary: z.string().min(1),
  appVibe: z.array(z.string().min(1)).min(1).max(4).optional(),
  audiences: z
    .array(
      z.object({
        segment: z.string().min(1),
        situation: z.string().min(1),
      }),
    )
    .min(1),
  problems: z.array(z.string().min(1)).min(1).max(5),
  features: z
    .array(
      z.object({
        name: z.string().min(1),
        userOutcome: z.string().min(1),
      }),
    )
    .min(1)
    .max(6),
  messagingAngles: z
    .array(
      z.object({
        name: z.string().min(1),
        hook: z.string().min(1),
        promise: z.string().min(1),
      }),
    )
    .min(1)
    .max(4),
  tone: z.array(z.string().min(1)).min(1),
  avoidClaims: z.array(z.string().min(1)).max(5),
  unknowns: z.array(z.string().min(1)).max(6),
});

export const BriefRequestSchema = z
  .object({
    appStoreUrl: z.string().trim().max(500),
    websiteUrl: z.string().trim().max(500),
    founderNote: z.string().trim().max(2000),
  })
  .refine(
    ({ appStoreUrl, websiteUrl, founderNote }) =>
      Boolean(appStoreUrl || websiteUrl || founderNote),
    { message: "Add at least one link or a short note about your app." },
  );

export type AppBrief = z.infer<typeof AppBriefSchema>;
export type BriefRequest = z.infer<typeof BriefRequestSchema>;

export type AppMedia = { iconUrl: string | null; screenshotUrls: string[] };

export type SourceSummary = {
  kind: "app_store" | "website" | "founder_note";
  url: string | null;
  title: string;
  appStoreMedia?: AppMedia;
  /** Operator-supplied local demo assets, not extracted from the source website. */
  localDemoMedia?: AppMedia;
};

export function appMediaForSources(sources: SourceSummary[]): AppMedia | undefined {
  return sources.find((source) => source.kind === "app_store" && source.appStoreMedia)?.appStoreMedia
    ?? sources.find((source) => source.kind === "website" && source.localDemoMedia)?.localDemoMedia;
}

export type CreativePreferences = {
  selectedAudiences?: string[];
  exploreMoreAudiences?: boolean;
  scope?: "automatic_feed";
  /** Only read when migrating a previously saved single-audience profile. */
  priorityAudienceIndex?: number;
  tones: string[];
  note: string;
};

export type DemoClip = {
  id: string;
  name: string;
  /** Relative document path on native; blob stored by ID in IndexedDB on web. */
  localPath: string;
  storage: "device" | "browser" | "cloud";
  uploadId?: string;
  durationMs: number | null;
  width: number;
  height: number;
  sizeBytes: number;
  shows: string;
  importedAt: string;
};

export type BriefResponse = {
  brief: AppBrief;
  sources: SourceSummary[];
  mode: "ai" | "source_draft";
  warnings: string[];
  analyzedAt: string;
  creativePreferences?: CreativePreferences;
  demoClips?: DemoClip[];
  confirmedAt?: string | null;
};
