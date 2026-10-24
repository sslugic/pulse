import { Bangers_400Regular } from '@expo-google-fonts/bangers';
import { PermanentMarker_400Regular } from '@expo-google-fonts/permanent-marker';
import { RussoOne_400Regular } from '@expo-google-fonts/russo-one';
import { useFonts } from 'expo-font';
import * as Notifications from 'expo-notifications';
import { DarkTheme, router, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';

import { BootScreen } from '@/components/boot-screen';
import { RewardToast } from '@/components/reward-toast';
import { ShareCardHost } from '@/components/share-card';
import { C } from '@/constants/theme';
import '@/lib/referrals';
import { refreshSquad, scheduleSync } from '@/lib/social';
import { actions, hydrate, useStore } from '@/lib/store';
import { useTodayKey } from '@/lib/use-today';
import { syncWidget } from '@/lib/widget-sync';

SplashScreen.preventAutoHideAsync();

const theme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: C.bg, card: C.bg, primary: C.lime, text: C.text, border: C.border },
};

export default function RootLayout() {
  const ready = useStore((s) => s.ready);
  const onboarded = useStore((s) => s.onboarded);
  // Keep the home screen widget in step with logs, quests and the day changing.
  const entries = useStore((s) => s.entries);
  const game = useStore((s) => s.game);
  const profile = useStore((s) => s.profile);
  const todayKey = useTodayKey();
  useEffect(() => {
    if (ready) syncWidget();
  }, [ready, entries, game, profile, todayKey]);
  // Friends see new XP and streaks a few seconds after a log.
  useEffect(() => {
    if (ready) scheduleSync();
  }, [ready, entries, game.claims]);
  // Reminders follow chests and arcade play (the 1pm rewards nudge), debounced so a burst is one reschedule.
  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(() => actions.refreshReminder(), 1500);
    return () => clearTimeout(timer);
  }, [ready, game.chests, game.claims, todayKey]);
  // A tapped notification opens the place it's about: a reminder carries its screen, a Squad nudge
  // opens Squad. One that launched the app waits until the screens are up and onboarding is done.
  const tapped = useRef<string | null>(null);
  const [tapCount, setTapCount] = useState(0);
  const setTapped = (url: string) => {
    tapped.current = url;
    setTapCount((n) => n + 1);
  };
  useEffect(() => {
    const open = (r: Notifications.NotificationResponse | null) => {
      if (!r || r.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
      const data = r.notification.request.content.data;
      if (data?.kind === 'nudge') {
        refreshSquad();
        setTapped('/(tabs)/squad');
      } else if (typeof data?.url === 'string') {
        setTapped(data.url);
      }
      // Handled once: otherwise the same tap would be replayed on the next launch.
      Notifications.clearLastNotificationResponse();
    };
    open(Notifications.getLastNotificationResponse());
    const sub = Notifications.addNotificationResponseReceivedListener(open);
    return () => sub.remove();
  }, []);
  useEffect(() => {
    const url = tapped.current;
    if (!url || !ready || !onboarded) return;
    tapped.current = null;
    // Next tick, so a screen that just mounted is in the navigator first.
    setTimeout(() => router.navigate(url as never), 0);
  }, [tapCount, ready, onboarded]);
  const [fontsLoaded, fontError] = useFonts({ Bangers_400Regular, PermanentMarker_400Regular, RussoOne_400Regular });

  // Swap the static native splash for the animated boot screen as soon as fonts are in.
  const [booting, setBooting] = useState(true);
  const fontsDone = fontsLoaded || !!fontError;
  useEffect(() => {
    if (fontsDone) SplashScreen.hideAsync();
  }, [fontsDone]);
  const endBoot = useCallback(() => setBooting(false), []);

  useEffect(() => {
    hydrate()
      .then(() => {
        actions.applyStreakFreezes();
        actions.refreshReminder();
        actions.syncHealth();
        actions.repairMeals();
        actions.ensurePlans();
      })
      .finally(() => {});
  }, []);

  // Fall back to system fonts rather than hang if a font fails to load.
  if (!fontsDone) return null;

  return (
    <>
      {ready && (
        <ThemeProvider value={theme}>
          <StatusBar style="light" />
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg } }}>
            <Stack.Protected guard={onboarded}>
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="goals" options={{ presentation: 'modal' }} />
              <Stack.Screen name="wellbeing" options={{ presentation: 'modal' }} />
              <Stack.Screen name="day/[key]" />
              <Stack.Screen name="ranks" options={{ presentation: 'modal' }} />
              <Stack.Screen name="recap" options={{ presentation: 'modal' }} />
              <Stack.Screen name="plans" options={{ presentation: 'modal' }} />
              <Stack.Screen name="scan" options={{ presentation: 'fullScreenModal' }} />
              <Stack.Screen name="progress-photos" options={{ presentation: 'modal' }} />
              <Stack.Screen name="season" options={{ presentation: 'modal' }} />
              <Stack.Screen name="credits" options={{ presentation: 'modal' }} />
              <Stack.Screen name="crew/[id]" options={{ presentation: 'modal' }} />
              <Stack.Screen name="challenge-new" options={{ presentation: 'modal' }} />
              <Stack.Screen name="blocked" options={{ presentation: 'modal' }} />
              <Stack.Screen name="add/[code]" options={{ presentation: 'modal' }} />
              <Stack.Screen name="join/[code]" options={{ presentation: 'modal' }} />
              <Stack.Screen name="r/[code]" options={{ presentation: 'modal' }} />
              <Stack.Screen name="music" options={{ presentation: 'modal' }} />
              <Stack.Screen name="avatars" options={{ presentation: 'modal' }} />
            </Stack.Protected>
            <Stack.Protected guard={!onboarded}>
              <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
            </Stack.Protected>
          </Stack>
          {onboarded && <RewardToast />}
          <ShareCardHost />
        </ThemeProvider>
      )}
      {booting && <BootScreen ready={ready} onDone={endBoot} />}
    </>
  );
}
