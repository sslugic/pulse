import { Image } from 'expo-image';
import { useMemo, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { bestStreak, loggedDays } from '@/lib/nutrition';
import { questXp } from '@/lib/quests';
import { crewRank } from '@/lib/rank';
import { useStore } from '@/lib/store';
import { isWallUnlocked, rankWall, wallById, type WallDef, type WallProgress } from '@/lib/walls';

// The app's backdrop: the wall the player picked (src/lib/walls.ts), if they've unlocked it, else the
// wall their current rank brings, so the walls change as they rank up.

/** What the player has done toward unlocking walls. */
export function useWallProgress(): WallProgress {
  const entries = useStore((s) => s.entries);
  const claims = useStore((s) => s.game.claims);
  const frozen = useStore((s) => s.game.frozenDays);
  const unlocked = useStore((s) => s.game.unlocked);
  return useMemo(
    () => ({
      level: crewRank(entries, questXp(claims), frozen).level,
      unlocked,
      bestStreak: bestStreak(entries, frozen),
      daysLogged: loggedDays(entries).size,
    }),
    [entries, claims, frozen, unlocked],
  );
}

/** The wall this player sees: the one they picked, if it's unlocked, else their current rank's. */
export function useWall() {
  const progress = useWallProgress();
  const picked = useStore((s) => s.game.wall);
  // The first walls were picked by rank number.
  const pick = typeof picked === 'number' ? rankWall(picked) : wallById(picked);
  const wall = pick && isWallUnlocked(pick, progress) ? pick : rankWall(progress.level);
  return { wall, progress };
}

/** Draws one wall, filling its box. The art is phone-shaped and cropped around its middle. */
export function WallScene({ wall }: { wall: WallDef }) {
  return (
    <View style={[StyleSheet.absoluteFill, styles.base]} pointerEvents="none">
      <Image source={wall.art} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition="center" transition={250} cachePolicy="memory" />
    </View>
  );
}

/** The wall a rank brings (share cards). `tags` and `station` are kept for older call sites. */
export function RankScene({ level }: { level: number; width?: number; height?: number; tags?: string[]; station?: string }) {
  return <WallScene wall={rankWall(level)} />;
}

/** Full-screen backdrop behind every screen, themed to the player's rank. */
export function Backdrop({ children }: { tags?: string[]; station?: string; children?: ReactNode }) {
  const { wall } = useWall();
  return (
    <>
      <WallScene wall={wall} />
      {children}
    </>
  );
}

const styles = StyleSheet.create({
  base: { overflow: 'hidden', backgroundColor: '#07080C' },
});
