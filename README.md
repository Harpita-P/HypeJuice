# GrowthBanana

GrowthBanana is an AI growth teammate for solo app founders. A founder chats
with the agent about hooks, trends, and audience problems; the agent clarifies
the idea, and collaborates on organic creator-style content. Discover will offer
five fresh videos per batch, while Studio creates one individually directed
video at a time. Further Discover batches require confirmation. Initial videos use a focused hook + demo format: a
short silent creator hook followed by the founder's real app footage and payoff.
Each round explores different creative angles, hooks, and caption narratives
inside that same format.

The implementation is progressing as vertical slices. The first working slice
covers onboarding and App DNA: a founder can submit an App Store link, website,
or founder note; the server extracts the public source material; and the growth
agent returns an editable brief.

## Current status

- Expo SDK 57 + Expo Router TypeScript app for iOS, Android, and web, matching
  the SDK 57 version of Expo Go installed on the founder's iPhone
- Branded onboarding with an App Store/Website selector and one link at a time
- Three onboarding steps: App context → Demo clips → Content Taste.
  Their screen labels are “Share what you built”, “Show how it works”,
  and “Content Taste”. Step 1 previews three audience pills with simple,
  recognizable group names; Step 3 replaces audience/tone selection with ratings.
  Step 1 covers link entry and the full editable app review under the same
  numbered-circle header. A centered learning panel appears during analysis;
  app identity, description, screenshots, and story share one scrollable view,
  with a pinned Step 2 button instead of a swipe deck or three step boxes
- App Store icon and available listing screenshots displayed in a compact
  carousel with full-screen preview; website imports remain text-only
- Server-side App Store and website ingestion built with URL validation,
  timeouts, redirect limits, and response-size limits
- Structured Gemini brief generation wired through the Interactions API; a clearly
  labeled source-based draft keeps local development usable without an API key
- Multiple app-in-action video imports (screen recordings or someone using the
  app on a phone), inline previews, and editable action/outcome
  notes; native recordings are copied into app-owned device storage (browser
  recordings use IndexedDB), with a 250 MB per-clip limit
- Four numbered demo-clip slots with tap-to-add placeholders; roughly ten-second
  clips are recommended, not enforced as a duration limit
- Content Taste now generates three real videos using the same saved-footage pipeline
  as Discover. Each has a different short hook/demo caption pair. Review with Love it
  or Toss only; Love it saves to Library Favorites, never Launch Bucket. All three
  ratings must be confirmed by the server before entering the workspace. Change a
  choice by revisiting its numbered tab; edit captions later from Library.
- Discover writes
  five short Gen-Z-style, first-person hook/demo caption pairs with Gemini, mixes
  saved shared creators with uploaded app demos, and assembles real videos in FFmpeg.
  It never requests a new Higgsfield creator. Initial and subsequent batches require
  confirmation; finished results appear progressively with Save, Launch, Skip,
  Download, and Share. Caption history survives reloads and blocks normalized exact
  and high-word-overlap repeats; this is not a guarantee of global semantic novelty.
- Library has All/Favorites pills and Most recent/Oldest first sorting. Finished
  videos autoplay in visible tiles, with heart and launch-bucket controls. Saving
  and queueing are independent; skipped content remains available.
- Every new Taste, Discover, and Studio video includes a separate platform post
  caption (maximum 15 words) and 1–5 distinct, relevant hashtags. These are saved with the job, never
  burned into the MP4. Full video players show a Reels-style footer: white post
  text and hashtags over a dark gradient, with “more” opening the full selectable
  text. This replaces separate post-copy cards/buttons; Library grid tiles stay
  uncluttered. Native fullscreen playback shows only the MP4. Older videos
  are not automatically backfilled. New Studio jobs require Gemini for this text
  step before video generation; overlay revisions also get refreshed post copy.
  Review players use taller, screen-relative frames. Taste/Discover keep Download
  and Share available as small over-video buttons instead of a separate action row.
- The agent uses 80 reusable UGC story patterns in `shared/ugc-formats.ts`, separate
  from finished copy. Each Taste/Discover batch uses distinct format IDs spanning
  at least three categories. Recent format usage prioritizes less-used families;
  Love/Toss memory retains the format ID to guide later prompts. Fit to the app
  and available footage takes priority over forcing a pattern. No performance
  metrics are inferred from these ratings; publishing/results ingestion is deferred.
- Studio now has a real-provider path: a prompt creates a silent 4-second portrait
  creator clip via Higgsfield/Seedance 2.0 (its minimum); local FFmpeg trims the hook
  to 3 seconds and joins it to 1–10 seconds of
  the uploaded demo and burns in two stationary white/black-outline captions.
  Private Supabase Storage holds the demo, raw hook, and finished MP4. Requires
  server credentials and explicit approval for paid Higgsfield generation.
  A real 720×1280 local assembly from saved footage has been verified. Caption-only
  re-rendering reuses saved footage without a Higgsfield or Creatomate charge.
- Five tabs: Home, Library, Studio, Launch Bucket, Your App. Your App shows the
  connected app’s latest brief, story, audience/vibe insights, and available
  App Store icon/screenshots. The App Impact screen has been removed. Launch plans save
  channel/date/time drafts only. A Studio avatar picker, advanced taste modeling,
  chat, publishing, and private download analytics are not connected yet.
- Session-only app context: a fresh launch or Expo/browser reload resets the
  connected app, brief, clip associations, local caption edits, and draft plans. Navigation within
  the running session retains edits. Previously saved profiles are cleared;
  original videos and local imported file copies are not deleted.
- Studio jobs and Discover batches are exceptions to the prototype reset: the single-user test
  server saves jobs in ignored `.studio-data/` and videos in your private bucket.
  Studio → Recent renders and Discover → Refresh saved batches restore results
  for the connected app after a reload. Explicit caption ratings and rendered-video
  Favorites persist in per-app memory; draft launch plans remain session-only.
- Server unit/API tests and Expo web export passing

Read [the implementation plan](docs/IMPLEMENTATION_PLAN.md) for the proposed
vertical slice, dependencies, acceptance criteria, and deferred work.

## First real Studio video

1. Add the Studio variables from [.env.example](.env.example) to your existing
   `.env` (keep your Gemini key and LAN API URL):
   - `HF_CREDENTIALS`: Higgsfield API key ID and secret, joined with a colon.
   - No Creatomate key is needed for new videos. Keep `CREATOMATE_API_KEY` only
     if you want to recover/poll older Creatomate jobs.
   - `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`: your Supabase project URL and
     server-only service-role key. Never enter this key in the mobile app.
   - `SUPABASE_STUDIO_BUCKET`: defaults to `growthbanana-studio`.
   - `STUDIO_ALLOW_UNAUTHENTICATED=true`: explicitly enable code-free Studio for
     your own computer/trusted LAN. Disabled by default and when `NODE_ENV=production`.
     The old `STUDIO_ACCESS_TOKEN` is no longer used and can be removed.
2. In Supabase Storage, create that bucket as **private**, and configure its
   allowed MIME types/file-size limit for your video clips (up to 250 MB;
   project/plan limits may be lower). No public read policy is required.
3. Install FFmpeg (including `ffprobe`) on the API server, with the `libx264` encoder
   and `overlay` filter. On macOS: `brew install ffmpeg`. Run `npm install` for the
   server-side caption renderer. The Manrope Bold font comes from the existing font
   dependency; the build does not require FFmpeg's optional `drawtext`/subtitle filters.
   If needed, set `FFMPEG_PATH` / `FFPROBE_PATH` to executable paths.
   Restart `npm run api`. Keep it running. Open Studio on your phone; no signup,
   login, or access code is needed. All provider keys stay on your server.
   **Use only your own computer/trusted LAN.** Anyone who can reach this API can
   access Studio jobs/media and spend your provider credits. Do not expose the API
   through a public URL, port forwarding, or tunnel. The opt-in setting is not a
   security boundary; public deployment requires HTTPS and real authentication/
   ownership checks. Open-source users must supply their own server-side keys.
4. Enter an adult fictional creator prompt, a hook caption, a demo caption,
   and select a demo clip. Choose 1–10 seconds from its beginning and the demo
   caption placement. Unknown clip durations must be checked manually.
5. Review and check **I approve this paid Higgsfield request**, then **Generate 1
   video**. Only creator generation uses Higgsfield credits. FFmpeg assembly runs
   locally with no per-render API charge; hosting/storage costs still apply.
   There is no fixed in-app cost quote or GrowthBanana banana ledger yet.
6. Leave Studio open while the pipeline progresses. A finished MP4 appears in
   Studio and Library. Saved assets use signed playback URLs (24 hours); Recent
   renders / Refresh playback renews them. Screen recordings are fitted without
   cropping, and both source clips are muted.
7. Every finished-video preview has **Download** and **Share** buttons. On your
   phone, Download asks for permission to save the MP4 to your photo library;
   Share opens the native share sheet with the video file (no Photos permission
   needed). Both refresh private links automatically and reuse the saved video,
   with no new generation/render charge. Keep the API running. On web, Download
   saves a file; supported browsers offer file sharing with a second **Share now**
   tap. Restart Expo after installing the export dependencies; custom native builds
   need rebuilding for the photo-library permission configuration.

**Retry behavior:** a request ID is persisted before each paid submission. A
double tap/retry with the same ID doesn't intentionally resubmit it. A provider
timeout can still mean it accepted the request; the app will stop and ask you to
check the provider dashboard rather than risk another charge. Render failures
can reuse the saved creator clip. Caption editing starts a new local FFmpeg render,
with explicit approval, and replaces the Library result when successful. Original
files remain in storage. New jobs persist `assembly: "ffmpeg"`; older jobs retain
their Creatomate lifecycle so existing renders can still be recovered.
If the API restarts, polling a known job resumes recorded provider IDs; an
interrupted submission without an ID is marked for manual review. Status polling
drives the pipeline: resume it with Recent renders if you close the app.

This is a one-founder, single-server test, not a multi-user production queue.
Do not delete `.studio-data/` while jobs are active. Jobs, uploaded footage,
prompts, and outputs are retained until you remove them; no automatic retention
policy is implemented. Content Taste and Discover both render real videos from saved footage.

Local assembly wraps static captions into transparent PNGs, overlays them on each
segment, and encodes H.264 at 720×1280/30 fps with no audio. Demo footage is fitted
without cropping. One encode runs at a time per server process, with a three-minute
FFmpeg timeout. Temporary input/overlay/output files are removed after each attempt;
the original cloud clips and archived final MP4 are retained. Interrupted local
assembly can be rerun without paid provider requests.

To try local assembly of a completed job's saved clips without generating a creator:
`node --import tsx server/try-local-render.ts <original-job-id>`.
It creates a separate revision; open Studio → Recent renders and select the newest
result to import it into Library. The original video is not overwritten in storage.

### Discover: five videos from reusable footage

Keep the API running, connect your app, and add 1–4 demo clips. Open Home → Discover
and tap **Create my first 5 videos**. Gemini writes two short, first-person static
captions per video (hook: ≤9 words/65 characters; demo: ≤12 words/90 characters),
grounded in the app brief, audiences, and each demo's description. No claims of
actual customer testimony or fabricated outcomes are requested. Copy quality still
needs founder review before publishing. Gemini text usage and server/storage costs
apply; there is no Higgsfield or Creatomate generation/render charge in Discover.

`server/creator-library.json` is an explicit shared catalog of private storage paths
and creator descriptions. It initially references the two distinct creator files
already saved on this test server. Source videos are NOT bundled in the repository;
other self-hosted installations must upload their own licensed creator MP4s (at least
3 seconds) to their bucket and edit the catalog or set `DISCOVER_CREATOR_LIBRARY`.
Add catalog entries to grow the pool. New Studio clips are archived but are **not**
automatically shared with other apps/users. The shared catalog uses operator-approved
creator footage only; demo footage is selected from the current app's uploads.

Clip selection uses shuffled cycles so available creators and demos are represented;
with only one demo, it is reused across all five. Every final hook is 3 seconds,
followed by up to 8 seconds of the selected demo (clamped to its real duration).
Old completed videos are not changed. Older queued jobs keep their recorded timing.

Batches, captions, clip assignments, and job IDs are journaled in `.studio-data/`.
Duplicate batch IDs reuse existing work; a conflicting payload is rejected. One
worker handles batches and one encoder runs at a time. Discovery polling/restoration
resumes interrupted work after an API restart. Caption writing can make up to two
Gemini attempts for validation; an interruption before captions are saved may require
another text request. Render retries keep saved captions/footage and skip successes.
Caption history is checked across all saved batches and Studio jobs for the same app;
deleting server journals loses that history. This remains a trusted-LAN, single-process
prototype, not a public multi-user service. Authentication, ownership, and production
queue/worker infrastructure are still required before public access.

### Content Taste and caption memory

After Step 2, Step 3 offers **Make my 3 videos** with Gemini/storage usage disclosed.
It uses a `purpose: "taste"` batch of three, versus Discover's five. Taste batches
restore independently and don't appear as new Discover batches; all their finished
videos remain in Library. Retrying assembly reuses the same captions and clips.

Love it and Toss are saved to `.studio-data/feedback-<app-key-hash>.json` before the
UI counts the rating. Each record snapshots the actual server-side hook/demo text,
creative title, audience, and available copy-style tags. Votes are scoped to the
connected app key, upserted per rendered job, and can be changed without duplicate
votes. A failed save leaves the previous rating intact and can be retried. Love it
saves a Favorite, not a launch selection. Subsequent Save/Favorite actions provide
positive feedback; Unsave is neutral, not a dislike. Scrolling past or Skip does not
invent a negative reason. Launch selection is a separate session-only choice.

Before writing future captions, Gemini receives up to 30 recent liked and 30 tossed
examples from this durable memory. Instructions steer toward liked copy patterns,
away from repeatedly disliked patterns, and still explore new angles. One reaction
is weak evidence, not proof of why the founder disliked the video or a reason to
exclude an audience. This is **prompt-level preference memory**, not model-weight
fine-tuning or a guarantee that every next caption will be better. All votes remain
on disk until the operator removes their memory file; captions are still checked
against generation history for repeats. In this one-founder prototype, memory is
per connected app key (the same link/name), not per authenticated user. App-specific
identity reconciliation and multi-user authorization are not implemented.

Provider references: [Higgsfield text-to-video](https://open.higgsfield.ai/models/bytedance/seedance-2.0/text-to-video/api-reference),
[FFmpeg filters](https://ffmpeg.org/ffmpeg-filters.html),
[private Supabase downloads](https://supabase.com/docs/guides/storage/serving/downloads).

## Run locally

Use Node 22 LTS (`nvm use` reads the included `.nvmrc`). Then:

```bash
npm install
```

If `.env` does not exist yet, copy `.env.example` to `.env`. Keep an existing
`.env` so you do not overwrite your API key.

Replace the `GEMINI_API_KEY` placeholder in `.env` with your Gemini key for AI
synthesis. `GEMINI_MODEL` defaults to `gemini-3.8-flash`. The key is read only by
the local API server and is never included in the Expo bundle. Without it, the API
returns a source-grounded starter draft marked `source_draft`.
After changing the key, restart `npm run api`. Brief generation follows
[Google's structured-output API](https://ai.google.dev/gemini-api/docs/structured-output)
and validates the response against the shared App Brief schema.

## Test on your iPhone (no Xcode)

1. Install **Expo Go** on your iPhone. Its supported SDK must match this
   project's SDK 57. If it reports a mismatch, use the SDK version shown in
   the installed app's error message to diagnose it.
2. Connect the iPhone and Mac to the same Wi-Fi network. Allow Expo Go access
   to your local network if iOS asks.
3. Set `EXPO_PUBLIC_API_URL` in `.env` to `http://YOUR_MAC_IP:8787`. Find your
   Mac's IP in System Settings → Wi-Fi → Details → TCP/IP. Do not use
   `localhost` or `127.0.0.1` on a physical phone: those refer to the phone.
4. Start the API in one terminal inside this repository:

```bash
npm run api
```

5. In a second terminal, stop any old Expo server with Ctrl+C, then start:

```bash
npm start -- --clear
```

6. Scan the terminal QR code with the iPhone Camera and open it in Expo Go.
   Leave both terminals running while testing. Sign in to the same Expo account
   in Expo Go and via `npx expo login` if prompted.
7. Complete onboarding, choose App Store or Website, enter the link, and tap
   **Analyze with Growth Agent**. Review the app context, import at least one app-in-action clip
   and describe its action/payoff. In Content Taste, tap **Make my 3 videos** and
   rate each finished video with Love it or Toss. Open the workspace to edit
   captions from Library, browse Discover, and make separate launch selections.

If onboarding opens but the brief cannot load, visit
`http://YOUR_MAC_IP:8787/health` in iPhone Safari. It should return JSON with
`"ok": true`. If it does not, check the API terminal, Mac firewall access for
Node, and whether your Wi-Fi blocks communication between devices. Changing
Wi-Fi may change your Mac's IP; update `.env` and restart Expo afterward.

The Expo QR code serves the mobile app on port 8081; the separate API uses port
8787. An Expo tunnel alone does not expose the API.

The installed Expo Go app on the founder's iPhone reports SDK 57 support.
The project was restored to SDK 57 after a downgrade to SDK 54 caused an
observed compatibility error. Match the actual installed app, rather than
assuming a particular SDK based on an App Store availability claim.

`EXPO_PUBLIC_API_URL=http://127.0.0.1:8787` works for the iOS simulator and web.
For a physical device, replace `127.0.0.1` with your computer's LAN IP. For the
Android emulator, use `http://10.0.2.2:8787`.

Run verification with:

```bash
npm run check
```

Keep routine verification lean: typechecks and relevant foundational tests.
The founder handles detailed feature and device testing; avoid repeatedly
running full browser suites and bundle exports for small UI changes.

Optional: `npm run test:ui` uses local Chrome and an Expo server on port 8083 to check the
flow at an iPhone-sized viewport. It uses fixture API responses and images,
including empty/failed galleries, so no Gemini requests are made.

Recordings currently stay on this device/browser; there is no cloud upload,
automated clip analysis, or video generation yet. Import from your Photos library
using [Expo ImagePicker](https://docs.expo.dev/versions/v57.0.0/sdk/imagepicker/).
Removing a clip from the profile does not delete its source or local copy.
Reimport an app link to get a fresh AI brainstorm of 6–8 potential audiences;
older briefs receive explicitly labeled starter hypotheses instead.

Content preferences seed the planned automatic feed, not a single exclusive
audience or restrictions on manual agent chat. Five audiences start selected;
choose at least five, add your own, or select all. Surprise me permits exploration
beyond those picks. Select any number of UGC content tones. Saving does not
generate videos or spend bananas. Future batches contain three distinct
hook/demo concepts, with Love it → Launch Queue, Pass → taste feedback, and Edit.

App Store visuals are sourced from Apple metadata (phone screenshots, or iPad
screenshots if the phone list is empty). If none are returned, no gallery is
shown. These are saved URL references, not permanent copies of the image files;
image understanding and a hosted asset library are not implemented yet. Existing
briefs need a fresh App Store import to acquire the new media metadata.

## License

[MIT](LICENSE)
