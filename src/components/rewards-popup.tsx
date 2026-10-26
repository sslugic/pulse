import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Modal, Pressable, StyleSheet, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';

import { C } from '@/constants/theme';
import type { ChestTier } from '@/lib/arcade';
import { CHEST_LOOK } from '@/lib/brain';
import { t } from '@/lib/i18n';
import { challengeChest, claimChallenge, claimLeague, challengeClaimId, lastWeekPrize, outcome, useSquad } from '@/lib/social';
import { overlayBusy, useOverlay } from '@/lib/overlays';
import { playSfx } from '@/lib/sound';
import { useStore } from '@/lib/store';
import { useTodayKey } from '@/lib/use-today';

import { ChestArt, ChestOpener } from './chest';
import { T, tap } from './ui';
import { ArcadeButton, Comic } from './underground';

// Duolingo-style "you've got rewards" pop-up: when chests are waiting (unopened ones, a top-3 week,
// a won challenge), it offers to open them right there. To stay out of the way it shows at most once
// every 6 hours, only for rewards it hasn't shown before, and "Later" always dismisses it.

const SEEN_KEY = 'pulse:rewards-seen:v1';
const COOLDOWN_MS = 6 * 60 * 60 * 1000;

type Pending = { key: string; tier: ChestTier; claim?: () => string | null; chestId?: string };

export function RewardsPopup() {
  const chests = useStore((s) => s.game.chests);
  const touring = useStore((s) => s.tourStep != null);
  const claims = useStore((s) => s.game.claims);
  const challenges = useSquad((s) => s.challenges);
  const lastWeek = useSquad((s) => s.lastWeek);
  const today = useTodayKey();

  const pending = useMemo<Pending[]>(() => {
    const list: Pending[] = (chests ?? []).map((c) => ({ key: `chest:${c.id}`, tier: c.tier, chestId: c.id }));
    const prize = lastWeekPrize();
    if (prize && !prize.claimed) list.push({ key: `league:${prize.week}`, tier: prize.tier, claim: claimLeague });
    for (const c of challenges) {
      const tier = challengeChest(outcome(c), c.hard);
      if (tier && !claims.some((x) => x.questId === challengeClaimId(c.id))) list.push({ key: `challenge:${c.id}`, tier, claim: () => claimChallenge(c) });
    }
    return list;
    // lastWeek and today are inputs of lastWeekPrize/outcome.
  }, [chests, claims, challenges, lastWeek, today]); // eslint-disable-line react-hooks/exhaustive-deps

  const [visible, setVisible] = useState(false);
  const [queue, setQueue] = useState<{ id: string; tier: ChestTier }[]>([]);
  const [foreground, setForeground] = useState(0);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => s === 'active' && setForeground((n) => n + 1));
    return () => sub.remove();
  }, []);

  // Only decide at launch (once Squad has had a moment to load) and when the app comes back, never
  // in reaction to a chest appearing: that happens while another chest screen is already open, and
  // iOS can't stack the two.
  const latest = useRef(pending);
  const showing = useRef(false);
  const touringRef = useRef(false);
  useOverlay('rewards', visible || queue.length > 0);
  useEffect(() => {
    touringRef.current = touring;
    latest.current = pending;
    showing.current = visible || queue.length > 0;
  });
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(
      () => {
        const now = latest.current;
        if (!now.length || showing.current || touringRef.current || overlayBusy('rewards')) return;
        AsyncStorage.getItem(SEEN_KEY)
          .then((raw) => {
            const seen = raw ? (JSON.parse(raw) as { at: number; keys: string[] }) : { at: 0, keys: [] };
            const fresh = now.some((p) => !seen.keys.includes(p.key));
            if (!cancelled && !showing.current && !overlayBusy('rewards') && fresh && Date.now() - seen.at > COOLDOWN_MS) {
              setVisible(true);
              playSfx('reward');
            }
          })
          .catch(() => {});
      },
      foreground === 0 ? 2500 : 800,
    );
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [foreground]);

  const remember = () =>
    AsyncStorage.setItem(SEEN_KEY, JSON.stringify({ at: Date.now(), keys: pending.map((p) => p.key) })).catch(() => {});

  const later = () => {
    tap();
    remember();
    setVisible(false);
  };

  const open = () => {
    remember();
    const ids: { id: string; tier: ChestTier }[] = [];
    for (const p of pending) {
      const id = p.chestId ?? p.claim?.();
      if (id) ids.push({ id, tier: p.tier });
    }
    setVisible(false);
    // iOS can't present the chest while the pop-up is still sliding away.
    setTimeout(() => setQueue(ids), 450);
  };

  const best = pending.reduce<ChestTier>((b, p) => (p.tier === 'gold' || (p.tier === 'silver' && b === 'wood') ? p.tier : b), 'wood');

  return (
    <>
      <Modal visible={visible} transparent animationType="fade" onRequestClose={later}>
        <View style={styles.scrim}>
          <Animated.View entering={ZoomIn.duration(280)} style={styles.card}>
            <Comic size={30} color={CHEST_LOOK[best].glow} style={{ textAlign: 'center' }}>
              {t('rewards.popupTitle')}
            </Comic>
            <Pressable onPress={open} accessibilityRole="button" accessibilityLabel={t('rewards.popupOpen')} style={{ marginVertical: 18 }}>
              <ChestArt tier={best} size={150} bounce />
            </Pressable>
            <T size={15} rounded color={C.text} style={{ textAlign: 'center' }}>
              {t('rewards.popupBody', { count: pending.length })}
            </T>
            <ArcadeButton label={t('rewards.popupOpen')} size="md" onPress={open} style={{ alignSelf: 'stretch', marginTop: 18 }} />
            <Pressable onPress={later} hitSlop={8} style={{ padding: 10, marginTop: 4 }}>
              <T size={14} rounded color={C.textDim}>
                {t('rewards.popupLater')}
              </T>
            </Pressable>
          </Animated.View>
        </View>
      </Modal>
      <ChestOpener chest={queue[0] ?? null} day={today} onClose={() => setQueue((q) => q.slice(1))} />
    </>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: '#000000D9', alignItems: 'center', justifyContent: 'center', padding: 28 },
  card: { alignSelf: 'stretch', alignItems: 'center', padding: 24, borderRadius: 22, backgroundColor: C.surface, borderWidth: 3, borderColor: C.ink },
});
