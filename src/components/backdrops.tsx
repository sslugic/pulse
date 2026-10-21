import { Image } from 'expo-image';
import { useMemo, type ReactNode } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { questXp } from '@/lib/quests';
import { crewRank, RANKS } from '@/lib/rank';
import { t } from '@/lib/i18n';
import { useStore } from '@/lib/store';

// One backdrop scene per crew rank, so the app's walls change every time the player ranks up. The
// scenes are drawn in scripts/walls/scenes.html and rendered to images by scripts/render-walls.sh.

export const WALL_NAMES = [
  t('ranks.wallBackAlley'),
  t('ranks.wallHandballCourt'),
  t('ranks.wallNightStreet'),
  t('ranks.wallBodegaCorner'),
  t('ranks.wallBasketballCourt'),
  t('ranks.wallRooftop'),
  t('ranks.wallSubwayStation'),
  t('ranks.wallSubwayTunnel'),
  t('ranks.wallTrainYard'),
  t('ranks.wallBridgeUnderpass'),
  t('ranks.wallNeonClub'),
  t('ranks.wallBlockParty'),
  t('ranks.wallBillboardSquare'),
  t('ranks.wallHallOfFame'),
  t('ranks.wallPulseTower'),
] as const;

const WALLS = [
  require('@/assets/images/walls/wall-01.jpg'),
  require('@/assets/images/walls/wall-02.jpg'),
  require('@/assets/images/walls/wall-03.jpg'),
  require('@/assets/images/walls/wall-04.jpg'),
  require('@/assets/images/walls/wall-05.jpg'),
  require('@/assets/images/walls/wall-06.jpg'),
  require('@/assets/images/walls/wall-07.jpg'),
  require('@/assets/images/walls/wall-08.jpg'),
  require('@/assets/images/walls/wall-09.jpg'),
  require('@/assets/images/walls/wall-10.jpg'),
  require('@/assets/images/walls/wall-11.jpg'),
  require('@/assets/images/walls/wall-12.jpg'),
  require('@/assets/images/walls/wall-13.jpg'),
  require('@/assets/images/walls/wall-14.jpg'),
  require('@/assets/images/walls/wall-15.jpg'),
];

/** The wall this player sees: the one they picked, if they've unlocked it, else their current rank's. */
export function useWallLevel() {
  const entries = useStore((s) => s.entries);
  const claims = useStore((s) => s.game.claims);
  const picked = useStore((s) => s.game.wall);
  const frozen = useStore((s) => s.game.frozenDays);
  const level = useMemo(() => crewRank(entries, questXp(claims), frozen).level, [entries, claims, frozen]);
  return { level, wall: picked && picked <= level ? picked : level };
}

/**
 * Draws one rank's scene, filling the given box. The art is phone-shaped and cropped around its middle,
 * where each scene's subject sits, so thumbnails on the ranks screen show the heart of the wall.
 * `tags` and `station` are kept for older call sites; the painted scenes carry their own signs.
 */
export function RankScene({ level }: { level: number; width?: number; height?: number; tags?: string[]; station?: string }) {
  // Several ranks share a wall; each rank names the scene it unlocks.
  const i = RANKS[Math.max(1, Math.min(level, RANKS.length)) - 1].scene;
  return (
    <View style={[StyleSheet.absoluteFill, styles.base]} pointerEvents="none">
      <Image source={WALLS[i]} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition="center" transition={250} cachePolicy="memory" />
    </View>
  );
}

/** Full-screen backdrop behind every screen, themed to the player's rank. */
export function Backdrop({ children }: { tags?: string[]; station?: string; children?: ReactNode }) {
  const { width, height } = useWindowDimensions();
  const { wall } = useWallLevel();
  return (
    <>
      <RankScene level={wall} width={width} height={height} />
      {children}
    </>
  );
}

const styles = StyleSheet.create({
  base: { overflow: 'hidden', backgroundColor: '#07080C' },
});
