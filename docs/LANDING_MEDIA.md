# Landing showcase

The three approved landing clips are hosted in the dedicated public Supabase
bucket `hypejuice-showcase`. The private Studio bucket is unchanged. Public URLs
are in `src/config/landing-videos.ts`; the app bundles no video files or keys.

Three larger, fanned video tiles have no play/pause controls or navigation arrows.
Only the center clip plays, muted and from the beginning, then advances the
carousel when it ends. Both side clips remain paused. Users can swipe or select
dots to bring a different clip to the center. Playback runs while the landing
screen is focused and the app is foregrounded, and pauses when the screen loses focus or the
app is backgrounded. A failed source offers retry; carousel controls
remain available. A compact black “Content that actually gets people curious about your app” caption floats across
the three tiles, separately from the individual videos.

Operator upload: place explicitly approved public clips at `landingvid1.MP4`,
`landingvid2.MP4`, and `landingvid3.MP4`, then run:

```
node --import tsx server/admin-landing-media.ts --publish-approved
```

The script uses server environment credentials, creates only the dedicated public
showcase bucket if absent, refuses to make an existing private bucket public,
uses content hashed paths without overwriting, and verifies downloaded public
bytes against each original. It prints public URLs and hashes, never credentials.
Update the URL manifest after verification. Source clips are ignored by Git and
Docker; move them out of the repo after checking hosted playback. The script does
not delete originals or delete earlier cloud versions automatically.

Only use public promotional content you have permission to distribute here.
Do not put customer videos or private creator archives in this public bucket.
