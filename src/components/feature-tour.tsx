import { router } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { C } from '@/constants/theme';
import { t } from '@/lib/i18n';
import { earnStarter } from '@/lib/starter-rewards';
import { actions, useStore } from '@/lib/store';

import { Icon, type IconName } from './icon';
import { T, tap } from './ui';
import { ArcadeButton, Comic } from './underground';

// A short guided tour after setup (and from Crew → Replay tour): it opens each tab in turn and points
// at it with a card explaining what it's for. Drawn over the tabs, not as a modal, so it never fights
// with other pop-ups.

type Target = { tab: number } | 'fab' | null;

interface TourStop {
  route: '/' | '/coach' | '/journal' | '/squad' | '/arcade' | '/profile';
  icon: IconName;
  color: string;
  title: string;
  body: string;
  target: Target;
}

// Tab positions in the bar: HQ, Coach, Journal, Squad, Arcade, Crew (Stats has no button).
const TAB_COUNT = 6;

const STOPS = (): TourStop[] => [
  { route: '/', icon: 'flame', color: C.orange, title: t('tour.hqTitle'), body: t('tour.hqBody'), target: { tab: 0 } },
  { route: '/', icon: 'plus', color: C.lime, title: t('tour.logTitle'), body: t('tour.logBody'), target: 'fab' },
  { route: '/coach', icon: 'sparkles', color: C.violet, title: t('tour.coachTitle'), body: t('tour.coachBody'), target: { tab: 1 } },
  { route: '/journal', icon: 'journal', color: C.pink, title: t('tour.journalTitle'), body: t('tour.journalBody'), target: { tab: 2 } },
  { route: '/squad', icon: 'people', color: C.lime, title: t('tour.squadTitle'), body: t('tour.squadBody'), target: { tab: 3 } },
  { route: '/arcade', icon: 'game', color: C.yellow, title: t('tour.arcadeTitle'), body: t('tour.arcadeBody'), target: { tab: 4 } },
  { route: '/profile', icon: 'person', color: C.cyan, title: t('tour.crewTitle'), body: t('tour.crewBody'), target: { tab: 5 } },
  { route: '/', icon: 'trophy', color: C.yellow, title: t('tour.doneTitle'), body: t('tour.doneBody'), target: null },
];

export function FeatureTour() {
  const step = useStore((s) => s.tourStep);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const stops = STOPS();
  const stop = step != null ? stops[step] : null;

  useEffect(() => {
    if (stop) router.navigate(stop.route);
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!stop || step == null) return null;
  const last = step === stops.length - 1;

  // The tab bar is ~90pt tall plus the home indicator; the + button sits above its right edge.
  const barTop = 90 + Math.max(insets.bottom - 6, 8);
  let arrow: { left: number; bottom: number } | null = null;
  if (stop.target === 'fab') arrow = { left: width - 16 - 32 - 12, bottom: barTop + 14 + 64 + 6 };
  else if (stop.target) arrow = { left: 8 + ((width - 16) * (stop.target.tab + 0.5)) / TAB_COUNT - 12, bottom: barTop - 4 };

  const next = () => {
    tap();
    actions.setTourStep(last ? null : step + 1);
    if (last) earnStarter('tour').catch(() => {});
  };

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View entering={FadeIn.duration(200)} style={[StyleSheet.absoluteFill, styles.scrim]} pointerEvents="auto" />
      <Animated.View key={step} entering={FadeInDown.duration(260)} style={[styles.card, { bottom: (arrow?.bottom ?? barTop + 120) + 30 }]}>
        <View style={styles.row}>
          <View style={[styles.badge, { backgroundColor: stop.color }]}>
            <Icon name={stop.icon} size={20} color={C.ink} />
          </View>
          <Comic size={26} color={C.text} style={{ flex: 1 }}>
            {stop.title}
          </Comic>
          <T size={12} rounded color={C.textMute}>
            {step + 1}/{stops.length}
          </T>
        </View>
        <T size={15} color={C.text} style={{ lineHeight: 21 }}>
          {stop.body}
        </T>
        <View style={styles.row}>
          {!last && (
            <Pressable onPress={() => (tap(), actions.setTourStep(null))} hitSlop={8} style={{ padding: 6 }}>
              <T size={14} rounded color={C.textDim}>
                {t('tour.skip')}
              </T>
            </Pressable>
          )}
          <View style={{ flex: 1 }} />
          <ArcadeButton label={last ? t('tour.letsGo') : t('tour.next')} size="md" onPress={next} style={{ minWidth: 140 }} />
        </View>
      </Animated.View>
      {arrow && (
        <Animated.View key={`a${step}`} entering={FadeIn.delay(150)} style={[styles.arrow, { left: arrow.left, bottom: arrow.bottom }]} pointerEvents="none">
          <Icon name="chevron" size={28} color={C.yellow} weight="bold" />
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: { backgroundColor: '#000000A6' },
  card: { position: 'absolute', left: 16, right: 16, gap: 12, padding: 18, borderRadius: 20, backgroundColor: C.surface, borderWidth: 3, borderColor: C.yellow },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  badge: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: C.ink },
  arrow: { position: 'absolute', width: 24, height: 28, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '90deg' }] },
});
