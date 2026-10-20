import { router, usePathname } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { C, Display } from '@/constants/theme';
import { tap } from '@/lib/haptics';
import { t } from '@/lib/i18n';

import { Icon, type IconName } from './icon';
import { T } from './ui';

export type CoachMode = 'voice' | 'camera' | 'type';

export function openCoach(mode: CoachMode) {
  tap();
  router.navigate({ pathname: '/coach', params: { mode, t: String(Date.now()) } });
}

const OPTIONS: { mode: CoachMode; label: string; icon: IconName; color: string }[] = [
  { mode: 'type', label: t('common.fabType'), icon: 'bubble', color: C.cyan },
  { mode: 'camera', label: t('common.fabSnap'), icon: 'camera', color: C.orange },
  { mode: 'voice', label: t('common.fabTalk'), icon: 'mic', color: C.yellow },
];

// Height of the street tab bar above the home indicator.
const TAB_BAR = 90;

/** Floating log button over every tab; opens Talk, Snap and Type. Hidden on the Coach tab, which has its own input. */
export function QuickFab() {
  const insets = useSafeAreaInsets();
  const path = usePathname();
  const [open, setOpen] = useState(false);
  if (path === '/coach') return null;

  const bottom = Math.max(insets.bottom - 6, 8) + TAB_BAR + 14;
  const pick = (mode: CoachMode) => {
    setOpen(false);
    openCoach(mode);
  };

  return (
    <>
      {open && (
        <Animated.View entering={FadeIn.duration(150)} exiting={FadeOut.duration(150)} style={StyleSheet.absoluteFill}>
          <Pressable style={[StyleSheet.absoluteFill, styles.scrim]} onPress={() => setOpen(false)} accessibilityLabel={t('common.fabClose')} />
        </Animated.View>
      )}
      <View pointerEvents="box-none" style={[styles.wrap, { bottom }]}>
        {open &&
          OPTIONS.map((o, i) => (
            <Animated.View key={o.mode} entering={FadeInDown.delay((OPTIONS.length - 1 - i) * 40).duration(180)} exiting={FadeOut.duration(100)}>
              <Pressable
                onPress={() => pick(o.mode)}
                accessibilityRole="button"
                accessibilityLabel={o.label}
                style={({ pressed }) => [styles.option, pressed && { transform: [{ translateY: 2 }] }]}>
                <T size={15} rounded color={C.text} style={styles.optionLabel}>
                  {o.label}
                </T>
                <View style={[styles.optionIcon, { backgroundColor: o.color }]}>
                  <Icon name={o.icon} size={22} color={C.ink} weight="bold" />
                </View>
              </Pressable>
            </Animated.View>
          ))}
        <Pressable
          onPress={() => {
            tap();
            setOpen((v) => !v);
          }}
          accessibilityRole="button"
          accessibilityLabel={open ? t('common.fabClose') : t('common.fabOpen')}
          style={({ pressed }) => [styles.fab, open && styles.fabOpen, pressed && { transform: [{ scale: 0.94 }] }]}>
          <View style={{ transform: [{ rotate: open ? '45deg' : '0deg' }] }}>
            <Icon name="plus" size={30} color={C.ink} weight="bold" />
          </View>
        </Pressable>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  scrim: { backgroundColor: 'rgba(5,6,7,0.6)' },
  wrap: { position: 'absolute', right: 16, alignItems: 'flex-end', gap: 12 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  optionLabel: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#1D2023',
    borderWidth: 2,
    borderColor: C.ink,
    fontFamily: Display.block,
  },
  optionIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: C.ink,
  },
  fab: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.lime,
    borderWidth: 3,
    borderColor: C.ink,
    shadowColor: C.lime,
    shadowOpacity: 0.8,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
  },
  fabOpen: { backgroundColor: C.yellow, shadowColor: C.yellow },
});
