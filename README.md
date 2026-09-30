# HypeJuice

<img src="assets/brand/hypejuice-logo.png" alt="HypeJuice juice box logo" width="104" />

**RevenueCat Shipaton 2026 submission · NextGen Award Category**

<sub>Built by Harpita Pandian (Rutgers University, New Brunswick) and Harpith Pandian (Rutgers University, New Brunswick)</sub>

### You built the app. Now let's make some noise.

As builders, we know the excitement of bringing an app to life. Then comes the big question: **How do I get my first users?** Getting people to discover and actually use your app is the hard part. UGC style videos can catch on, spark curiosity, and bring in new users, but creating them shouldn't become a full time job.

HypeJuice learns your app inside out and turns its best features into fun AI UGC style videos made for your audience. Explore fresh ideas, discover your content taste, and create videos that make people stop, watch, and want in, while you keep building. Built for solo developers, solopreneurs, student builders, and anyone who's made a great app and dreams of getting millions of eyes on it.

**HypeJuice is a mobile app built with Expo and React Native for iOS and Android, with web support.**

## Tools & tech stack

| Layer | Technology |
| --- | --- |
| Mobile and web | Expo, React Native, Expo Router, TypeScript |
| Agent | Google Gemini for app understanding, creative angles, captions, and performance chat |
| Video | Reusable creator library, optional ByteDance Seedance 2.0 generation via Higgsfield, FFmpeg assembly and text overlays |
| Backend and storage | Hono on Node.js, Supabase Auth, Postgres, and private Storage |
| Subscriptions | RevenueCat SDK, Test Store, and server subscription verification |
| Post metrics | YouTube Data API for connecting public videos and tracking performance. More platform integrations coming soon. |

## RevenueCat integration

HypeJuice is submitted in the **Next Gen Award** category as an app in development. It has not yet been published to the App Store or Google Play and is not yet monetized.

The RevenueCat React Native SDK is integrated for Pro subscriptions, purchases, restores, and server-verified access. For this submission, testing uses **RevenueCat Test Store's sandbox**, with a configured Pro offer of a 3 day free trial followed by $25 USD per month. This is a test configuration, not a live subscription available for purchase.

A successful trial start was recorded in the RevenueCat sandbox customer dashboard. **No real payment was taken and no subscription revenue was generated.** This demonstrates the Test Store trial flow, not live App Store or Google Play billing.

## Run locally

Install Node.js (see `.nvmrc`), FFmpeg, and ffprobe.

```sh
npm ci
cp -n .env.example .env
```

Configure your credentials and creator footage using the [setup guide](docs/IMPLEMENTATION_SUMMARY.md#configuration-and-local-development), then run these in separate terminals:

```sh
npm run api
```

```sh
npm start
```

On your phone, join the same Wi-Fi, set `EXPO_PUBLIC_API_URL` to your computer's LAN address on port `8787`, and scan the QR code with Expo Go.

[MIT license](LICENSE)

Coming soon to the App Store and Google Play.
