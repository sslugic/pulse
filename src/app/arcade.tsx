import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BreatheGame, BubbleGame, GameShell, SprayGame } from '@/components/arcade-games';
import { GlassButton, IconBadge } from '@/components/icon';
import { TokenCoin, TokenCount } from '@/components/quests-card';
import { Card, T } from '@/components/ui';
import { ArcadeButton, Backdrop, Comic } from '@/components/underground';
import { C, Gradients, MaxContentWidth, Space } from '@/constants/theme';
import { ARCADE_CLAIM, ARCADE_XP, GAMES, gameById, isUnlocked, type GameDef, type GameId } from '@/lib/arcade';
import { tokenBalance } from '@/lib/quests';
import { actions, useStore } from '@/lib/store';
import { useTodayKey } from '@/lib/use-today';
import { dayWellbeing, LEVEL_COLOR } from '@/lib/wellbeing';

const PLAY = { breathe: BreatheGame, bubbles: BubbleGame, spray: SprayGame } as const;

export default function ArcadeScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ play?: string }>();
  const entries = useStore((s) => s.entries);
  const game = useStore((s) => s.game);
  const todayKey = useTodayKey();
  const [playing, setPlaying] = useState<GameId | null>(() => (params.play && gameById(params.play) ? (params.play as GameId) : null));
  const [short, setShort] = useState<GameId | null>(null);

  const balance = useMemo(() => tokenBalance(game), [game]);
  const w = useMemo(() => dayWellbeing(entries, todayKey), [entries, todayKey]);
  const earnedToday = game.claims.some((c) => c.day === todayKey && c.questId === ARCADE_CLAIM);
  const onFinish = useCallback(() => actions.finishGame(todayKey), [todayKey]);

  const current = playing ? gameById(playing) : undefined;
  if (current) {
    const Game = PLAY[current.id];
    return (
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <Backdrop />
        <View style={[styles.play, { paddingTop: insets.top + Space.sm, paddingBottom: insets.bottom + Space.md }]}>
          <GameShell game={current} onExit={() => setPlaying(null)} onFinish={onFinish}>
            <Game />
          </GameShell>
        </View>
      </View>
    );
  }

  const high = w.level === 'high' || w.level === 'very high';

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Backdrop />
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + Space.sm, paddingBottom: insets.bottom + 40 }]}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <T size={13} color={C.textDim} weight="600">
              One-minute resets
            </T>
            <Comic size={38}>STRESS ARCADE</Comic>
          </View>
          <GlassButton icon="close" onPress={() => router.back()} />
        </View>

        <Card style={{ gap: 6 }} accent={w.level ? LEVEL_COLOR[w.level] + 'AA' : undefined}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ flex: 1, gap: 2 }}>
              <T size={12} rounded color={w.level ? LEVEL_COLOR[w.level] : C.textDim}>
                {w.stress != null ? `STRESS ${w.stress} · ${w.level?.toUpperCase()}` : 'NO STRESS SCORE YET'}
              </T>
              <T size={13} color={C.textDim} style={{ lineHeight: 18 }}>
                {high
                  ? 'Your strain is running high today. A minute of slow breathing is the quickest way to bring it down.'
                  : w.stress != null
                    ? 'Play a minute whenever you need a break.'
                    : 'Tell the Coach how you slept and feel to get a stress score.'}
              </T>
            </View>
            <TokenCount value={balance} />
          </View>
          <T size={11} color={earnedToday ? C.lime : C.textMute} weight="700">
            {earnedToday ? 'TODAY’S ARCADE XP COLLECTED' : `FINISH A FULL MINUTE FOR +${ARCADE_XP} XP TODAY`}
          </T>
        </Card>

        {GAMES.map((g) => (
          <Cabinet
            key={g.id}
            g={g}
            open={isUnlocked(g.id, game.unlocked)}
            afford={balance >= g.price}
            short={short === g.id}
            suggested={high && g.id === 'breathe'}
            onPlay={() => setPlaying(g.id)}
            onUnlock={() => setShort(actions.unlockGame(g.id) ? null : g.id)}
          />
        ))}

        <T size={12} color={C.textMute} style={{ textAlign: 'center', marginTop: Space.sm }}>
          Earn tokens by clearing daily quests on HQ.
        </T>
      </ScrollView>
    </View>
  );
}

function Cabinet({
  g,
  open,
  afford,
  short,
  suggested,
  onPlay,
  onUnlock,
}: {
  g: GameDef;
  open: boolean;
  afford: boolean;
  short: boolean;
  suggested: boolean;
  onPlay: () => void;
  onUnlock: () => void;
}) {
  return (
    <Card style={{ gap: 12, marginTop: Space.sm }} accent={open ? g.color + '99' : undefined}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <IconBadge name={g.icon} color={open ? g.color : C.textMute} size={48} />
        <View style={{ flex: 1, gap: 3 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Comic size={24} color={open ? C.text : C.textDim}>
              {g.title}
            </Comic>
            {suggested && (
              <View style={[styles.tag, { backgroundColor: C.orange }]}>
                <T size={9} rounded color={C.ink}>
                  TRY THIS
                </T>
              </View>
            )}
          </View>
          <T size={13} color={C.textDim} style={{ lineHeight: 18 }}>
            {g.blurb}
          </T>
        </View>
      </View>
      {open ? (
        <ArcadeButton label="PLAY 1 MIN" size="md" colors={Gradients.brand} textColor="#fff" onPress={onPlay} />
      ) : (
        <View style={{ gap: 6 }}>
          <ArcadeButton
            label={`UNLOCK · ${g.price}`}
            size="md"
            disabled={!afford}
            onPress={onUnlock}
            icon={<TokenCoin size={22} />}
          />
          {(short || !afford) && (
            <T size={11} color={C.textMute} weight="700" style={{ textAlign: 'center' }}>
              NEED {g.price} TOKENS · CLEAR QUESTS TO EARN MORE
            </T>
          )}
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: Space.md, gap: Space.sm, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  play: { flex: 1, paddingHorizontal: Space.md, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: Space.sm },
  tag: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
});
