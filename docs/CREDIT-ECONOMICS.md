# AI credit economics

What each AI feature costs us, how fast people burn credits, and what to charge so every product
makes money. Numbers are **estimates from prompt sizes** (October 2026), not measured usage. Add
token logging (see "Next steps") and re-run the model with real data after launch.

## Inputs

**Gemini prices** (paid tier, per 1M tokens, from ai.google.dev/gemini-api/docs/pricing):

| Model | Input | Cached input | Output (incl. thinking) |
|---|---|---|---|
| `gemini-3.8-flash` (Coach), now → Dec 31 2026 | $0.75 | $0.075 | $3.75 |
| `gemini-3.8-flash`, **from Jan 1 2027** | **$1.50** | $0.15 | **$7.50** |
| `gemini-3.5-flash-lite` (no increase listed) | $0.30 | $0.03 | $2.50 |
| `gemini-3.8-flash-lite-tts` (voice), audio out | | | $6.00 → **$12.00** in 2027 |

Flash prices double on Jan 1 2027, right after launch, so **all pricing below is set for 2027 prices.**

**Our share of each sale:** 70% (Apple takes 30%). Enrolling in Apple's **Small Business Program**
(under $1M/yr) cuts Apple's fee to 15%, so we keep 85%. Do this before launch; it's free.

**Fixed costs:** Supabase Pro $25/mo, Apple Developer $99/yr (≈$8/mo). RevenueCat is free under
$2.5k monthly revenue, then 1%.

## Cost per AI call

Token estimates: the Coach's system prompt is ~2,400 tokens of fixed rules and schema plus ~1,400
of the user's numbers and last 12 messages. Photos add ~1,100 tokens, a 15 s voice note ~480, and a
15 s spoken reply is 375 audio tokens.

| Feature | Credits now | Cost now (2026) | Cost 2027 | Cost 2027, optimised* |
|---|---|---|---|---|
| Coach reply (text) | 1 | $0.0051 | $0.0102 | $0.0052 |
| Coach reply (photo) | 2 | $0.0067 | $0.0134 | $0.0083 |
| Coach reply (voice note) | 2 | $0.0055 | $0.0109 | $0.0059 |
| Reply read aloud | 1 | $0.0023 | $0.0046 | $0.0046 |
| One day's meal or workout plan | 3 | $0.0071 | $0.0143 | $0.0043 |
| 7-day plan | 3 | $0.0244 | $0.0488 | $0.0158 |
| Weekly recap | 2 | $0.0030 | $0.0060 | $0.0016 |
| Stress & sleep analysis | 1 | $0.0022 | $0.0045 | $0.0012 |
| Daily HQ insight | free | $0.0016 | $0.0032 | $0.0008 |

\* Optimised = (1) put the fixed rules first in the Coach prompt so Gemini's automatic prompt caching
bills them at 10%, (2) use minimal thinking for logging replies, (3) run plans, recaps, insights,
stress analysis and meal repairs on Flash-Lite. This roughly **halves** the cost.

## How fast credits burn

Usage per day assumed for each profile:

- **Light:** 2 text messages, a photo every few days.
- **Typical:** 3 text, 1 photo, a voice note every few days, 1 reply read aloud, auto plans about 2 days
  a week, weekly recap.
- **Heavy:** 6 text, 2 photos, 2 voice notes, 8 replies read aloud, daily meal and workout plans.

| Profile | Credits / month | 1,500 credits last | 100 credits last |
|---|---|---|---|
| Light | ~80 | ~19 months | ~38 days |
| Typical | ~230–270 | **~6 months** | ~12 days |
| Heavy | ~750–880 | ~2 months | ~4 days |

That matches the goal: 1,500 ≈ half a year for a typical user, and 100 goes fast. The exception is
**daily auto plans at today's prices: 3 + 3 credits a day, so 180 a month on their own.** Anyone who
leaves them on burns 1,500 in about 3 months. Plans need to be cheaper (below).

## Margins today: not safe for 2027

Margin = (what we keep per credit − AI cost per credit) ÷ what we keep, for a typical user:

| Product | We keep per credit | Margin, 2026 prices | Margin, **2027 prices** |
|---|---|---|---|
| 100 for $1.99 | $0.0139 | 74% | 47% |
| 500 for $7.99 | $0.0112 | 67% | 34% |
| 1,500 for $19.99 | $0.0093 | 60% | 21% |
| Pro 1,000/mo for $9.99 | $0.0070 | 47% | **−5% (loses money)** |

Light users are worse because the free daily insight is a fixed cost: **Pro loses 52%** on them in
2027.

## Recommendation

1. **Cut costs** with the three optimisations above (about −50%).
2. **New credit costs:** Coach text 1 · photo 2 · voice note 2 · read aloud 1 · **one day's plan 1**
   (was 3) · **7-day plan 4** · recap 1 · stress analysis 1 · goal plan 1 · HQ insight and meal
   repair free.
3. **New packs:** 100 for $1.99 · 500 for $7.99 · **1,500 for $24.99** (was $19.99) · **Pro $9.99 for
   600 credits/month** (was 1,000), with rollover capped at 1,800.
4. **Join Apple's Small Business Program** (we keep 85% instead of 70%).
5. Keep the 50-credit sign-up bonus: it costs about **$0.22 per new user**.

Result for a typical user at **2027** prices:

| Product | Apple 30% | Small Business 15% |
|---|---|---|
| 100 for $1.99 | 68% | 74% |
| 500 for $7.99 | 60% | 67% |
| 1,500 for $24.99 | 62% | 68% |
| Pro 600/mo for $9.99 | 62% | 68% |

Light and heavy users land at 53–75%. At 2026 prices every product is 75–85%. Every single feature
clears **55%+** even for a Pro subscriber at 2027 prices. The lowest are Coach text (56%) and goal
plan (55%).

**Per paying user per month (typical, 2027, Apple 30%):**
- Pro: $6.99 kept − $1.03 AI = **$5.97 profit**.
- 1,500-pack buyer (one pack per ~6.5 months ≈ $3.82/mo): $2.67 kept − $1.03 AI = **$1.65 profit**.
- **Break-even on fixed costs:** about 6 Pro subscribers or 20 pack buyers.

Pro is the better business, so make it the default suggestion on the Credits screen ("best value").

## Next steps

1. Log `usageMetadata` (prompt, cached, output and thinking tokens) per request in the `ai` edge
   function, so these estimates become measured numbers.
2. Ship the three cost optimisations.
3. Change the `feature_costs` and `products` tables (no app update needed), and change pack
   prices and Pro's credits in App Store Connect.
4. Re-run this model monthly. Guardrail: if AI cost per credit goes above 40% of what we keep per
   credit, raise feature costs.

The model script is in `docs/credit-economics.py`.
