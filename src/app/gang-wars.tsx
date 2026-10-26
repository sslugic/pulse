import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import GangWarsGame, { type GangResult } from '@/components/gang-wars-game';
import { t } from '@/lib/i18n';
import { questXp } from '@/lib/quests';
import { crewRank } from '@/lib/rank';
import { actions, useStore } from '@/lib/store';
import { useTodayKey } from '@/lib/use-today';

/** Gang Wars, the Arcade brawler. Its strength comes from the XP earned in Pulse. */
export default function GangWarsScreen() {
  const entries = useStore((s) => s.entries);
  const claims = useStore((s) => s.game.claims);
  const frozen = useStore((s) => s.game.frozenDays);
  const xp = useMemo(() => crewRank(entries, questXp(claims), frozen).xp, [entries, claims, frozen]);
  const day = useTodayKey();
  const safe = useSafeAreaInsets();
  // Mount the game once the full-screen modal has opened; a webview created mid-transition can miss
  // its first messages.
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setReady(true), 350);
    return () => clearTimeout(id);
  }, []);
  const insets = useMemo(() => ({ top: safe.top, bottom: safe.bottom }), [safe.top, safe.bottom]);

  const text = useMemo(
    () => ({
      start: t('gang.start'),
      tapToStart: t('gang.tapToStart'),
      go: t('gang.go'),
      joins: t('gang.joins'),
      boss: t('gang.boss'),
      clear: t('gang.clear'),
      over: t('gang.over'),
      timeUp: t('gang.timeUp'),
      again: t('gang.again'),
      exit: t('gang.exit'),
      power: t('gang.power'),
      controls: t('gang.controls'),
    }),
    [],
  );

  const onEnd = useCallback(async (r: GangResult) => {
    actions.finishGang(r, day);
  }, [day]);
  const onExit = useCallback(async () => router.back(), []);

  return (
    <View style={{ flex: 1, backgroundColor: '#07040E' }}>
      {ready && (
        <GangWarsGame xp={xp} insets={insets} text={text} onEnd={onEnd} onExit={onExit} dom={{ scrollEnabled: false, bounces: false, contentInsetAdjustmentBehavior: 'never', style: { flex: 1 } }} />
      )}
    </View>
  );
}
