# Pulse admin (local)

A small page for looking after accounts by hand:

- every account in production with its credit balance, what it bought and used, and Pro status
- private labels for people you recognise, saved to `tools/admin/labels.json` on this Mac (never committed)
- grant or remove credits, with a confirmation, logged in the credit ledger as `admin` with your note
- each account's credit history

```
npm run admin
```

Then open http://localhost:4391. It reads and writes production through the Supabase CLI you're logged into
(`npx supabase login`), so it keeps no database keys. It only listens on localhost.

## App Store numbers (optional)

The top of the page shows the last 30 days from App Store Connect:
- first-time downloads, redownloads, in-app purchases and proceeds (Sales reports)
- impressions, product page views and the page → download conversion rate (Analytics reports)

To turn it on:

1. App Store Connect → Users and Access → Integrations → App Store Connect API: use an existing team key or
   generate one with the **Admin** role (analytics report requests need it). Download the `.p8` once and keep it
   somewhere private, e.g. `~/.appstoreconnect/private_keys/`.
2. Copy `tools/admin/asc.example.json` to `tools/admin/asc.json` (gitignored) and fill in the key ID, issuer ID
   and the path to the `.p8`. For downloads and purchases also add your **vendor number** (Payments and
   Financial Reports, top left).
3. Restart `npm run admin`. The first load asks Apple to start generating analytics reports for Pulse; impressions,
   page views and conversion appear 1–2 days later. Sales numbers show up right away (up to yesterday).

Results are cached for an hour in `tools/admin/.appstore-cache.json`; press Refresh to fetch fresh numbers.
