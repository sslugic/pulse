import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { RankScene, useWallLevel, WALL_NAMES } from '@/components/backdrops';
import { GlassButton, Icon } from '@/components/icon';
import { Bar, Card, SectionTitle, T } from '@/components/ui';
import { Backdrop, Comic } from '@/components/underground';
import { C, MaxContentWidth, Space } from '@/constants/theme';
import { questXp } from '@/lib/quests';
import { crewRank, RANKS, XP_SOURCES } from '@/lib/rank';
import { actions, useStore } from '@/lib/store';
import { tap } from '@/lib/haptics';
import { locale, t } from '@/lib/i18n';

const RANK_COLORS = [C.textDim, C.steelHi, C.orange, C.orange, C.yellow, C.yellow, C.lime, C.lime, C.cyan, C.cyan, C.blue, C.violet, C.pink, C.pink, '#E8B830'];

/** The full rank ladder: where you are, what's next, and how XP is earned. */
export default function RanksScreen() {
  const insets = useSafeAreaInsets();
  const entries = useStore((s) => s.entries);
  const claims = useStore((s) => s.game.claims);
  const frozen = useStore((s) => s.game.frozenDays);
  const crew = useMemo(() => crewRank(entries, questXp(claims), frozen), [entries, claims, frozen]);
  const { wall } = useWallLevel();
  const following = useStore((s) => s.game.wall == null);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Backdrop />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <T size={13} color={C.textDim} weight="600">
              {t('ranks.subtitle')}
            </T>
            <Comic size={38}>{t('ranks.title')}</Comic>
          </View>
          <GlassButton icon="close" onPress={() => router.back()} />
        </View>

        <Card style={{ gap: 10 }} accent={RANK_COLORS[crew.level - 1] + 'AA'}>
          <View style={styles.between}>
            <View>
              <T size={11} rounded color={C.textDim}>
                {t('ranks.levelOf', { level: crew.level, total: RANKS.length })}
              </T>
              <Comic size={30} color={RANK_COLORS[crew.level - 1]}>
                {crew.rank.toUpperCase()}
              </Comic>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <T size={26} rounded color={C.lime}>
                {crew.xp.toLocaleString(locale)}
              </T>
              <T size={11} rounded color={C.textMute}>
                {t('ranks.totalXp')}
              </T>
            </View>
          </View>
          <Bar value={crew.progress} max={1} color={RANK_COLORS[crew.level - 1]} height={10} />
          <T size={12} color={C.textDim} weight="700">
            {crew.next ? t('ranks.xpToNext', { xp: crew.toNext.toLocaleString(locale), rank: crew.next }) : t('ranks.topRank')}
          </T>
        </Card>

        <SectionTitle
          right={
            !following ? (
              <Pressable onPress={() => actions.setWall(undefined)} hitSlop={6}>
                <T size={11} rounded color={C.cyan}>
                  {t('ranks.followMyRank')}
                </T>
              </Pressable>
            ) : undefined
          }>
          {t('ranks.ladder')}
        </SectionTitle>
        <T size={12} color={C.textDim} style={{ lineHeight: 17, marginTop: -4 }}>
          {t('ranks.ladderIntro')}
        </T>
        <View style={{ gap: 8 }}>
          {RANKS.map((r, i) => {
            const done = i < crew.level - 1;
            const current = i === crew.level - 1;
            const color = RANK_COLORS[i];
            return (
              <View key={r.name} style={styles.rung}>
                <View style={[styles.node, { borderColor: current || done ? color : '#3A3F43', backgroundColor: current ? color : done ? color + '33' : '#1D2023' }]}>
                  {done ? (
                    <Icon name="check" size={14} color={color} weight="bold" />
                  ) : (
                    <T size={13} rounded color={current ? C.ink : C.textMute}>
                      {i + 1}
                    </T>
                  )}
                </View>
                {i < RANKS.length - 1 && <View style={[styles.rail, { backgroundColor: done ? color : '#2A2D30' }]} />}
                <Card style={{ flex: 1, gap: 2, marginBottom: 2 }} accent={current ? color + 'CC' : undefined}>
                  <View style={styles.between}>
                    <Comic size={20} color={current || done ? C.text : C.textMute}>
                      {r.name.toUpperCase()}
                    </Comic>
                    <T size={12} rounded color={current ? color : C.textMute}>
                      {current ? t('ranks.youAreHere') : t('ranks.xpAmount', { xp: r.xp.toLocaleString(locale) })}
                    </T>
                  </View>
                  <T size={12} color={current || done ? C.textDim : C.textMute} style={{ lineHeight: 17 }}>
                    {r.blurb}
                  </T>
                  {/* Only ranks that unlock a new wall show one */}
                  {(i === 0 || RANKS[i - 1].scene !== r.scene) && (
                    <WallThumb level={i + 1} unlocked={done || current} inUse={RANKS[wall - 1].scene === r.scene} color={color} />
                  )}
                </Card>
              </View>
            );
          })}
        </View>

        <SectionTitle>{t('ranks.howToEarn')}</SectionTitle>
        <Card style={{ gap: 8 }}>
          {XP_SOURCES.map((x) => (
            <View key={x.label} style={styles.between}>
              <T size={13} color={C.text}>
                {x.label}
              </T>
              <T size={13} rounded color={C.lime}>
                {x.xp}
              </T>
            </View>
          ))}
        </Card>
      </ScrollView>
    </View>
  );
}

/** Preview of a rank's wall; unlocked ones can be tapped to use as the app background. */
function WallThumb({ level, unlocked, inUse, color }: { level: number; unlocked: boolean; inUse: boolean; color: string }) {
  const [width, setWidth] = useState(0);
  return (
    <Pressable
      disabled={!unlocked || inUse}
      onPress={() => {
        tap();
        actions.setWall(level);
      }}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      accessibilityRole="button"
      accessibilityLabel={t(unlocked ? 'ranks.wallLabel' : 'ranks.wallLabelLocked', { name: WALL_NAMES[RANKS[level - 1].scene] })}
      style={[styles.thumb, { borderColor: inUse ? color : C.ink }]}>
      {width > 0 && <RankScene level={level} width={width} height={130} />}
      {!unlocked && (
        <View style={styles.locked}>
          <Icon name="lock" size={16} color={C.textDim} />
        </View>
      )}
      <View style={styles.thumbLabel}>
        <T size={10} rounded color={C.text}>
          {WALL_NAMES[RANKS[level - 1].scene]}
        </T>
        {(inUse || unlocked) && (
          <T size={10} rounded color={inUse ? color : C.cyan}>
            {inUse ? t('ranks.inUse') : t('ranks.tapToUse')}
          </T>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  thumb: { height: 130, marginTop: 8, borderRadius: 8, overflow: 'hidden', borderWidth: 2 },
  locked: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(11,12,13,0.4)', alignItems: 'center', justifyContent: 'center' },
  thumbLabel: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 8, paddingVertical: 4, backgroundColor: 'rgba(11,12,13,0.7)' },
  content: { paddingHorizontal: Space.md, paddingTop: Space.lg, gap: Space.sm, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: Space.sm },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  rung: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  node: { width: 32, height: 32, borderRadius: 16, borderWidth: 3, alignItems: 'center', justifyContent: 'center', marginTop: 14, zIndex: 1 },
  rail: { position: 'absolute', left: 14, top: 46, width: 4, bottom: -12, borderRadius: 2 },
});
