# Pulse — AI fitness & nutrition coach

An Expo (React Native) app: iPhone first, with Android and web from the same code.

Log meals and workouts by **talking**, **snapping a photo** (your plate, a nutrition label, a treadmill or smartwatch screen) or **typing a few words**. Google Gemini turns it into calories, macros and calories burned, and the dashboard tracks calories in vs out, macros, water, streaks and trends.

## Features

- **AI Coach**: voice notes, photos or text become log entries. Corrections like "actually it was 2 slices" work too.
- **Ask the Coach**: training, workouts, form, recovery, nutrition and supplement questions get real answers tailored to your goal and logs, and the Coach talks back out loud in a natural Gemini voice (pick one in Profile; mute it with the speaker button, or tap Listen on any reply). If Gemini speech is unavailable it falls back to the iPhone's best built-in voice.
- **Nutrition plan**: describe your goal ("build muscle and lose fat") and get calorie, protein, carb, fat, fiber and water targets for your body, or pick a goal and pace and fine-tune each target yourself.
- **Mind & recovery journal**: tell the Coach how you slept, how you feel and what happened, or add photo moments. Pulse turns it into a daily stress score (life stress, sleep debt, mood, fatigue, training load), connects it to your calories and protein, explains how it affects fat loss, and finds patterns in your own history.
- **Today dashboard**: calories-left ring, macros, water and activity, plus a daily AI insight.
- **Trends**: 7- and 30-day calories in vs out, macro split, weight trend and history.
- **Private by default**: all data stays on the device, and your Gemini key is stored in the iOS Keychain.

## Run

```bash
npm install
npx expo start        # press i for the iOS Simulator, or scan the QR code with Expo Go
```

Add your Gemini API key during onboarding or in **Profile**. For development you can preset it in `.env` (see `.env.example`). The model defaults to `gemini-3.8-flash` and can be changed in Profile.

### Install on an iPhone

```bash
LANG=en_US.UTF-8 npx expo run:ios --device --configuration Release
```

This needs Xcode and an Apple Developer signing identity. Set `ios.appleTeamId` and `ios.bundleIdentifier` in `app.json` to your own values.

### Build in the cloud with EAS

`eas.json` has two profiles:

- `preview`: a Release build signed for the devices you register (ad hoc), installed from a link. Use this to put the app on your phone without Xcode.
- `production`: an App Store build, with the build number incremented automatically, ready for `eas submit` to TestFlight.

The first time, run it on your Mac. It links the project to your Expo account, sets up Apple signing and registers your iPhone:

```bash
npx eas-cli@latest device:create                          # open the link on your iPhone to register it
npx eas-cli@latest build -p ios --profile preview          # then install from the link when the build finishes
```

After that, builds can run non-interactively (for example from CI or a cloud agent) with an `EXPO_TOKEN`:

```bash
EXPO_TOKEN=... npx eas-cli@latest build -p ios --profile preview --non-interactive --no-wait
```

## Layout

- `src/app/(tabs)`: Today, Coach, Trends and Profile screens
- `src/app/goals.tsx`: nutrition plan (AI planner and target editor)
- `src/lib/gemini.ts`: Gemini calls with structured JSON output, timeouts and retries
- `src/lib/nutrition.ts`: BMR/TDEE, goal- and pace-based targets, daily summaries
- `src/lib/store.ts`: local persisted store (AsyncStorage + SecureStore)

## License

MIT
