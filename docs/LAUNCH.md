# Launching Pulse: accounts, AI credits and the App Store

Everything in code is in place. This guide covers what only the account owner can do: create the
Supabase and RevenueCat projects, add the App Store products, set keys, and get through review.
Do the steps in order; each one ends with how to check it worked.

## How it fits together

```
Pulse app ── Sign in with Apple ──▶ Supabase Auth  (account, 50 free credits on sign-up)
   │
   ├── AI request ──▶ Supabase edge function `ai` ── charges credits ──▶ Gemini (server key)
   │                     (feature_costs table sets the price; refunds if Gemini fails)
   │
   ├── Buy credits ──▶ App Store (StoreKit) ──▶ RevenueCat ── webhook ──▶ `revenuecat-webhook`
   │                                                         (adds credits once per event)
   └── Backup ──▶ Supabase `user_state` table (row-level security: own row only)
```

- Credits are an append-only ledger (`credit_ledger`); the balance is the sum. Purchases,
  renewals, refunds, sign-up bonus and AI usage are all rows, each with an idempotency key.
- Prices live in the database (`feature_costs`, `products`), so you can change them without an
  app update.
- The Gemini key lives only on the server, as the `GEMINI_API_KEY` Supabase secret. Release builds never
  accept or store a key; development builds can set `EXPO_PUBLIC_GEMINI_API_KEY` in the gitignored
  `.env.local` to call Gemini directly.

## 1. Supabase

1. Create a project at supabase.com (choose a region near your users). Note the project ref.
2. Link and push the schema from this repo:
   ```bash
   npx supabase login
   npx supabase link --project-ref <ref>
   npx supabase db push
   ```
3. Set the function secrets and deploy the functions:
   ```bash
   npx supabase secrets set GEMINI_API_KEY=<your Gemini key> REVENUECAT_WEBHOOK_AUTH=<long random string>
   npx supabase functions deploy ai
   npx supabase functions deploy delete-account
   npx supabase functions deploy revenuecat-webhook --no-verify-jwt
   ```
   Leave `ALLOW_SANDBOX` unset in production so TestFlight and sandbox purchases don't grant
   real credits there; set it to `true` on a staging project for testing.
4. Enable Sign in with Apple: Dashboard → Authentication → Sign In / Providers → Apple → enable,
   and add `com.slavenslugic.pulse` under Client IDs (native sign-in needs no secret key).
5. Put the public values in `.env` (and in EAS environment variables for cloud builds):
   ```
   EXPO_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
   EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable key from Project Settings → API Keys>
   ```

**Check:** build the app, sign in with Apple in Crew → Account, and see 50 credits.

## 2. App Store Connect products

In App Store Connect → your app → Monetization:

| Type | Product ID | Suggested price | Grants |
|---|---|---|---|
| Consumable | `pulse_credits_100` | $1.99 | 100 credits |
| Consumable | `pulse_credits_500` | $7.99 | 500 credits |
| Consumable | `pulse_credits_1500` | $24.99 | 1,500 credits |
| Auto-renewable subscription (group "Pulse Pro") | `pulse_pro_monthly` | $9.99 / month | 600 credits each renewal |

Product IDs must match the `products` table. Each product needs a display name, description and
a review screenshot (the Credits screen). Also sign the Paid Apps agreement and add banking and
tax info, or products won't load.

## 3. RevenueCat

1. Create a project, add the iOS app (bundle id `com.slavenslugic.pulse`) and upload an App Store
   Connect API key (In-App Purchase key) so RevenueCat can validate receipts.
2. Products → import the four products. Entitlements → create `pro` and attach `pulse_pro_monthly`.
3. Offerings → make a `default` offering (marked current) with packages for all four products
   (the monthly package as type Monthly).
4. Integrations → Webhooks → URL `https://<ref>.supabase.co/functions/v1/revenuecat-webhook?key=<REVENUECAT_WEBHOOK_AUTH>`
   and leave the Authorization header empty. (A `Bearer <secret>` header also works, but password
   managers like 1Password autofill that field and silently break it.)
5. Put the public iOS SDK key in `.env` / EAS: `EXPO_PUBLIC_REVENUECAT_IOS_KEY=appl_...`

**Check:** with a sandbox tester signed in on a device (Settings → Developer → Sandbox Apple
Account) and `ALLOW_SANDBOX=true` on a staging project, buy a pack on the Credits screen; the
balance goes up within a few seconds. RevenueCat → Customers shows the purchase under the
Supabase user id.

## 4. App Store requirements checklist

Already built in the app:

- [x] **Sign in with Apple** as the sign-in method (guideline 4.8).
- [x] **Account deletion** in the app: Crew → Account → Delete account (5.1.1(v)). Deletes the
      account, credits and cloud backup on the server.
- [x] **Restore purchases** button on the Credits screen (3.1.1).
- [x] **Subscription disclosure** next to the Subscribe button: price, period, auto-renewal,
      how to cancel, plus links to Terms of Use (EULA) and Privacy Policy (3.1.2).
- [x] **Digital goods sold only through Apple IAP**: no external payment links (3.1.1).
- [x] **Health and AI disclaimer** on onboarding and the Coach screen (1.4.1).
- [x] **HealthKit** data is only read, never used for ads, and the permission text explains why
      (5.1.3).

You still need to:

- [x] **Privacy Policy, Terms and Support** pages: https://sslugic.github.io/pulse-site/ (repo `sslugic/pulse-site`),
      wired in as the defaults in `src/lib/legal.ts`. Use the same URLs in App Store Connect.
- [ ] Fill in **App Privacy** ("nutrition labels") in App Store Connect. Data Pulse collects
      when signed in: Health & Fitness (logs, HealthKit), Identifiers (user id), Purchases,
      User Content (journal, photos sent to the AI). Not used for tracking.
- [ ] Note in **App Review notes** that AI replies come from Google Gemini via your server, and
      give the reviewer a sandbox account or say that Sign in with Apple works with any Apple ID.
- [ ] Set the **age rating** (likely 12+ for unrestricted web/AI content; check the
      questionnaire's "Medical/Treatment Information" answer).
- [ ] Bump `expo.ios.buildNumber` for every TestFlight upload.

## Changing prices later

```sql
update feature_costs set credits = 2 where feature = 'coach_media';
update products set credits = 1200 where product_id = 'pulse_pro_monthly';
```

Run in the Supabase SQL editor; the app reads the new prices next time it opens.

## Testing locally

```bash
npx supabase start                       # Postgres, Auth and Edge Runtime in Docker
node supabase/tests/mock-gemini.mjs &    # fake Gemini on :8787
npx supabase functions serve --env-file supabase/tests/functions.test.env
ANON=<anon key> SR=<service role key> node supabase/tests/e2e.mjs   # 25 end-to-end checks
```

Point a development build at it with `EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321` in
`.env.local`; Crew → Account then shows a "DEV: sign in with test account" button.
