# Manual YouTube post tracking

Post a finished HypeJuice video yourself, then attach its public URL in Launch
Bucket. This feature does **not** upload, schedule, verify channel ownership,
verify Shorts classification, retrieve comment text, or feed YouTube data to AI.
Other platform icons are intentionally disabled. A linked label is not proof that
HypeJuice published the video or that the uploaded file matches the original.

## Setup

1. In Google Cloud, select/create your project and enable **YouTube Data API v3**.
2. Create an API key and restrict it to YouTube Data API v3. Add server-IP restrictions
   where feasible; browser-referrer restrictions are not suitable for this backend.
3. Add `YOUTUBE_DATA_API_KEY=...` to the server `.env` (an empty entry has been added
   locally) or your hosting secret settings. This is not a Google OAuth client ID,
   client secret, or automatically the same key as Gemini. Never use `EXPO_PUBLIC_`.
4. Restart `npm run api`; reload Expo if needed. No OAuth login is required for
   this public-link tracking path. It also works in explicit local development mode.

Google's [API setup instructions](https://developers.google.com/youtube/v3/getting-started)
and [videos.list reference](https://developers.google.com/youtube/v3/docs/videos/list)
describe the credentials and read endpoint. API quota applies even though no
generation/rendering request is made. Provider errors never return the key to users.

## In the app

- Add a finished video to Launch Bucket and tap its YouTube icon.
- Paste a Shorts, watch, or `youtu.be` link. Confirm this is your post and connect it.
- The three counters show YouTube's returned views, likes, and comment count.
  Missing/hidden values show `—`; zero is a real zero. API failures show an error,
  not fabricated metrics. Private, deleted, and unlisted videos are not supported.
- Tap a counter or History to expand its compact time plot. It starts when you
  connect; a public link cannot reconstruct earlier history. The Y-axis starts
  at zero and the X-axis uses actual capture times. Counts can decrease when
  YouTube adjusts them. Lines connect captured observations, not inferred daily views.
- Open the posted YouTube link from History. Disconnecting removes the link and
  stored observations; it never deletes the YouTube post or HypeJuice source video.
- Caption revisions are different rendered jobs. Their posted links aren't silently
  moved to a new revision; the original job's tracking remains on its original record.

## Refresh and retention

`startYouTubeTrackingWorker` runs alongside the API, independently of video rendering.
It scans every minute and refreshes each linked post about hourly. Manual refresh
performs a fresh YouTube check and updates the timestamp even when counts are unchanged;
the existing daily quota limit still applies. Observations within the same UTC hour replace that hour's
point. No invented snapshots are filled in while the server is offline. UI reads
check for updates about once a minute while Launch Bucket is focused and foregrounded.
Only the first three bucket videos mount inline previews; every card can open its
full player. This keeps the compact list from running unlimited decoders.

The history is a rolling **28 days** of raw counts, with no ratios, growth scores,
cross-channel totals, sentiment analysis, or automatic learning. The API hides
expired observations immediately; the running worker deletes expired stored
observations every minute, even if the key is removed. Public-link statistics
cannot be retained indefinitely under [YouTube's data policies](https://developers.google.com/youtube/terms/developer-policies#e.-handling-youtube-data-and-content).

For deployment, keep retention cleanup always running and monitor failures. A
stopped Mac cannot execute cleanup; expired local samples are removed when the API
restarts. Exclude these records from long-lived backups or apply matching expiration
to backups. A separate scheduled database cleanup is required if your production
API may be offline for extended periods. Set `RUN_YOUTUBE_TRACKING_WORKER=false`
only if another instance or job handles refresh **and retention**.

Records reuse owner-scoped server storage: `youtube-track-<job-id>.json` and hourly
`youtube-sample-<tracking-id>-<hour>.json`. No new SQL table is required. Authenticated
routes verify job ownership before reading, attaching, refreshing, or disconnecting.
Local mode retains the existing trusted-LAN-only behavior. Multiple API replicas
can make redundant read-only checks, but upsert the same hourly slot. There are
per-account limits (20 new attachments/day, 500 checks/day); monitor total project
quota before scaling. No automated YouTube calls were made during implementation.

Before public release, include this data use/retention/deletion behavior in your
privacy policy and obtain the required consent. The connect form includes a brief
disclosure and YouTube/Google policy links; this does not replace your own reviewed
privacy policy. Longer owner-authorized analytics and an AI feedback loop are
separate future work, subject to YouTube's rules and any required approvals.
