# Launch posts

Ready-to-paste copy for launching Pulse. App Store: https://apps.apple.com/app/id6824666479 · Site: https://pulseretro.fit

## Product Hunt

**When:** a Tuesday, Wednesday or Thursday at 12:01 a.m. Pacific (the daily ranking resets then). Tell friends the day before, and ask them to visit and comment, not just upvote; Product Hunt discounts upvote rings.

**Name (40 max):** Pulse: Retro Fitness Tracker

**Tagline (60 max):** Calorie counter & workout log with a nostalgic 80s vibe

**Link:** https://apps.apple.com/app/id6824666479

**Description (260 max):**
Log meals by talking, snapping a photo or scanning a barcode, track workouts, and ask an AI coach anything. Pulse wraps a real fitness tracker in neon, synth music and hand-drawn 80s city art, so you actually keep logging. Free, no ads, no account needed.

**Topics:** Health & Fitness, iOS, Artificial Intelligence

**Pricing:** Free (in-app purchases)

**Thumbnail:** `product-hunt/thumbnail.png` (240×240)

**Gallery (1270×760, in order):** `product-hunt/gallery-1.png` … `gallery-4.png`, then any of `../app-store/screenshots/`

**Maker's first comment:**

> Hey Product Hunt! 👋 I'm the solo dev behind Pulse.
>
> I kept quitting calorie apps because logging felt like homework. So I built the one I'd actually open every day: a real calorie counter and workout log, wrapped in the neon and synth of the 80s.
>
> **What it does**
> - Say "two eggs and toast, then a 30 min run" and it logs both, with calories and macros
> - Snap your plate or scan a barcode
> - Ask the coach anything about training, food, sleep or recovery; it answers from your own numbers
> - Pick from 9 coaches with their own voices, from a drill sergeant to an 80s action hero
> - Streaks, 15 ranks and 30 hand-drawn walls to unlock, plus a comic-book weekly recap
> - Squads with friends, monthly challenges and Apple Health sync
>
> **What it doesn't do:** no ads, no tracking, and you don't need an account. AI features run on credits (optional packs or Pro); everything else is free.
>
> Built with Expo/React Native and Supabase. I'd love your honest feedback, especially on the first five minutes: what felt confusing, and what would make you come back tomorrow?

## Indie Hackers

**Where:** Indie Hackers → Post, group "Building in Public" (or "Launches").

**Title:** I launched a calorie counter with an 80s vibe. Here's what I learned getting through App Review

**Post:**

> Pulse is live on the App Store: a real calorie counter and workout log wrapped in neon, synth music and hand-drawn 80s city art. Solo-built in about a month.
>
> **The idea**
> Every calorie app I tried worked fine, and I still quit them all within two weeks. Logging felt like homework. I bet that if logging took five seconds (just say what you ate) and the app felt like something you *want* to open, I'd stick with it. So: voice, photo and barcode logging, an AI coach that knows your numbers, and streaks, ranks and 30 illustrated walls that unlock as you stay consistent.
>
> **Stack**
> Expo / React Native, Supabase (auth, Postgres, edge functions), Gemini behind a server-side proxy, RevenueCat for purchases.
>
> **Business model**
> Free download, no ads. The AI features use credits: small packs or a monthly Pro plan. No account needed to buy; Sign in with Apple is optional, for backup and cross-device.
>
> **What App Review taught me (first submission rejected on 4 counts)**
> 1. **Submit your in-app purchases with the build.** Each needs a review screenshot, and first-time IAPs must go in the same submission as an app version.
> 2. **Don't require sign-up to buy.** Purchases that aren't tied to an account must work without registration. I switched to anonymous guest accounts that upgrade to Sign in with Apple and keep the same user.
> 3. **Credits can only come from In-App Purchase.** My referral codes that granted credits had to go.
> 4. **Don't declare background audio you don't use.** One leftover config flag was enough to get flagged.
>
> **What's next**
> Getting the first 100 real users and finding out what makes people come back on day 7. I'd love feedback from anyone here: https://apps.apple.com/app/id6824666479
>
> Happy to answer anything about the build, App Review or the IAP setup.
