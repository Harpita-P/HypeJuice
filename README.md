# HypeJuice

<img src="hypejuice-logo.png" alt="HypeJuice juice box logo" width="104" />

**RevenueCat Shipaton 2026 submission · Next Gen Award**

### You built the app. Now let's make some noise.

Everyone is building apps. Getting people to discover and actually use yours is the hard part. Great apps deserve to reach the people they were built for.

UGC style videos can catch on, spark curiosity, and bring in new users, but creating them shouldn't become a full time job.

HypeJuice is your AI Growth Agent. It learns your app inside out and turns its best features into fun AI UGC style videos made for your audience. Explore fresh ideas, discover your content taste, and create videos that make people stop, watch, and want in, while you keep building.

Built for solo developers, solopreneurs, student builders, and anyone who's made a great app and dreams of getting millions of eyes on it.

## From app link to content library

1. **Share what you built.** Add an App Store or app website link. The agent builds an editable brief covering your app, its story, potential audiences, and vibe.
2. **Show how it works.** Upload up to five clips of your app in action. These become the real product demonstration in your videos.
3. **Find your content taste.** React to three generated samples. Your choices help steer the next batch.
4. **Explore and create.** Discover produces five fresh variations at a time using reusable creator footage. Studio lets you choose a tagged creator or describe a custom one, then select creative angles to produce.
5. **Save, share, and learn.** Keep videos in Library, edit captions, download or share them, and move selected posts to Liftoff. Connect a manually published YouTube link to track views, likes, and comments over time and discuss performance with the agent.

Videos use a silent creator hook followed by real app footage, with readable text overlays. Each video also has a separate post caption and up to five relevant hashtags. Reusing creator footage makes it possible to explore new captions without paying to generate a new character every time.

## RevenueCat integration

HypeJuice uses **`react-native-purchases`**, not a simulated purchase button. The Pro paywall opens after **Get Started**, with purchases and restores also available through **Your App → Your plan**. The backend independently verifies subscription access before allowing gated Studio actions.

| Offer | Configuration |
| --- | --- |
| HypeJuice Pro | 3 day free trial, then $25 USD per month; checkout uses the configured store price and eligibility |
| Test Store product | `hypejuice_pro_monthly` |
| Entitlement | `growth_pro` |
| Offering package | `growth_pro_monthly` in the current offering |

**Sandbox evidence:** the RevenueCat customer dashboard recorded **“Started a trial of HypeJuice Pro (hypejuice_pro_monthly)”** under **Sandbox Data**. This confirms a successful Test Store trial start with no real payment. It does not establish production App Store billing or a fully tested renewal lifecycle.

See the [implementation summary](docs/IMPLEMENTATION_SUMMARY.md#revenuecat-subscriptions) for the SDK code paths, setup, and verification boundaries.

## Built with

| Layer | Technology |
| --- | --- |
| Mobile and web | Expo, React Native, Expo Router, TypeScript |
| Agent | Google Gemini for app understanding, creative angles, captions, and performance chat |
| Video | Reusable creator library, optional Higgsfield generation, FFmpeg assembly and text overlays |
| Backend and storage | Hono on Node.js, Supabase Auth, Postgres, and private Storage |
| Subscriptions | RevenueCat SDK, Test Store, and server subscription verification |
| Post metrics | YouTube Data API for manually connected public videos |

## Run locally

Use Node.js 22.13+ on the Node 22 line, or 24.3+, and install **FFmpeg and ffprobe** on the API host. A matching Expo Go installation supports the development app; native store purchases require a native build.

```sh
npm ci
cp .env.example .env
```

Copy the template only if you do not already have a local `.env`. Fill in your own credentials using the [setup guide](docs/IMPLEMENTATION_SUMMARY.md#configuration-and-local-development). Provider keys stay on the server; only genuinely public configuration belongs in `EXPO_PUBLIC_` variables.

In separate terminals:

```sh
npm run api
```

```sh
npm start
```

For an iPhone, use the same Wi-Fi network and set `EXPO_PUBLIC_API_URL` to your computer's LAN address, for example `http://192.168.1.20:8787`. Scan Expo's QR code. Restart both processes after changing environment variables.

**Bring your own services and footage.** Real video generation needs Gemini, private Supabase storage, a working FFmpeg installation, and creator clips matching your catalog. The repository contains creator metadata, not the private MP4 files. Configure RevenueCat Test Store to exercise the onboarding checkout. Higgsfield is only needed for creating a new character; provider usage can incur charges even during a sandbox subscription test.

## Checks and publication safety

```sh
npm run check                 # TypeScript and server unit tests
npm run check:public          # Candidate source and staged content
npm run check:public:history  # Reachable Git history
```

Optional browser checks: `npm run test:ui` after installing Playwright's Chromium browser.

Environment files, local job data, media uploads, generated videos, operator drafts, and archived notes are excluded from Git. The public scan reports file paths and reasons without printing credentials. It is defense in depth, not a substitute for reviewing staged changes. The hosted landing examples are intentionally public media URLs, not storage credentials.

## Scope

This is an open source working prototype with an authenticated deployment foundation, not a published App Store release. Automatic social posting, additional platform integrations, and subscription credit allowances are not implemented. The Test Store trial is evidenced; native production billing and cloud deployment still require separate validation.

[Full implementation summary](docs/IMPLEMENTATION_SUMMARY.md) · [MIT license](LICENSE)
