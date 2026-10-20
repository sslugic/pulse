import { Bangers_400Regular } from '@expo-google-fonts/bangers';
import { PermanentMarker_400Regular } from '@expo-google-fonts/permanent-marker';
import { RussoOne_400Regular } from '@expo-google-fonts/russo-one';
import { useFonts } from 'expo-font';
import * as Notifications from 'expo-notifications';
import { DarkTheme, router, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';

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
  // A tapped nudge notification opens Squad.
  useEffect(() => {
    const open = (r: Notifications.NotificationResponse | null) => {
      if (r?.notification.request.content.data?.kind !== 'nudge') return;
      refreshSquad();
      router.navigate('/(tabs)/squad');
    };
    Notifications.getLastNotificationResponseAsync().then(open).catch(() => {});
    const sub = Notifications.addNotificationResponseReceivedListener(open);
    return () => sub.remove();
  }, []);
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
