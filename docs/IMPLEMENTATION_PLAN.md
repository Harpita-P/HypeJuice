# HypeJuice implementation plan

Latest architecture work: September 28, 2026 (local checks; deployment pending)

This is a staged plan, not a frozen specification. Each stage has a small,
working acceptance test. We should validate that test before expanding the
feature.

## 1. Product decision

### Manual-post YouTube metrics (latest)

Launch Bucket uses compact video previews with platform selectors. Only YouTube
is functional: attach a public video link to a finished owned render, confirm it
is your post, and show views/likes/comment counts from YouTube Data API v3. The
other four platforms are disabled placeholders. Tracking does not publish anything.

Expandable per-video charts show timestamped captured totals, beginning at link
connection. Hourly checks run while the backend is online; manual refresh performs
a fresh provider check, subject to the daily limit. Retain a rolling 28 days, with no synthetic historical values,
derived performance scores, comment text, or automatic AI learning. Missing values
remain unavailable, not zero. Metrics use owner-scoped records and require only
a server-side `YOUTUBE_DATA_API_KEY`, independent of OAuth/channel connection.
See [tracking setup and retention requirements](YOUTUBE_TRACKING.md). Actual live
API/device verification remains dependent on the founder supplying the key.

### Authenticated deployment foundation (supersedes prototype architecture below)

Accounts, owner-scoped storage, and durable server processing are now implemented.
See [Production setup](PRODUCTION_SETUP.md) for the migration, environment split,
HTTPS container deployment, and device setup. No hosted migration or deployment
has been performed, so this is a foundation awaiting staging verification, not
a claim of production readiness.

- Supabase email OTP accounts; native session storage in Keychain/Keystore.
- Verified bearer identity on all API routes. Database records and private media
  are owner-scoped; no public client access to internal documents. Licensed shared
  creators are explicitly operator-managed, never another user's private videos.
- Durable app brief/demo references, Library jobs/bookmarks, preference memory,
  and launch drafts. A database-leased worker advances jobs without phone polling.
- Per-user encrypted channel tokens and single-use OAuth state; browser consent
  starts on iPhone and returns to the app. Actual uploading/scheduling is still
  separate work. No Mac browser is required for connecting a deployed account.
- Usage safety caps, paid-generation kill switch, account sign-out and deletion.
- Non-root Node/FFmpeg Docker deployment and EAS build profiles provided.

The older no-login, `.studio-data/`, polling-driven, session-reset descriptions
below apply only to explicitly opted-in local development. They are not the
architecture for an App Store build. Credit billing, global abuse/spend control,
production monitoring/retention, privacy disclosures, and live two-user/device
acceptance checks remain release prerequisites.

### Platform post copy and UGC format memory (latest)

New Taste, Discover, and Studio videos include a separate platform post caption
(short first-person copy, ≤15 words and ≤500 characters) and 1–5 distinct relevant hashtag tokens.
Validate hashtag syntax, count, and case-insensitive uniqueness; hashtags cannot
be hidden in the post caption. These fields are stored on the video job and
restored into Library, independent of the two burned-in overlay captions.
All inline full-video players show finished copy as a Reels-style footer overlay:
white caption and hashtags over a dark gradient, with “more” opening selectable
full text. Keep playback controls accessible, grid tiles uncluttered, and exports
unchanged. Native fullscreen shows the MP4 without this React viewing overlay.
Legacy jobs stay intact.

The founder's 80 story patterns live separately in `shared/ugc-formats.ts`, with
stable IDs and eight categories. New batches require unique format IDs and at
least three categories, prioritize less-used recent patterns, and respect actual
app features and footage. Character/game formats are conditional; visual formats
do not change the creator-first hook + demo edit. No invented metrics or testimonials.
Store the chosen ID alongside each variation, and include it in per-app Love/Toss
memory. This guides prompts, not model-weight training or measured performance.

Discover/Taste generate post copy in the same Gemini call as the overlays.
Studio writes post copy with Gemini and persists it before any new paid creator
submission; failure stops before video generation. Overlay revisions refresh the
post copy while reusing footage. Actual platform publishing, published dates and
performance-result ingestion remain future work, not fabricated tracking data.

### Creator-library Studio workflow (current)

- Social integration expansion is paused. Prioritize creative discovery and fast
  assembly from existing footage; do not promise a fixed seconds-to-result SLA.
- **Creator library** searches/filters operator-curated reactions by emotion,
  gender/presentation, context, actions, appearance and style. Choosing a library
  item only reuses footage—never invoke Higgsfield as a fallback.
- **Describe your creator** is explicitly NEW paid Higgsfield generation, not a
  catalog-matching agent. Require approval, generate one 4-second silent portrait
  creator, archive privately, and reuse it across up to three caption variations.
- One Gemini call produces distinct angles, hook/demo overlays and platform copy
  using app context, the chosen clip's prompt-derived tags (or new requested prompt),
  demo descriptions, and saved taste preferences. Manual overlays are kept unchanged.
  Show/edit the draft overlays before approval. Keep post copy at 15 words or fewer
  and at most five relevant hashtags. No invented customer experiences or outcomes.
- Randomly mix uploaded demos without configuration in Studio. Your App provides
  playable demo tiles, add/remove, and explicit Save. Existing renders remain intact.
- New Studio renders use four-second hooks; Discover/Taste retain their existing
  three-second format. Caption-only revisions preserve the original timing.
- Both initial catalog prompts were recovered and recorded with prompt-derived
  provenance. Their 5.04-second source files remain intact; preview playback and
  assembly use the first four seconds. More diverse footage is still needed.
- Jobs waiting for another creator job never fall through into paid generation.
  Same-request retries preserve job IDs; submitted jobs can be restored in Recent
  renders. New private Studio footage is not automatically added to the shared catalog.

### First real Studio integration (foundation)

The new-creator Studio path is wired to Higgsfield's
`bytedance/seedance-2.0/text-to-video` (4-second creator hook, 720p, 9:16, audio disabled),
private Supabase Storage, and local FFmpeg assembly. The final 720×1280 MP4
contains the creator hook, a hard cut to 1–10 seconds of a real demo, and two
static bold white captions with black outlines. No talking avatar, subtitle
animation, branding frame, view counts, or audio is added. Demo caption placement
is selectable; screen recordings use contain-fit to preserve the app interface.
Captions are measured/wrapped Manrope Bold text on transparent PNG overlays;
FFmpeg stitches the segments and encodes H.264 at 30 fps. New jobs use FFmpeg;
Creatomate is retained only for older job polling/recovery. This supersedes the
Creatomate assembly recommendations in the earlier roadmap sections below.

Self-hosted local Studio requires an explicit server-only
`STUDIO_ALLOW_UNAUTHENTICATED=true` opt-in and approval for each paid request;
there is no signup/login or in-app access code. This mode is disabled by default
and in production. Keep the API on your own computer/trusted LAN, never a public
URL or tunnel: anyone with network access can use the configured credits and
access Studio media. Public deployment requires authentication and ownership checks.
This is a single-founder local test; per-user auth, ownership, precise cost quotes,
credit accounting, and a production worker queue are deferred. A live Higgsfield
clip has been archived, and a real 720×1280 FFmpeg assembly from the saved creator
and demo has passed duration, resolution, no-audio, and private playback-access checks.
Visual quality still needs founder review; billing automation is not implemented.

Jobs are journaled in `.studio-data/` before paid submissions, with automatic POST
retries disabled. Polling advances/resumes known jobs. Ambiguous submissions
without provider IDs stop for manual review; no claim of provider-side exactly-once
delivery is made. Raw hooks, demos, and outputs remain in private storage;
caption-only revisions create an approved assembly job reusing the same footage.
Recent renders can restore completed Studio outputs after a prototype app reset.
Content Taste now renders three videos through the same Gemini + saved-footage +
FFmpeg pipeline as Discover's five-video batches. See README setup.

### Content Taste and durable caption feedback (latest)

- Step 3 generates three contrasting hook/demo caption pairs and three real videos
  using saved creator footage and uploaded demos; no Higgsfield generation occurs.
  The user explicitly confirms the batch after the text/storage usage disclosure.
- Only Love it and Toss are offered here. Love it keeps content in Library, not Saved or
  Launch Bucket. Captions can be edited later from Library. All three acknowledged
  ratings are required to enter the workspace; failed saves keep the prior state.
- Persist exact caption pairs, creative style tags, audience, and rating on the
  server per connected app. Idempotent updates replace a changed vote; no duplicate
  weight is added by retrying. Bookmarks are separate workspace state and do not change taste ratings.
- Future caption generation reads liked/tossed examples to steer copy patterns,
  with uncertainty about why a video was rejected. Keep exploring rather than
  treating three examples as a permanent rule. This is prompt memory, not training
  model weights. No extra model call is needed to summarize feedback.
- Restore Taste batches and ratings on reconnecting the same app. This remains a
  single-founder, app-key-scoped prototype; authenticated per-user memory is deferred.

### Discover reusable-footage implementation (latest)

- Each confirmed batch writes five new pairs of short, first-person Gen-Z-style
  hook/demo captions grounded in the current app brief, audiences, and demo notes.
  Hook: ≤9 words/65 characters, shown for 3 seconds. Demo: ≤12 words/90 characters.
- Select saved creators from an explicit operator-curated catalog and pair them
  with the current app's uploaded demos in shuffled cycles. One demo is supported.
  The initial catalog references two distinct archived creator clips; no source
  media is committed. Other deployments must supply their own licensed footage.
- Never call Higgsfield from Discover: jobs carry saved creator paths and an
  assembly-only guard. Studio may generate new creators at the provider's 4-second
  minimum; new final hooks are trimmed to 3 seconds. Studio footage is not
  automatically added to the shared catalog.
- Persist batches, pairing choices, caption history, and job IDs. Validate first-person
  wording, length, exact repeats and near-identical word overlap before rendering.
  History is app-scoped; unlimited semantic uniqueness is not guaranteed.
- FFmpeg writes real silent 720×1280 videos, shown progressively in Discover and
  Library. Save/Launch/Skip and Download/Share work on those outputs. Caption edits
  reuse their original footage in Studio and preserve Discover attribution.
- Initial and subsequent batches require confirmation. Gemini text usage and
  hosting/storage costs apply; no new paid creator generation is used. Retrying
  assembly preserves successful videos and does not rewrite accepted captions.
- API restarts can resume persisted batches. This is a single-process trusted-LAN
  prototype; public shared-library delivery still needs authentication/ownership.

### Latest workspace decision (takes precedence over earlier generation limits)

- Home opens a Discover subsection: a vertically paged short-video feed, five
  agent creations per batch. Save bookmarks an item; Launch queues it directly;
  Skip or simply scrolling past leaves it in Library → All. After five items,
  ask “Want some more fresh content?”; only confirmation starts the next five.
- Library is a video grid with All/Saved pills and Most recent/Oldest first
  sorting. Saving and queueing are separate flags; neither removes a creation
  from All. Skipped content remains available.
- Studio creates one individually directed video at a time, using a pre-made UGC
  avatar or a creator prompt, captions, and demo footage selected before creation.
  Library tracks provenance internally without source labels. Existing Agent and Studio videos
  permit caption edits only; creator and video footage are immutable.
- Navigation: Home, Library, Studio, Launch Bucket, Your App. Your App shows the
  connected app’s current description, story, audience/vibe insights, and available
  App Store visuals from Step 1. App Impact has been removed entirely. Onboarding still
  has three real Content Taste videos; it is separate from five-item Discover batches.
- Content Taste, Discover, and Studio now render real videos as described above.
  Caption preference memory persists; chat, advanced taste modeling, and posting
  remain future work. Draft launch plans remain session-only.
- Confirm every Discover batch and paid Studio request. Credit quotes/accounting
  remain deferred; the UI discloses which services are used instead of inventing costs.

The submission should prove one loop end to end:

1. A founder supplies an App Store or website URL.
2. HypeJuice drafts an editable App DNA profile with cited source facts and
   clearly marked assumptions.
3. The founder builds a reusable Demo Clip library by uploading and labeling
   multiple clips showing the app in action (screen capture or footage of someone
   using the app on a phone), then reviews three hook + demo concepts in
   Content Taste. Love it keeps the video in Library without bookmarking; Toss records a negative signal;
   there is no edit action in Step 3. Caption editing is available later from Library. Ratings seed taste
   learning without constraining future manual agent requests.
4. The founder chats with the Growth Agent as they would with a growth
   teammate: they can bring a rough hook, name a trend, ask for ideas, or react
   to an earlier video.
5. The agent uses the confirmed App DNA, Demo Clips, and taste history; asks a
   focused clarifying question when needed; and turns the conversation into a
   concrete production proposal.
6. The proposal defines the hook + demo execution, asks for `1`, `2`, or `3`
   creative variations, and shows each variation's angle, hook, caption arc,
   selected Demo Clips, payoff, and credit cost. Three is the hard maximum for
   one generation round.
7. Nothing renders until the founder explicitly approves that proposal.
8. HypeJuice renders each approved variation as an independent job. Each
   combines silent creator-style footage, one or more relevant Demo Clips,
   captions, and a payoff.
9. The founder reviews the finished videos as a swipeable deck and chooses
   `Love it`, `Pass`, or `Edit` for each one.
10. `Love it` adds the video to the Library and Launch Queue. `Pass` records a
   negative taste signal. `Edit` collects the requested change and creates a
   new version without overwriting the original.
11. After reviewing the round, the founder can return to the chat to make more
    variations or develop new concepts, or open Launch Queue to arrange loved
    videos by date, time, and intended channel.
12. A real RevenueCat Test Store purchase grants one of three subscription
    tiers and a monthly allowance measured in credits.

This is enough to demonstrate the core idea, a genuine AI/media pipeline,
taste learning, scheduling, and thoughtful monetization. The collaborative
agent chat is part of the core submission; direct social account publishing,
performance analytics, and attribution should follow it.

## 2. Experience and screen map

The visual direction takes the reference's polish, hierarchy, generous spacing,
and product-forward presentation without copying its layouts or branding.
HypeJuice's identity should feel optimistic and editorial: warm off-white
surfaces, near-black type, saturated yellow as the action color, fresh green as a
success accent, rounded but not bubbly cards, large headlines, and purposeful
motion. Product footage remains the visual hero.

### Submission build screens (P0)

| Area | Screen | Working behavior |
| --- | --- | --- |
| Onboarding | Welcome | Explains the workflow and starts anonymous sign-in. |
| App DNA | Add your app | Choose App Store or Website, then provide one link and optional founder context. App Store imports also retain the icon and available listing screenshot URLs; websites stay text-only. |
| Onboarding | App context · Step 1 | Add the app link, then show a centered learning panel with a subtle page-shuffle animation while the agent analyzes the app, vibe, and potential audiences. Keep the same “① Your app” header for link entry and review. App identity, description, screenshots, and story appear in one editable scrollable view, with a pinned “Step 2 · Demo clips” button. No swipe deck, progress bars, or three step boxes. |
| Onboarding | Demo clips · Step 2 | Import videos showing the app in action—screen recordings or footage of someone using it on a phone. Show inline playable previews and label each action/payoff. At least one described clip is required before continuing. The prototype keeps video copies locally; cloud upload and clip analysis remain future work. |
| Onboarding | Content Taste · Step 3 | Generate three real hook + demo videos from saved footage, with distinct short captions. Love it keeps the video in Library without bookmarking; Toss records a dislike. No editing here. Rate all three with server acknowledgment before entering the workspace; later edits start from Library. Persisted caption examples steer subsequent Discover batches. |
| Home | Today | Opens with the Growth Agent prompt, credit balance, active round, queued posts, and the next useful action. |
| Demo Clips | Clip library | Imports multiple recordings, previews them, records each action/outcome, and supports replace/archive. |
| Agent | Growth chat | Provides a persistent conversation where the founder brings hooks/trends or an optional reference, brainstorms, answers clarification, and asks for revisions. |
| Agent | Proposal card | Summarizes the audience insight and shows 1–3 hook + demo variations with distinct creative angles, hook captions, caption arcs, Demo Clips, payoffs, and credit cost. |
| Generation | Round progress | Shows 1–3 independent job states and remains correct after app restart. |
| Review | Taste deck | Plays one finished video at a time with `Love it`, `Pass`, and `Edit` actions plus swipe gestures. |
| Review | Edit request | Accepts a typed change, explains whether it needs a re-composite or new AI footage, and shows its credit cost before submission. |
| Review | Round complete | Offers `Chat about more` or `Open Launch Queue` after every generated variation has a decision. |
| Launch | Launch Queue | Uses a draggable timeline to arrange loved videos by date/time and intended channel. |
| Library | Videos | Plays and downloads every completed version with its suggested post caption and review decision. |
| Monetization | Plans | Uses RevenueCat's native SDK to purchase/restore one of three tiers and shows the credit balance. |

The current navigation is `Home`, `Library`, `Studio`, `Launch Bucket`, and `Your App`.
Growth Agent chat will be reached from Home; profile/settings also belong there.
Demo Clips and initial App DNA setup remain workflow screens. Your App is a
read-only view of the connected app brief, reflecting edits made during setup.

### Honest follow-on screens (P1/P2)

- P1: multi-reference comparison, advanced caption/style controls, and account
  upgrade from anonymous sign-in.
- P1: reusable scheduling presets, reminders, and exported posting packages.
- Deferred: creator-overlay/green-screen compositions until the hook + demo
  generation and review loop is proven reliable.
- P2: OAuth publishing integrations after each platform's review and API
  requirements are satisfied.
- P2: connected performance metrics inside the same agent conversation.
- P2: attribution only when a supported link/install attribution source exists;
  otherwise report correlation and never claim causation.
- Out of initial scope: creator recruitment/bounties and live trend discovery.

## 3. Stack and why

### Mobile

- Expo + React Native + TypeScript
- Expo Router for typed file-based navigation
- TanStack Query for server state and retry/caching behavior
- Zustand only for short-lived editor state; persisted domain data stays in the
  backend
- React Hook Form + Zod for editable App DNA and clip metadata
- `expo-image-picker`/document picker for clip import, `expo-video` for playback,
  and `expo-file-system`/sharing APIs for downloads
- React Native StyleSheet plus a small token system; avoid adopting a large UI
  kit before the visual language is proven

RevenueCat contains native modules, so purchase verification must use an Expo
development build. Expo Go may preview UI but is not accepted as proof of a
working purchase.

### Backend

- Supabase Auth: anonymous users for a frictionless demo, with an email account
  upgrade path later
- Supabase Postgres: relational product data, row-level security, job state,
  taste history, Launch Queue, and the credit ledger
- Supabase Storage: private source clips and generated assets, accessed through
  short-lived signed URLs
- Supabase Edge Functions: authenticated, short API operations and provider
  webhooks

Do not run video compositing in an Edge Function. Hosted functions currently
have a 256 MB memory limit, short CPU limits, and finite wall-clock duration.
Generation is an asynchronous state machine driven by provider task IDs and
webhooks.

### AI and media providers

- Gemini Interactions API for structured App Brief generation. The current
  brief call uses `store: false`; future multi-turn Growth Agent chat will
  persist conversation context in our backend. Function schemas will expose read-only context tools and a
  `propose_production` action; shared Zod schemas validate App DNA, proposals,
  creative variations, and scene plans. The mobile client never parses
  free-form agent prose into product state.
- The model is not given a tool that can spend credits or start provider jobs.
  Explicit approval happens through the proposal card, and the backend creates
  a generation round only when the approved proposal ID, current cost quote,
  and founder identity all match.
- Runway API for a 5-second, `720:1280`, silent creator-style setup scene per
  video. A production round submits between one and three independent jobs.
  Prompts explicitly disallow speech, lip-sync, visible brand marks, UI, and
  copyrighted characters. The provider is wrapped behind a `VideoGenerator`
  interface so it can be replaced.
- Creatomate RenderScript for each final `1080:1920` composition: generated
  setup, one or more real app Demo Clips, timed captions, background treatment,
  and a short payoff card. A render webhook completes each child job.
- A founder-supplied reference video is stored privately and reduced to sparse
  representative frames plus the founder's description. The agent extracts a
  reusable format abstraction—hook shape, setup, turn, payoff, caption rhythm—
  rather than reusing the source's footage, likeness, exact copy, or audio.

Runway and Creatomate are the smallest credible path for the deadline: the app
still performs real generation and real compositing, while provider-managed
queues avoid operating an FFmpeg worker. A post-submission cost-control path can
replace Creatomate with a containerized FFmpeg/Remotion worker.

### App-source ingestion

- Apple App Store URLs: parse the app ID and fetch public metadata from Apple's
  lookup endpoint.
- Website URLs: server-side fetch with a strict timeout, size cap, redirect cap,
  content-type check, private-network/IP blocking, HTML-to-text extraction, and
  storage of source URL/title/retrieval time.
- The App DNA agent receives only extracted public text. It must attach source
  IDs to factual claims and put uncertainty into `unknowns` instead of filling
  gaps confidently.
- Unsupported, blocked, or JavaScript-only pages fall back to a manual app
  description; the flow must not pretend extraction succeeded.

## 4. Agent workflow and typed contracts

The first version is a collaborative, bounded agent workflow, not an autonomous
content machine:

```text
source ingestion
  -> app_dna draft
  -> founder edits and confirms
  -> persistent Growth Agent conversation
  -> agent reads DNA + Demo Clip library + taste summary
  -> brainstorm / founder idea / named trend
  -> focused clarification when required
  -> production proposal with 1–3 variations + credit quote
  -> explicit founder approval
  -> 1–3 independent provider jobs + composites
  -> Love it / Pass / Edit decisions stored as taste events
  -> loved videos enter Launch Queue
  -> founder returns to the same chat with updated taste context
```

### Conversation behavior

The agent should feel like a thoughtful growth teammate:

- It can respond to rough prompts such as “I love the ‘what's your GPA?’ trend;
  let's use that” by reflecting the format it believes the founder means,
  connecting it to the app's audience and product payoff, and advancing toward
  a concrete idea.
- It uses known App DNA, Demo Clip descriptions, and previous taste decisions
  before asking questions the founder has already answered.
- When a trend name is ambiguous or the format cannot be established from the
  founder's description, it asks for the missing detail or a founder-supplied
  reference upload. A pasted social link can be retained as context, but the app
  does not scrape or download third-party content without authorization. It
  must not pretend it has seen a current trend when live trend discovery is not
  connected.
- It asks focused questions that materially affect the output—usually one at a
  time—such as which audience segment, desired tone, or intended product payoff.
- It may recommend an approach and explain why it should resonate, but it does
  not claim guaranteed virality, views, or downloads.
- Once the idea is clear, it asks how many variations to produce (`1–3`) rather
  than assuming three. It may recommend a count, but the founder chooses it and
  changing the count refreshes the credit quote.
- For a multi-variation round, it deliberately spreads the creative angles—for
  example direct question, relatable POV, and confession—then explains why each
  hook/caption path may resonate with the selected audience. The founder can
  ask to replace or rewrite any variation before approval.
- It adapts the underlying format or comedic structure of a trend; it does not
  copy another creator's exact captions, likeness, footage, branding, or audio.
- It always ends planning with an explicit proposal card and `Approve & produce`
  action, never an implied generation.

Read-only tools available during chat are `get_confirmed_app_dna`,
`list_demo_clips`, `get_taste_summary`, `get_recent_video_results`, and
`get_credit_balance`. The agent may call `propose_production` to create or revise
a typed proposal. The founder-facing `Approve & produce` control calls the
backend directly; approval-sensitive generation is not delegated to the model.

### Organic creator-style contract

“Organic creator-style” is a generation constraint, not a vague aesthetic:

- Start from a recognizable audience situation, tension, or curiosity gap—not
  a product feature announcement.
- Use casual phone-camera framing, believable environments, natural gestures,
  and slight visual imperfection rather than glossy commercial staging.
- The AI-generated person never speaks or lip-syncs. Meaning comes from action,
  expression, edit rhythm, and concise on-screen captions.
- Show the real app through the founder's Demo Clips as the proof or payoff;
  never generate a fake version of the product interface.
- Write captions in the audience's language and avoid corporate phrasing,
  unsupported superlatives, hard-sell calls to action, and guaranteed outcomes.
- When adapting a trend, preserve the recognizable setup/turn/payoff grammar
  while making the execution original and specific to the founder's app.
- Every variation uses `hook_demo`; variation means a different creative angle,
  hook, caption narrative, creator setup, demo emphasis, or payoff—not a
  different production format or a few synonym swaps.

### MVP content format — Hook + demo (`hook_demo`)

Every initial video uses the same reliable narrative structure:

1. A 2–5 second silent AI creator scene establishes the relatable hook.
2. A clean cut, punch-in, or match cut moves into the real app recording.
3. The Demo Clip proves the outcome while captions guide attention.
4. A short payoff closes the idea without turning into a conventional ad.

The creator footage and product demo are sequential, so subject extraction is
not required. A round shares this structure and often the same core product
promise, while each variation approaches it through a different audience
tension, hook caption, creator action, caption story, Demo Clip emphasis, or
payoff.

### `ProductionProposal`

```ts
type ProductionProposal = {
  id: string;
  conversationId: string;
  founderRequest: string;
  audienceSegment: string;
  trendReference: {
    label: string | null;
    sourceUrl: string | null;
    interpretedFormat: string | null;
    confidence: "clear" | "needs_confirmation";
  };
  organicRationale: string;
  selectedClipIds: string[];
  variationCount: 1 | 2 | 3;
  variations: CreativeVariation[];
  assumptions: string[];
  unresolvedQuestions: string[];
  creditCostPerVariation: number;
  totalCreditCost: number;
  costQuoteExpiresAt: string;
  status: "draft" | "ready" | "approved" | "superseded";
};
```

Cost fields are attached by the backend, not invented by the model. A proposal
cannot become `ready` while `unresolvedQuestions` is non-empty. Approval stores
the exact proposal revision, variation count, cost quote, and timestamp; later
chat changes create a new revision and require fresh approval.

### `AppDNA`

```ts
type AppDNA = {
  appName: string;
  oneLiner: string;
  audience: Array<{ segment: string; situation: string; sourceIds: string[] }>;
  problems: Array<{ statement: string; sourceIds: string[] }>;
  features: Array<{
    name: string;
    userOutcome: string;
    sourceIds: string[];
  }>;
  messagingAngles: Array<{
    name: string;
    hook: string;
    promise: string;
    proofNeeded: string;
  }>;
  tone: string[];
  avoidClaims: string[];
  unknowns: string[];
};
```

Founder edits are saved separately from the original AI draft so the demo can
show what the agent learned. Confirmation creates an immutable revision used by
downstream generations.

### `CreativeVariation`

```ts
type CreativeVariation = {
  title: string;
  format: "hook_demo";
  creativeAngle:
    | "relatable_pain"
    | "curiosity_gap"
    | "pov"
    | "confession"
    | "before_after"
    | "surprising_demo"
    | "trend_remix";
  hook: {
    caption: string;
    creatorAction: string;
  };
  demo: {
    clipIds: string[];
    focus: string;
    captionBeats: string[];
  };
  payoffCaption: string;
  suggestedPostCaption: string;
  whyItFits: string;
  unsupportedClaims: string[];
};
```

When a proposal contains multiple variations, each must differ from the others
on at least two meaningful dimensions: creative angle, opening hook, creator
action, caption arc, Demo Clip emphasis, or payoff. The variations may reuse the
same Demo Clip when the creative framing is genuinely different, or choose and
combine other clips when useful. Any unsupported claim is visibly flagged
before the round is approved.

### `ScenePlan`

```ts
type ScenePlan = {
  durationSeconds: number;
  postCaption: string;
  scenes: Array<{
    kind: "generated_creator" | "demo_clip" | "payoff";
    startSeconds: number;
    endSeconds: number;
    visualDirection: string;
    onScreenCaption: string;
    sourceClipId: string | null;
    sourceInSeconds: number | null;
    sourceOutSeconds: number | null;
  }>;
};
```

Server validation adds business rules that JSON Schema alone cannot guarantee:
ordered non-overlapping times, total length within 12–20 seconds, at least one
demo segment, caption length limits, and ownership checks for every
`sourceClipId`.

### `TasteDecision`

```ts
type TasteDecision = {
  videoVersionId: string;
  decision: "love" | "pass" | "edit";
  reasonTags: string[];
  editRequest: string | null;
  decidedAt: string;
};
```

`Love it` is a strong positive signal and creates a Launch Queue item. `Pass` is
a negative signal, with optional quick reasons such as weak hook, wrong vibe,
too generic, or poor demo match. `Edit` records both what was retained and the
founder's typed direction. The agent receives a compact, evidence-based taste
summary on the next round; it does not infer a permanent preference from a
single decision.

## 5. Batch generation, review, and scheduling

### Production round

A `content_batch` owns one approved proposal and between one and three variation
jobs. The mobile app presents it as a production round, while the backend can
retry or refund each video independently. Jobs may run concurrently subject to
provider rate limits; one slow or failed job does not block review of videos
already ready.

```text
proposal_ready
  -> founder_approved
  -> credits_reserved
  -> producing
  -> partially_ready
  -> ready_for_review
  -> reviewed

Each child video:
draft
  -> queued
  -> generating_scene
  -> compositing
  -> quality_check
  -> ready

Any child provider step -> failed (that video's credit reservation released)
Founder cancellation before final output -> cancelled (that reservation released)
```

1. `POST /production-proposals/:id/approve` validates the proposal revision,
   explicit approval, `1–3` variation count, current cost quote, and an
   idempotency key.
2. A database transaction marks the proposal approved, creates the round and
   its child jobs, and makes one credit reservation per variation. The proposal
   card shows per-video and total cost.
3. The API submits each Runway task, saves its external task ID, and returns
   immediately.
4. A verified provider webhook stores the generated asset and advances the job.
5. The server submits the hook + demo Creatomate RenderScript using signed
   source URLs.
6. The verified render webhook copies the final file to private storage. A
   lightweight quality check verifies duration, dimensions, decodability, and
   scene ordering before marking it ready and committing that video's credit
   reservation.
7. Failures store a user-safe reason, preserve diagnostic details privately,
   and release only the failed video's reservation. Retrying creates a new
   attempt under the same video project without duplicating charges.

Every transition is conditional on the expected previous state. Duplicate or
out-of-order webhooks are safe no-ops. Provider secrets never enter the app.

### Review deck behavior

- The deck displays one playable result at a time and a visible `1 of N`
  position, where `N` is between one and three. Buttons and swipe gestures map
  to the same accessible actions.
- `Love it`: records a positive decision, stores the video in Library, and
  creates an unscheduled Launch Queue item.
- `Pass`: records a negative decision and optional reason tags. The file remains
  in Library history but is excluded from Launch Queue.
- `Edit`: opens a text field and optional change categories. The server
  classifies the request as a caption/trim re-composite or a new-footage
  regeneration, then shows the credit cost before the founder confirms.
- Once every generated video has a decision, the completion screen offers
  `Chat about more` and `Open Launch Queue`. Returning to chat carries the
  decisions into context so the agent can suggest a refinement, meaningful new
  variations, or a fresh concept rather than superficial rewrites.

### Launch Queue behavior

- Loved videos enter as unscheduled cards.
- A founder drags a card onto a day/time slot or opens a schedule sheet with
  local date, time, timezone, intended channel, and optional caption edits.
- Supported channel labels for the first version are TikTok, Instagram Reels,
  and YouTube Shorts, but they represent posting intent only.
- Until a platform account is genuinely connected and its publishing API is
  approved, the item uses `manual_post` mode: HypeJuice provides a reminder,
  download, and copyable caption. It must not show a fake `published` state.
- Queue items retain their linked video version so later edits cannot silently
  change a scheduled asset.

## 6. Data model

| Table | Purpose |
| --- | --- |
| `profiles` | User identity, onboarding state, preferences. |
| `apps` | One founder-owned product and canonical source URL. |
| `source_snapshots` | Retrieved public text, metadata, and retrieval status. |
| `app_dna_revisions` | AI draft, founder-edited content, confirmation state. |
| `demo_clips` | Reusable private clip library with duration, label, action, outcome, tags, and archive status. |
| `reference_assets` | Founder-supplied inspiration, private sampled frames, description, and abstracted format. |
| `agent_conversations` | App-scoped chat thread, provider conversation ID, and compact context summary. |
| `chat_messages` | Founder/agent messages and structured content cards for UI history and audit. |
| `production_proposals` | Versioned founder request, interpretation, 1–3 count, cost quote, and status. |
| `proposal_variations` | Creative angle, hook, caption beats, Demo Clip emphasis, payoff, and scene-plan preview. |
| `generation_approvals` | Immutable founder, proposal revision, cost, count, and approval timestamp. |
| `content_batches` | One approved production round containing one to three child video jobs. |
| `video_projects` | Stable project identity across versions. |
| `video_versions` | Immutable scene plan, status, output asset, post caption. |
| `generation_jobs` | Attempt state, provider task IDs, errors, idempotency key. |
| `taste_events` | Love, pass, or edit decision, reason tags, and typed edit request. |
| `taste_profiles` | Regenerable summary of repeated positive/negative preferences. |
| `launch_queue_items` | Loved version, scheduled time/timezone, channel, caption, and posting mode. |
| `assets` | Owner, type, storage path, provenance, duration, dimensions. |
| `entitlement_snapshots` | Last backend-observed RevenueCat entitlement state. |
| `credit_grants` | Monthly or promotional credit grants and expiration. |
| `credit_ledger` | Append-only reserve, commit, release, and adjustment entries. |
| `webhook_events` | Unique provider event IDs and processing result. |

All founder-owned rows include `user_id` and row-level security. Storage paths
start with that user ID. Service-role access is restricted to server functions.
The app derives the credit balance from the ledger; it does not update a mutable
counter.

## 7. RevenueCat, subscription tiers, and credits

**Current implementation update:** the native RevenueCat SDK, Plans screen,
purchase/restore calls, and independent server-side Studio entitlement gates are
integrated. The current model is **Free + Pro (`growth_pro`) + Power (`growth_power`)**,
not three paid subscriptions. Prices come from RevenueCat offerings. Pro and Power
currently unlock the same Studio access; differentiated generation allowances and
credits are not implemented or finalized. Local development remains unlocked while
unconfigured; authenticated mode fails closed. Test Store/native purchase testing
is explicitly deferred. See [REVENUECAT.md](REVENUECAT.md).

The following three-tier/credit sections are the earlier roadmap, not current behavior.

### Offer

Offer three monthly subscriptions. Final names, prices, allowances, and feature
gates remain a product decision; keep them in backend plan configuration rather
than hard-coding them in screens.

| Tier | RevenueCat entitlement | Monthly credits | Feature scope |
| --- | --- | --- | --- |
| Tier 1 | `growth_starter` | TBD | Core App DNA, Demo Clips, batches, review, and manual Launch Queue. |
| Tier 2 | `growth_pro` | TBD | More credits plus additional editing/generation capabilities, to be decided. |
| Tier 3 | `growth_studio` | TBD | Highest allowance plus advanced workflow features, to be decided. |

Credits are the visible usage currency. The UI should say, for example, “This
video uses 10 credits” and “This round uses 30 credits,” using values loaded
from configuration. Each variation is charged independently even when up to
three are approved together.

- App DNA, concept pitches, taste decisions, and Launch Queue organization do
  not consume credits.
- A standard video with new AI footage and a final composite consumes a
  configurable number of credits.
- Caption, timing, or Demo Clip edits that only require re-compositing may cost
  fewer or zero credits; new AI footage costs the normal generation amount.
- Every Edit request shows its classification and exact credit cost before
  confirmation.
- No rollover in the initial model; promotional credits may have a separately
  displayed expiration.
- Tier feature checks are server-defined capabilities, not scattered product-ID
  comparisons in the app.

The exact economy should be finalized after measuring real provider cost per
successful video. The important UX is that each credit charge maps to an
expensive action and that free feedback never feels punitive.

### Granting and spending credits

- RevenueCat initial-purchase, tier change, and renewal webhooks create a period
  credit grant using the unique event ID. Duplicate delivery cannot create a
  second grant.
- The RevenueCat App User ID equals the Supabase user ID, so device entitlement
  state and backend credit ownership refer to the same person.
- Creating each child render reserves credits with the unique key
  `video_version_id:attempt_number`.
- A completed final render commits the reservation.
- A failed provider task, timeout, or cancellation releases it automatically.
- Client retries return the existing job for the same idempotency key.
- The app resolves the active tier from the three RevenueCat entitlements, but
  the backend independently checks stored webhook state before spending
  credits or allowing a gated capability.
- Restore Purchases is available from both the paywall and Settings.

### Test Store verification

1. Create a RevenueCat project with three Test Store subscription products,
   three tier entitlements, and one current offering.
2. Use `react-native-purchases` version `9.5.4` or newer; that is the documented
   minimum React Native version for Test Store.
3. Configure the Test Store API key only in a debug/development build.
4. Build an Expo development client for an iOS simulator or Android
   emulator/device. Do not use Expo Go as purchase proof.
5. Open the paywall, choose the success outcome in the Test Store purchase
   sheet, and assert all four results: `CustomerInfo` has the active entitlement,
   correct tier UI unlocks, the transaction appears in RevenueCat sandbox data,
   and the backend webhook creates exactly one credit grant.
6. Repeat with cancel and failure outcomes; entitlement and credits must remain
   unchanged. Test tier changes, Restore Purchases, duplicate webhooks, and
   accelerated expiration as separate cases.

Test Store keys deliberately fail in release builds, so a future TestFlight or
store build must use the platform-specific key and platform sandbox.

## 8. Stage gates

Development target: Expo SDK 57 with matching React Native/native modules,
matching the SDK 57 support reported by Expo Go on the founder's iPhone.
This allows testing onboarding and App DNA without Xcode. A downgrade to SDK
54 was reverted after the phone reported a version mismatch.
`npm start` explicitly uses Expo Go over
LAN. The local API must also be reachable from the phone via the Mac's Wi-Fi
address. A development build is still required for the later native purchase
verification described above.

Implementation status (September 27, 2026): the first Stage 0/1 prototype is
working. It includes the Expo visual foundation, onboarding, App Store/website/
founder-note intake, guarded server-side source extraction, structured AI App
Brief generation, an honest source-only fallback, editable review, and local
persistence. Automated typechecks, API tests, a live public App Store ingestion
check, and an Expo web export pass. Supabase auth, immutable server revisions,
CI, and the Demo Clip handoff remain open, so Stage 0 and Stage 1 are not yet
fully closed.

App Brief refinement: onboarding now follows App context → Demo clips → Content
Taste. Step 1 includes link entry, a centered analysis overlay, and one scrollable
app overview/story review with a consistent numbered-circle header. Step 2 imports and previews
multiple real recordings, stores device-owned copies and metadata, and requires
an action/outcome note for each clip. Step 3 now prepares three local starter
storyboards, with distinct hooks, editable captions, placeholder creator choices,
and selected demo clips. Love/Toss decisions and edits stay in session; all three
must be rated to enter the tabbed workspace. The old audience/tone selection
requirement no longer blocks onboarding. Step 1 still shows audience/vibe insights. Store
screenshots come directly from Apple metadata, with missing or failed images
hidden. Only media URL references are held in the session at this stage; durable
image storage and image analysis remain deferred. The extra payoff and sample
caption review steps were removed; Content Taste now provides concrete storyboard feedback instead.

Workspace prototype: Home/Discover, Library, Studio, Launch Bucket, and Your App
are implemented. Library retains all concepts and supports caption-only edits.
Launch Bucket uses a separate queue flag (no duplicate queue entries), and
saves channel/date/time draft plans; nothing is actually scheduled or published.
Your App reads the same connected profile as onboarding; no analytics screen remains.
No generation API, character rendering, taste-learning model, chat, publishing,
analytics connection, or credit charging is included in this UI slice.

Prototype reset behavior: app profiles are session-only. Each fresh app launch
or Expo/browser reload starts disconnected and clears the old saved-profile key.
App/brief edits and preferences remain available while navigating the same
session, but do not survive a reload. Resetting does not delete original videos
or app-owned imported file copies; their profile associations reset. Production
account persistence remains a later milestone.

Verification preference: keep automated checks to essential typechecks and
relevant foundational tests. The founder handles detailed interaction/device
testing; do not routinely repeat comprehensive UI suites or bundle exports.

Step 1 layout: the same numbered-circle indicator identifies both link entry
and app review as one step. The loading panel describes what the agent is
learning without fake percentages or completed-stage claims. Once ready, all
app details scroll together and the Step 2 action remains at the bottom.

Automatic feed policy (generation is not implemented yet): after explicit
generation approval and credit-cost confirmation, make three distinct
`hook_demo` videos for the founder's review feed. Sample different audience,
tone, hook, caption, and demo combinations informed by app context and Content
Taste reactions rather than forcing every video toward one persona. Explore
plausible adjacent audiences. Record concept/caption fingerprints and recent
audience-tone combinations; reject exact repeats within and across batches.
Love it adds to Launch Bucket (the queue), Toss records negative taste feedback, and Edit
captures the requested revision. Use those signals to adjust future batches,
not permanently exclude an audience because of one pass. Manual chat can target
any audience or tone regardless of onboarding reactions. A learned graph and
generation-history deduplication are future work, not implied by saving these
prototype ratings. Before generating actual Step 3 videos, show an explicit
approval and credit quote; local storyboards currently incur no generation cost.

### Stage 0 — foundation and visual system

Deliverable: an Expo TypeScript development-build project, environment example,
CI checks, Supabase local config, base navigation, and polished static shells for
the P0 flow.

Acceptance: the app builds for an iOS simulator, navigation works, empty/loading/
error states are visible, and no provider secret is in the bundle.

### Stage 1 — App DNA

Deliverable: anonymous auth, URL ingestion, source snapshot, structured draft,
editing, and confirmation.

Acceptance: a real public URL produces a saved draft; edits survive restart; a
failed extraction falls back honestly to manual entry; a confirmed revision is
immutable.

### Stage 2 — Demo Clips and Growth Agent

Deliverable: a reusable multi-clip library plus persistent Growth Agent chat,
context tools, clarification behavior, and an approvable proposal card for one
to three variations.

Acceptance: multiple clips play from private storage; the agent can turn a rough
founder idea or named trend into a grounded proposal, asks for missing context
instead of bluffing, turns it into a specific `hook_demo` execution, uses actual
clip metadata, produces meaningfully different hook/caption angles when more
than one variation is requested, and cannot generate before the founder
approves a valid credit quote.

### Stage 3 — generation, taste review, and Launch Queue

Deliverable: an approved 1–3 variation round with webhook-driven Runway and
Creatomate child jobs, persisted progress, swipeable taste review, edits,
versioning, playback, download, and Launch Queue scheduling.

Acceptance: every generated 12–20 second video follows the organic creator-style
contract, contains relevant real app recordings, readable captions, and a
payoff. Love adds an item to Launch Queue, Pass affects the next agent turn, and
Edit preserves the original. Force-failing one child leaves the others usable
and releases only that child's credits. The quality suite verifies the creator
hook, transition, real Demo Clip, caption timing, and payoff in every variation.

### Stage 4 — RevenueCat

Deliverable: three-tier offering fetch, paywall, Test Store purchase,
entitlement/capability gate, restore flow, webhook grant, and idempotent credit
ledger.

Acceptance: success/cancel/failure/restore are verified in an Expo development
build; switching tier grants the configured allowance; a duplicate webhook or
button retry cannot double-grant or double-spend credits.

### Stage 5 — submission polish

Deliverable: app icon, required screenshot, seed/demo path, public setup docs,
architecture diagram, privacy notes, demo script, and final device recording.

Acceptance: a new evaluator can configure and run the project from the README;
the complete device demo is under two minutes and uses only owned or permitted
media.

## 9. Submission checklist verified against current rules

The official rules currently set the submission deadline to **September 30,
2026 at 11:45 PM PDT**. Before final submission, recheck the rules page for
changes.

- Active student in high school, college, university, bootcamp, or another
  academic program
- Qualifying student/academic email on Devpost
- If applicable, parent/guardian consent for an entrant aged 13 through the age
  of majority
- App runs on iOS, iPadOS, macOS, or Android and is accessible from the US
- RevenueCat SDK powers at least one working purchase
- Next Gen entry may use the special path with no App Store/Google Play release
- Public open-source repository with all source/assets/setup instructions
- Visible open-source license (the repository already has MIT)
- English project description
- Public YouTube or Vimeo demo under two minutes, showing the app working on its
  intended device
- 1024 x 1024 app icon
- At least one 1179 x 2556 screenshot without a device frame
- No unlicensed trademarks, music, footage, or other third-party material

Official references:

- [Shipaton 2026 rules](https://revenuecat-shipaton-2026.devpost.com/rules)
- [RevenueCat Test Store](https://www.revenuecat.com/docs/test-and-launch/sandbox/test-store)
- [RevenueCat with Expo](https://www.revenuecat.com/docs/getting-started/installation/expo)
- [RevenueCat products, entitlements, and offerings](https://www.revenuecat.com/docs/projects/configuring-products)
- [Gemini structured outputs](https://ai.google.dev/gemini-api/docs/structured-output)
- [Gemini API getting started](https://ai.google.dev/gemini-api/docs/get-started)
- [Runway API quickstart](https://docs.dev.runwayml.com/guides/using-the-api/)
- [Runway input dimensions](https://docs.dev.runwayml.com/assets/inputs/)
- [Creatomate render API](https://creatomate.com/docs/api/reference/create-a-render)
- [Supabase Edge Function limits](https://supabase.com/docs/guides/functions/limits)

## 10. Immediate next decision

Review the three-step onboarding on the founder's iPhone in Expo Go, then finish the
Stage 1 persistence contract with Supabase anonymous auth, source snapshots,
and immutable confirmed revisions. Local Demo Clip intake is implemented;
add durable cloud uploads and clip processing next, followed by the
first persistent teammate chat/proposal loop—including clarification, variation
count, credit quote, and explicit approval—before connecting generation
providers.
