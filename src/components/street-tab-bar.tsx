import type { BottomTabBarProps } from 'expo-router/tabs';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';

import { C, Display } from '@/constants/theme';
import { tap } from '@/lib/haptics';
import { t } from '@/lib/i18n';

import { Icon, type IconName } from './icon';

export const TABS: Record<string, { label: string; icon: IconName; color: string }> = {
  index: { label: t('common.tabHq'), icon: 'flame', color: C.orange },
  coach: { label: t('common.tabCoach'), icon: 'sparkles', color: C.violet },
  journal: { label: t('common.tabJournal'), icon: 'journal', color: C.pink },
  arcade: { label: t('common.tabArcade'), icon: 'game', color: C.yellow },
  trends: { label: t('common.tabStats'), icon: 'chart', color: C.lime },
  profile: { label: t('common.tabCrew'), icon: 'person', color: C.cyan },
};

/** Spray-paint splat behind the active tab. */
function Splat({ color, faint }: { color: string; faint?: boolean }) {
  return (
    <Svg width={62} height={50} viewBox="0 0 62 50" style={[StyleSheet.absoluteFill, faint && { opacity: 0.28, transform: [{ scale: 0.82 }] }]}>
      <Path
        d="M31 4c6 0 9 4 14 4s9-1 11 4-2 8 0 12 4 9-1 12-9 2-12 6-6 6-12 5-7-5-12-5-9 3-12-1 1-8-1-12-6-7-2-11 7-2 10-6 8-8 17-8z"
        fill={color}
        opacity={0.85}
      />
      <Circle cx={55} cy={8} r={2.5} fill={color} opacity={0.8} />
      <Circle cx={6} cy={42} r={2} fill={color} opacity={0.8} />
      <Circle cx={50} cy={46} r={1.6} fill={color} opacity={0.7} />
    </Svg>
  );
}

export function StreetTabBar({ state, navigateToTab }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View>
      <LinearGradient colors={['#4A4F53', '#2C3034', '#1D2023']} style={[styles.bar, { paddingBottom: Math.max(insets.bottom - 6, 8) }]}>
        <View style={styles.inner}>
          {state.routes.map((route, i) => {
            const meta = TABS[route.name];
            if (!meta) return null;
            const focused = state.index === i;
            return (
              <Pressable
                key={route.key}
                accessibilityRole="button"
                accessibilityState={{ selected: focused }}
                accessibilityLabel={meta.label}
                onPress={() => {
                  tap();
                  if (!focused) navigateToTab(route.key);
                }}
                style={({ pressed }) => [styles.item, pressed && { transform: [{ scale: 0.92 }] }]}>
                <View style={styles.iconWrap}>
                  <Splat color={meta.color} faint={!focused} />
                  <Icon name={meta.icon} size={24} color={focused ? C.ink : C.text} weight="bold" />
                </View>
                <Text style={[styles.label, { color: focused ? C.text : C.textMute }]}>{meta.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { borderTopWidth: 2, borderTopColor: '#0B0C0D', paddingTop: 6 },
  inner: { flexDirection: 'row', justifyContent: 'space-around', paddingHorizontal: 8 },
  item: { alignItems: 'center', flex: 1, gap: 2 },
  iconWrap: { width: 52, height: 46, alignItems: 'center', justifyContent: 'center' },
  label: { fontFamily: Display.comic, fontSize: 13, letterSpacing: 1, textShadowColor: '#000', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 0 },
});
