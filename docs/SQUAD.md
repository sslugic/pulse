# Squad (Pulse 1.1): setup, release and moderation

Squad adds friends (invite links), a weekly friends board, challenges, crews with a shared streak,
nudges (push notifications) and share cards. It needs a Pulse account (Sign in with Apple).

## What's where

- Database: `supabase/migrations/20261021000000_social.sql`. Tables are readable through RLS; all
  writes go through `security definer` functions that validate them.
- Nudges: `supabase/functions/nudge` records the nudge and sends it straight to Apple's push service.
- App: `src/lib/social.ts` (data and rules), `src/app/(tabs)/squad.tsx`, `src/app/crew/[id].tsx`,
  `src/app/challenge-new.tsx`, `src/app/blocked.tsx`, invite links `src/app/add/[code].tsx` and
  `src/app/join/[code].tsx`, share cards `src/components/share-card.tsx`.
- Invite page: `invite.html` in the `sslugic/pulse-site` repo (branch `squad-1.1`). It opens
  `pulse://add/CODE` or `pulse://join/CODE`, and shows the code and an App Store button.
- Tests: `supabase/tests/social.mjs` (55 checks against a local Supabase).

What friends can see: name, colour, rank, streak, XP, this week's XP and which days someone logged.
Never food, weight, health data or chats.

## Release checklist

1. **Database:** `npx supabase db push` (additive; 1.0 keeps working).
2. **Nudge function:** `npx supabase functions deploy nudge`.
3. **Push key (you, once):** developer.apple.com → Certificates, IDs & Profiles → Keys → **+** →
   tick **Apple Push Notifications service (APNs)** → Continue → Register → download the `.p8`
   (only downloadable once) and note the **Key ID**. Then, in your own terminal:
   ```bash
   npx supabase secrets set APNS_KEY_ID=<Key ID> APNS_TEAM_ID=8SX4DK48U6 APNS_TOPIC=com.slavenslugic.pulse APNS_PRIVATE_KEY="$(cat ~/Downloads/AuthKey_<Key ID>.p8)"
   ```
   Without these, nudges still work in the app, just without a push notification.
4. **Website:** merge the `squad-1.1` branch of `sslugic/pulse-site` (invite page, privacy policy
   and terms with the Squad rules) when 1.1 goes live.
5. **App Store Connect, version 1.1:**
   - App Privacy: add **Contact Info → Name** (the Squad display name): linked to the user, not
     tracking, App Functionality. Everything else is already declared.
   - Age rating: answer **Yes** to user-generated content / user interaction if asked (there's no
     free chat; names only, filtered, with report and block).
   - Review notes: "Squad tab: friends, crews and challenges. Sign in (any Apple ID), join, and
     enter code `<a demo crew code>` to see a populated crew. Report and block are on every
     player's name."
6. Archive build 6 and upload from Xcode Organizer, as with 1.0.

## Moderation (App Store guideline 1.2)

Apple expects reports handled within 24 hours.

- Reports: Supabase dashboard → Table editor → `reports` (newest first, `resolved_at` empty).
- Rename an offensive player:
  `update social_profiles set name = 'Player' where user_id = '<id>';`
- Remove a crew name: `update crews set name = 'Crew' where id = '<id>';`
- Ban a player: delete their account in Authentication → Users (cascades to all their data).
- Mark handled: `update reports set resolved_at = now() where id = <id>;`

## How the rules work

- **Weekly board:** friends plus you, by XP earned Monday–Sunday (logs, quests, games; no streak
  bonus). After the week ends, the top 3 (of at least 2 players with XP) claim a gold, silver or
  wood chest.
- **Challenges:** solo or against one friend, 3/7/14 days. A duel ends when someone reaches the goal
  (first wins a gold chest) or when the days run out (most progress wins; a tie gives both silver).
  A finished solo challenge pays a silver chest. Progress is counted on each player's device.
- **Crews:** up to 8 people, up to 3 crews each. The crew streak counts days on which every member
  logged; a new member only counts from the day they joined.
- **Nudges:** to a friend or crewmate who hasn't logged today, once per person per day.
- **Blocking:** ends the friendship, calls off duels, hides each player from the other (crews
  included) and stops nudges. The blocked player isn't told.
