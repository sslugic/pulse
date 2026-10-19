import { Bangers_400Regular } from '@expo-google-fonts/bangers';
import { PermanentMarker_400Regular } from '@expo-google-fonts/permanent-marker';
import { RussoOne_400Regular } from '@expo-google-fonts/russo-one';
import { useFonts } from 'expo-font';
import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { RewardToast } from '@/components/reward-toast';
import { C } from '@/constants/theme';
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
  const [fontsLoaded, fontError] = useFonts({ Bangers_400Regular, PermanentMarker_400Regular, RussoOne_400Regular });

  useEffect(() => {
    hydrate()
      .then(() => {
        actions.applyStreakFreezes();
        actions.refreshReminder();
        actions.syncHealth();
      })
      .finally(() => SplashScreen.hideAsync());
  }, []);

  // Fall back to system fonts rather than hang if a font fails to load.
  if (!ready || (!fontsLoaded && !fontError)) return null;

  return (
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
          <Stack.Screen name="meal-plan" options={{ presentation: 'modal' }} />
          <Stack.Screen name="scan" options={{ presentation: 'fullScreenModal' }} />
          <Stack.Screen name="progress-photos" options={{ presentation: 'modal' }} />
          <Stack.Screen name="season" options={{ presentation: 'modal' }} />
        </Stack.Protected>
        <Stack.Protected guard={!onboarded}>
          <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
        </Stack.Protected>
      </Stack>
      {onboarded && <RewardToast />}
    </ThemeProvider>
  );
}
