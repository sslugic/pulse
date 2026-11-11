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
