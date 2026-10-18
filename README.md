# Pulse — AI fitness & nutrition coach

An Expo (React Native) app: iPhone first, with Android and web from the same code.

Log meals and workouts by **talking**, **snapping a photo** (your plate, a nutrition label, a treadmill or smartwatch screen) or **typing a few words**. Google Gemini turns it into calories, macros and calories burned, and the dashboard tracks calories in vs out, macros, water, streaks and trends.

## Features

- **AI Coach**: voice notes, photos or text become log entries. Corrections like "actually it was 2 slices" work too.
- **Nutrition plan**: describe your goal ("build muscle and lose fat") and get calorie, protein, carb, fat, fiber and water targets for your body, or pick a goal and pace and fine-tune each target yourself.
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

## Layout

- `src/app/(tabs)`: Today, Coach, Trends and Profile screens
- `src/app/goals.tsx`: nutrition plan (AI planner and target editor)
- `src/lib/gemini.ts`: Gemini calls with structured JSON output, timeouts and retries
- `src/lib/nutrition.ts`: BMR/TDEE, goal- and pace-based targets, daily summaries
- `src/lib/store.ts`: local persisted store (AsyncStorage + SecureStore)

## License

MIT
