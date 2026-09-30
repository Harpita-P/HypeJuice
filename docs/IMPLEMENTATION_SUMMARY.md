# HypeJuice implementation summary

HypeJuice is an AI Growth Agent for app founders, submitted in the RevenueCat Shipaton 2026 **Next Gen Award** category. It combines app understanding, reusable creator footage, real app demonstrations, caption experimentation, and post performance feedback. This document describes the implemented prototype and its deployment foundation, not a claim of a completed production release.

## Product workflow

### App understanding and onboarding

The founder supplies an App Store or app website link. The API validates and retrieves public source material, then asks Gemini for a structured, editable brief: app identity, description, story, potential audiences, and creative direction. App Store imports include available icons and listing screenshots. Website imports are text based; optional local demo assets are not part of the public repository.

The founder then adds up to **five app demonstration clips**. These can be screen recordings or footage of someone using the app. The upload ceiling is 250 MB per clip; roughly ten seconds is recommended. Playable previews and clip management are available during onboarding and in Your App.

Content Taste generates **three real sample videos** before presenting the review cards. Keep or Toss feedback is persisted and supplied to future caption generation. Kept videos appear in Library; tossed content does not. This is preference memory in prompts, not model training or fine tuning.

### Discover, Studio, and Library

**Discover** generates five variations per batch using existing creator footage and the currently uploaded demo clips. It does not request new Higgsfield generation. Mixing cycles through available footage, including the one-demo case. The first Discover batch excludes creators used in the current Content Taste session; an insufficient eligible creator pool produces an error instead of silently reusing those creators. Fresh captions are checked against recent history to reduce repeats, without claiming global semantic uniqueness.

Discover supports scrolling, swipe decisions, and buttons. Rated videos remain available when scrolling back through the feed. Saving adds a video to Library. Further batches require confirmation.

**Studio** has two creator paths:

* Select an operator-curated, tagged creator from the reusable library.
* Describe a custom creator, which can submit a paid Higgsfield generation when enabled and approved.

Gemini combines the app brief, creator context, and preferences to propose three creative angles. Founders can supply their own captions too. Swiping through angle cards selects which variations to render. Demo footage is chosen from the current uploads; founders manage those clips in Your App rather than configuring each demo during creation.

**Library** contains kept content and Studio results, with All/Starred filters, downloads, sharing, and Liftoff controls. Variations using the same footage are grouped. Caption edits create a new render using the existing footage; they do not modify the underlying AI character video.

### Video and caption pipeline

```text
App brief + preference memory + creator context
                        ↓
            Gemini hook/demo captions
                        ↓
Saved creator clip + uploaded app demo → FFmpeg → private final MP4
                        ↓
              Library / share / download
```

The curated creator library uses four-second clips. The current default hook in a finished video is **three seconds**, followed by up to ten seconds of app footage. Custom creator generation requests four seconds and the renderer trims the final hook. Older jobs can retain their saved timing.

FFmpeg normalizes the clips, concatenates them, and overlays static text into a silent portrait video. The default output is 720 × 1280. Demo text has a solid black background for readability. Source quality still limits the result; this is not an upscaling guarantee.

Each result also stores a separate **post caption of at most 15 words** and **up to five relevant hashtags**. These are platform post metadata displayed by the UI, not burned into the video. Creatomate support remains only for older job polling/recovery; new assembly uses FFmpeg.

### Liftoff and feedback

Liftoff collects videos selected for posting. A founder can attach the URL of a manually published public YouTube video. The backend reads view, like, and comment counts and stores snapshots for historical charts. Cards rank by recorded reach. These are captured public counts, not impression-level analytics, retention, or app download attribution.

Gemini-powered chat can answer questions using the app context, captions, and tracked metrics. Other platform integrations are placeholders. Channel OAuth infrastructure exists, but automated uploading and scheduled publishing are not implemented. Performance chat is distinct from the caption preference memory built from Keep/Toss feedback.

## Architecture and source map

| Area | Entry points and responsibilities |
| --- | --- |
| Screens | `app/`: Expo Router onboarding, paywall, and workspace routes |
| UI and state | `src/components/`, `src/context/`, `src/lib/`: cards, players, account/billing state, API clients |
| Contracts | `shared/`: Zod validation, request types, video/caption constraints, billing identifiers |
| API | `server/index.ts`: Hono routes and server lifecycle |
| Generation | `server/discover-jobs.ts`, `server/studio-jobs.ts`, `server/studio-local.ts`: job orchestration and rendering |
| Creator catalog | `server/creator-library.json`: curated descriptions, tags, prompts, and private storage paths, not video files |
| Operator tools | `server/admin-creator.ts`, `server/admin-landing-media.ts`: deliberate creator generation/archival and public showcase uploads |
| Persistence | `supabase/migrations/202609280001_production_foundation.sql`: authenticated database foundation |
| Delivery | `Dockerfile`, `eas.json`, `.env.example`: server image, mobile build profiles, safe configuration template |

### Ownership, storage, and jobs

Authenticated mode uses Supabase email-code sign-in. The server validates the bearer token and derives the owner; it does not trust client-supplied account IDs. Native sessions use secure device storage, while web sessions are memory-only. Internal database tables have RLS enabled with backend-owned access and explicit owner filtering.

User media lives in a private bucket under `users/<user-id>/demo|creator|final/`. Operator-approved shared creators use `shared/creator/`. Playback uses expiring signed URLs; possession grants temporary access, so they must not appear in source control or logs. Private Studio creations are never automatically published to the shared catalog.

Authenticated jobs and preferences are durable. A background worker resumes jobs, with a renewable database lease coordinating replicas. Ambiguous paid submissions stop for operator review rather than automatically risking another charge. This is not a provider-side exactly-once guarantee.

Local mode is a separate single-founder workspace backed by ignored `.studio-data/` records. It is suitable only for a trusted development machine/LAN. It is not multi-user isolation, and its records are not automatically migrated into a new authenticated account.

Account deletion removes owned application records, cloud media, and the Auth account, and attempts to revoke connected channel access. Active jobs must finish first. Exported files, already published posts, provider-retained data, and backups are outside that deletion operation.

## RevenueCat subscriptions

### Implemented SDK and server paths

* [`src/lib/purchases.ts`](../src/lib/purchases.ts) configures `react-native-purchases`, loads offerings, purchases packages, restores purchases, and reads customer information.
* [`src/context/BillingContext.tsx`](../src/context/BillingContext.tsx) coordinates SDK state, purchase results, refresh, and backend verification.
* [`src/components/PlusPaywall.tsx`](../src/components/PlusPaywall.tsx) implements the current **Pro** onboarding paywall; the older internal filename is retained.
* [`src/components/SubscriptionPlans.tsx`](../src/components/SubscriptionPlans.tsx) exposes plan management under Your App.
* [`server/billing.ts`](../server/billing.ts) verifies access through RevenueCat's V1 subscriber API. Entitlements sent by the client are not authorization.
* [`shared/billing.ts`](../shared/billing.ts) defines the entitlement and package mapping.

Get Started opens the paywall. The Pro plan and trial CTA initiate SDK checkout. Onboarding continues only after verified access, or for an existing verified subscriber. Cancellation or failure leaves the paywall open. Live trial wording depends on configured introductory terms and confirmed eligibility, with localized SDK pricing.

Pro unlocks Studio; Free retains the non-Studio features for existing workspaces. Legacy Power entitlements remain recognized but are not offered on the current paywall. Expiration, grace, and refund status are checked by the server. New gated requests fail closed if verification is unavailable. Generation safety limits are separate from billing; the product does not yet implement monthly credits or promised 10/100-video daily plan allowances.

### Test Store configuration

| Dashboard item | Value |
| --- | --- |
| Product | `hypejuice_pro_monthly`, HypeJuice Pro |
| Intended offer | Monthly, $25 USD, three-day trial |
| Entitlement | `growth_pro` |
| Current offering | `default` in the demo configuration |
| Custom package | `growth_pro_monthly`, attached to the product |

Use your project's public Test Store SDK key in `EXPO_PUBLIC_REVENUECAT_TEST_API_KEY`. Put a V1 secret API key with subscriber-read access in server-only `REVENUECAT_SECRET_API_KEY`. For non-production tests enable `REVENUECAT_ALLOW_SANDBOX=true`; in local mode also set `REVENUECAT_ENFORCE_ENTITLEMENTS=true` to exercise the server gate. Restart Expo and the API after configuration changes.

Open Get Started or Your App → Your plan, start checkout, and choose success in the Test Store dialog. Confirm access in the app and the matching sandbox customer's product event and entitlement in RevenueCat. Test failure, cancellation, restore, and expiration separately. If verification is delayed, refresh the plan rather than buying again.

The installed SDK supports Test Store development through Expo Go/web. Real App Store/Google Play billing requires a native build and platform SDK keys. Release configuration does not select Test Store keys, and production server verification rejects sandbox access. Published HTTPS terms/privacy links are required for live checkout.

### Evidence and boundaries

The project owner's RevenueCat dashboard screenshot shows a HypeJuice customer marked **Sandbox Data** with the history event **“Started a trial of HypeJuice Pro (hypejuice_pro_monthly)”**. The event demonstrates a successful Test Store trial start with no real payment. The screenshot is not bundled in this repository.

The code implements purchase/restore flows and server checks; automated tests use mocks. The supplied evidence does not demonstrate a completed renewal/expiration cycle, production store billing, or store approval. Test Store does not make Gemini, Higgsfield, storage, or hosting free.

## Configuration and local development

1. Install a supported Node version (see `package.json` and `.nvmrc`), FFmpeg, and ffprobe. Run `npm ci`.
2. Copy `.env.example` to `.env` only if it does not already exist. Never commit a populated environment file.
3. Configure Gemini and private Supabase Storage. Supply your own licensed reusable creator clips and update `server/creator-library.json`, or set `DISCOVER_CREATOR_LIBRARY` to a private catalog file. The committed metadata does not provision the referenced cloud files. For three distinct taste creators plus five distinct first-batch creators, provide at least eight usable clips.
4. Configure RevenueCat as above to use the real onboarding checkout. Missing keys or offerings disable purchasing; a fallback price is not a purchasable product.
5. Run `npm run api` in one terminal and `npm start` in another. Use the computer's LAN API address on a physical phone. Both devices must be able to reach that address.

For the single-founder trusted-LAN mode, set all three values:

```ini
AUTH_MODE=local
EXPO_PUBLIC_AUTH_MODE=local
STUDIO_ALLOW_UNAUTHENTICATED=true
```

Keep this API off public tunnels and public networks. Anyone who can reach a local-mode API can access its workspace and may spend provider credits if enabled. The local `REVENUECAT_ENFORCE_ENTITLEMENTS=false` switch is development access, not a subscription; it does not fabricate a successful onboarding purchase.

Local creator catalog paths refer to `creator/<filename>.mp4` in your configured private bucket; authenticated mode prefixes them with `shared/`. `SUPABASE_STUDIO_BUCKET` defaults to `growthbanana-studio` for compatibility. Do not rename an existing bucket just for branding.

| Configuration | Purpose |
| --- | --- |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | Server app analysis, captions, and agent responses |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STUDIO_BUCKET` | Backend database/private storage access |
| `HF_CREDENTIALS` | Custom creator generation only; server secret |
| `ENABLE_PAID_GENERATION` | Explicit operator switch for paid creator generation |
| `FFMPEG_PATH`, `FFPROBE_PATH` | Optional overrides for installed binaries |
| `EXPO_PUBLIC_API_URL` | API address reachable by the mobile client |
| `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Public Auth configuration, never the service-role key |
| `YOUTUBE_DATA_API_KEY` | Optional public-post metrics; enable YouTube Data API v3 and restrict the key |
| `RUN_YOUTUBE_TRACKING_WORKER` | Background tracking refresh switch |

The optional OAuth foundation uses server-only `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET`, and a stable base64 32-byte `CONNECTION_ENCRYPTION_KEY`. Tokens are encrypted per owner. Configure the API callback `/oauth/youtube/callback` and the app's `hypejuice://connections` return scheme; this is separate from pasting a public video link and does not enable publishing.

## Deployment foundation

Use a staging Supabase project first. Apply the supplied SQL migration, enable email authentication with code-based email templates, and configure delivery/OTP limits. Create a private media bucket and review its policies; schema migrations do not automatically secure every pre-existing bucket. Upload shared creators under the authenticated storage prefix.

Deploy the supplied Docker image to an always-running HTTPS container host with CPU, RAM, temporary disk, and outbound access for rendering. It installs FFmpeg and runs Node as a non-root user. Keep at least one generation worker running; do not rely solely on short-lived request functions or scale all workers to zero.

Set `NODE_ENV=production`, `AUTH_MODE=supabase`, `STUDIO_ALLOW_UNAUTHENTICATED=false`, and an HTTPS `PUBLIC_API_URL`. Inject server secrets through the host's secret manager. Configure exact browser `WEB_ORIGINS`, upload/request limits, outbound network restrictions, monitoring, retention, and backups. `/health` is liveness; `/ready` checks database access, not every provider or worker capability.

For the app, use public production configuration and platform RevenueCat keys. Link your own Expo/EAS project and Apple/Google credentials before building with `eas.json`. Existing native identifier `com.growthbanana.app`, compatibility storage keys, and the old URL scheme remain to avoid breaking existing installs. A fork should deliberately configure its own registered identifiers. Hosted deployment, store billing, legal pages, and device release validation remain operator work.

## Repository boundaries and verification

The public source includes runtime code, tests, a sanitized environment template, creator metadata, the app logo, README, this summary, and the MIT license. Private media, credentials, local journals, demo-only images, operator drafts, and archived documentation are excluded. Public showcase URLs in `src/config/landing-videos.ts` are deliberate external demo assets; a fork can replace them with its own hosted media.

Before committing:

```sh
npm run check
npm run check:public
npm run check:public:history
git diff --check
git diff --cached --stat
```

The public scan examines candidate source, staged content, known local credential values, recognized secret patterns, and forbidden media artifacts. The history mode scans all reachable Git blobs. Findings contain paths/reasons, not secret values. No pattern scanner guarantees absence of every possible secret; manually review the exact staged snapshot too.

Deleting a file from the working tree or adding an ignore rule does **not** erase it from older commits. The local repository's historical notes remain in Git history until a separately approved history cleanup or fresh publication snapshot. Never force-push a rewritten shared history without coordination. If credentials are ever exposed, rotate them first; deleting the file alone is insufficient.

Automated checks cover shared validation, caption/creator selection, job behavior, ownership, billing verification, and other server logic. Optional Playwright checks exercise UI flows. They do not submit paid generation or prove a live production deployment.

## Remaining work

Automatic social publishing/scheduling, further platform integrations, billing-period quotas/credits, broader creator assets, and production release validation remain outside the completed prototype. User taste guides caption prompts; performance metrics do not automatically train a model. The current implementation is designed to make content experimentation easier, not to guarantee views, virality, or downloads.
