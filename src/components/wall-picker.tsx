import { Image } from 'expo-image';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { C } from '@/constants/theme';
import { t } from '@/lib/i18n';
import { RANKS } from '@/lib/rank';
import { actions, useStore } from '@/lib/store';
import { isWallUnlocked, WALL_TOTAL, wallHint, WALLS } from '@/lib/walls';

import { useWall } from './backdrops';
import { Icon } from './icon';
import { Card, SectionTitle, T, tap } from './ui';

/** Crew → Walls: every backdrop, unlocked ones ready to use and locked ones saying how to get them. */
export function WallPicker() {
  const { wall, progress } = useWall();
  const following = useStore((s) => s.game.wall == null);
  const owned = WALLS.filter((w) => isWallUnlocked(w, progress)).length;

  return (
    <>
      <SectionTitle
        right={
          !following ? (
            <Pressable onPress={() => (tap(), actions.setWall(undefined))} hitSlop={6}>
              <T size={11} rounded color={C.cyan}>
                {t('walls.followRank')}
              </T>
            </Pressable>
          ) : undefined
        }>
        {t('walls.section')}
      </SectionTitle>
      <Card style={{ gap: 12 }}>
        <T size={12} rounded color={C.lime}>
          {t('walls.owned', { n: owned, total: WALL_TOTAL })}
        </T>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
          {WALLS.map((w) => {
            const unlocked = isWallUnlocked(w, progress);
            const inUse = w.id === wall.id;
            return (
              <Pressable
                key={w.id}
                disabled={!unlocked || inUse}
                onPress={() => (tap(), actions.setWall(w.id))}
                style={styles.cell}
                accessibilityRole="button"
                accessibilityState={{ selected: inUse, disabled: !unlocked }}
                accessibilityLabel={w.name}>
                <View style={[styles.frame, inUse && styles.frameActive]}>
                  <Image source={w.art} style={[styles.thumb, !unlocked && styles.locked]} contentFit="cover" />
                  {!unlocked && (
                    <View style={styles.lock}>
                      <Icon name="lock" size={18} color={C.text} />
                    </View>
                  )}
                </View>
                <T size={10} rounded color={unlocked ? C.text : C.textDim} numberOfLines={2} style={{ textAlign: 'center' }}>
                  {w.name}
                </T>
                <T size={10} color={inUse ? C.lime : C.textMute} numberOfLines={2} style={{ textAlign: 'center' }}>
                  {inUse ? t('walls.inUse') : unlocked ? ' ' : wallHint(w, (l) => RANKS[l - 1].name)}
                </T>
              </Pressable>
            );
          })}
        </ScrollView>
        <T size={12} color={C.textMute}>
          {t('walls.note')}
        </T>
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  cell: { width: 84, gap: 4, alignItems: 'center' },
  frame: { width: 84, height: 150, borderRadius: 10, overflow: 'hidden', borderWidth: 2, borderColor: C.ink },
  frameActive: { borderColor: C.lime },
  thumb: { width: '100%', height: '100%' },
  locked: { opacity: 0.35 },
  lock: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center' },
});
