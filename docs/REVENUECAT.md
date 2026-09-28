# RevenueCat integration

The SDK is integrated. No store publication, Apple membership, native build, or
live/Test Store purchase was performed as part of this change. Those testing and
distribution steps can happen later.

## What is wired

- `react-native-purchases` supplies configuration, customer-info updates, current
  offerings, package purchases, restore, and subscription management.
- **Your App → Your plan** opens the custom paywall. Prices are the SDK’s localized
  prices, not hard-coded dollar amounts. Only configured monthly packages can be bought.
- Free keeps Discover, Library playback/downloads and Launch Bucket. Pro and Power
  unlock Studio, including caption editing through Studio. Existing videos and
  submitted jobs remain readable even after expiry.
- Backend checks RevenueCat’s V1 subscriber API before returning the Studio creator
  catalog, writing Studio ideas, or accepting a new Studio job. Client entitlement
  claims are never accepted as authorization. Canceling renewal preserves access
  until expiry; grace periods are honored; refunds/expired subscriptions are denied.
- Authenticated App User IDs are the verified Supabase UUID. The single-founder
  local prototype uses a stable random server-owned ID in ignored `.studio-data/`.
  It is intentionally one shared local workspace, not public multi-user billing.
- Expiration is refreshed on foreground and periodically in the UI; each new gated
  server request re-verifies independently. No webhook/public tunnel is needed for
  this initial integration. Verification outages fail closed for new Studio requests.

## Keep building now

Leave the new RevenueCat keys empty. In the existing **local** prototype,
`REVENUECAT_ENFORCE_ENTITLEMENTS=false` keeps development access unlocked. The Plans
screen labels this as development access, not a subscription or a successful purchase.
Other server configuration and provider charges still apply.

Authenticated mode always enforces subscriptions, regardless of that local flag.
Production never accepts sandbox subscriptions. Expo Go and web can still run the
app; purchase buttons are disabled there rather than simulating a verified purchase.

## Configure later

1. Create a RevenueCat project and a Test Store when ready.
2. Create two monthly subscription products. Final prices are a product decision;
   no $25/$129 price or 10/50/100 generation allowance has been committed in code.
3. Attach the products to the matching entitlements and put these **custom package
   identifiers** in the current/default offering:

   | Plan | Entitlement | Offering package identifier |
   | --- | --- | --- |
   | Pro | `growth_pro` | `growth_pro_monthly` |
   | Power | `growth_power` | `growth_power_monthly` |

   Product identifiers may differ; packages identify which product to purchase,
   while entitlements determine access. Do not create a paid Free product.
4. Copy the public Test Store SDK key to `EXPO_PUBLIC_REVENUECAT_TEST_API_KEY`.
   Put a **V1 secret API key** in server-only `REVENUECAT_SECRET_API_KEY`.
   Never use a secret key in an `EXPO_PUBLIC_` variable or commit it to git.
5. For non-production sandbox verification set `REVENUECAT_ALLOW_SANDBOX=true`.
   To test the local paywall gate, also set `REVENUECAT_ENFORCE_ENTITLEMENTS=true`.
6. Restart the API and Expo after changing environment variables. Refresh plan
   reloads both verification and offerings. Configure products first; empty/missing
   packages cannot be purchased and do not display fabricated prices.

When testing later, use a debug development build with the native SDK. Expo Go
preview behavior is not purchase proof. Test Store keys are never selected in
release JavaScript; TestFlight/store builds need platform keys, not Test Store keys.
Future iOS/Android keys have separate environment entries in `.env.example`.

## Deliberately deferred

- Real native/Test Store success, cancellation, restore and accelerated-expiry tests.
- Final pricing, differences in Pro/Power generation allowances, and a billing-period
  quota ledger. **The two tiers currently unlock the same Studio capability.** Do not
  sell Power as a higher quota until the allowance policy is implemented.
- Existing authenticated safety limits remain: three new paid creators/day and
  twenty revisions/day. They are not marketed subscription allowances. The existing
  `ENABLE_PAID_GENERATION` operator switch remains independent from subscriptions.
- Credit currency, monthly grants, top-ups, automatic quota refunds, webhook-driven
  synchronization and billing analytics. A Test Store subscription does not make
  Higgsfield, Gemini, storage or hosting free.
- Production legal links, store subscription grouping/upgrade behavior, and store
  release verification. This is the SDK integration foundation, not a launched store.

## Essential checks

Mocked tests cover tier precedence, expiration/grace, refunds, sandbox rejection,
owner-specific lookup, verification failures and server gates. The existing browser
smoke test verifies that local development still reaches Studio. No real purchase
or paid generation is needed by these tests.

Official references:

- [React Native SDK](https://www.revenuecat.com/docs/getting-started/installation/reactnative)
- [Offerings](https://www.revenuecat.com/docs/getting-started/displaying-products)
- [Restore purchases](https://www.revenuecat.com/docs/getting-started/restoring-purchases)
- [Server subscriber API](https://www.revenuecat.com/docs/api-v1/customers)
- [Test Store](https://www.revenuecat.com/docs/test-and-launch/sandbox/test-store)
