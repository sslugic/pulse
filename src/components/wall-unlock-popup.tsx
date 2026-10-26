import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';

import { C } from '@/constants/theme';
import { t } from '@/lib/i18n';
import { onRestored, useOverlay, useOverlayBusy } from '@/lib/overlays';
import { playSfx } from '@/lib/sound';
import { useAnnouncement } from '@/lib/starter-rewards';
import { actions, getState, useStore } from '@/lib/store';
import { isWallUnlocked, WALLS } from '@/lib/walls';

import { useWallProgress, wallProgressOf } from './backdrops';
import { T, tap } from './ui';
import { ArcadeButton, Comic } from './underground';

// "New wall unlocked!" when a rank, streak or logging milestone opens a wall, offering to use it.
// Walls already unlocked when this first runs are marked seen, so existing players aren't flooded.
// Chest walls are announced by the chest itself.

const SEEN_KEY = 'pulse:walls-seen:v1';

export function WallUnlockPopup() {
  const progress = useWallProgress();
  const touring = useStore((s) => s.tourStep != null);
  const announcing = !!useAnnouncement();
  const busy = useOverlayBusy('wall');
  const [seen, setSeen] = useState<string[] | null>(null);
  // A backup restored on sign-in brings its walls along; they aren't news, so they become the baseline.
  useEffect(
    () =>
      onRestored(() => {
        const { entries, game } = getState();
        const p = wallProgressOf(entries, game.claims, game.frozenDays, game.unlocked);
        const all = WALLS.filter((w) => isWallUnlocked(w, p)).map((w) => w.id);
        setSeen(all);
        AsyncStorage.setItem(SEEN_KEY, JSON.stringify(all)).catch(() => {});
      }),
    [],
  );

  const open = useMemo(() => WALLS.filter((w) => isWallUnlocked(w, progress)).map((w) => w.id), [progress]);

  useEffect(() => {
    AsyncStorage.getItem(SEEN_KEY)
      .then((raw) => {
        if (raw) return setSeen(JSON.parse(raw));
        AsyncStorage.setItem(SEEN_KEY, JSON.stringify(open)).catch(() => {});
        setSeen(open);
      })
      .catch(() => setSeen(open));
    // Only on mount: the first run's unlocks become the baseline.
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const next = seen ? WALLS.find((w) => open.includes(w.id) && !seen.includes(w.id) && !w.chest) : undefined;
  const show = !!next && !touring && !announcing && !busy;
  useOverlay('wall', show);

  useEffect(() => {
    if (show) playSfx('fanfare');
  }, [show, next?.id]);

  if (!next || !show || !seen) return null;
  const done = (use: boolean) => {
    tap();
    if (use) actions.setWall(next.id);
    const all = [...seen, ...open.filter((id) => !seen.includes(id) && WALLS.find((w) => w.id === id)?.chest), next.id];
    setSeen(all);
    AsyncStorage.setItem(SEEN_KEY, JSON.stringify(all)).catch(() => {});
  };

  return (
    <Modal transparent animationType="fade" onRequestClose={() => done(false)}>
      <View style={styles.scrim}>
        <Animated.View key={next.id} entering={ZoomIn.springify().damping(14)} style={styles.card}>
          <Comic size={28} color={C.lime} style={{ textAlign: 'center' }}>
            {t('walls.newTitle')}
          </Comic>
          <View style={styles.art}>
            <Image source={next.art} style={StyleSheet.absoluteFill} contentFit="cover" />
          </View>
          <T size={15} color={C.text} style={styles.center}>
            {t('walls.newBody', { name: next.name })}
          </T>
          <ArcadeButton label={t('walls.useIt')} size="md" onPress={() => done(true)} style={{ alignSelf: 'stretch' }} />
          <Pressable onPress={() => done(false)} hitSlop={8} style={{ padding: 6 }}>
            <T size={14} rounded color={C.textDim}>
              {t('walls.later')}
            </T>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: '#000000B3', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 380, alignItems: 'center', gap: 12, padding: 20, borderRadius: 24, backgroundColor: C.surface, borderWidth: 3, borderColor: C.lime },
  art: { width: 170, height: 300, borderRadius: 14, overflow: 'hidden', borderWidth: 2, borderColor: C.ink },
  center: { textAlign: 'center', lineHeight: 21 },
});
