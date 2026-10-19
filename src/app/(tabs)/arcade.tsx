import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BreatheGame, BubbleGame, FidgetGame, GameShell, MemoryGame, ShredderGame, SprayGame } from '@/components/arcade-games';
import { Icon, IconBadge } from '@/components/icon';
import { TokenCoin, TokenCount } from '@/components/quests-card';
import { Bar, Card, T } from '@/components/ui';
import { ArcadeButton, Backdrop, Comic } from '@/components/underground';
import { C, Gradients, MaxContentWidth, Space } from '@/constants/theme';
import { ARCADE_CLAIM, ARCADE_XP, FREEZE_PRICE, GAMES, MAX_FREEZES, gameById, isUnlocked, type GameDef, type GameId } from '@/lib/arcade';
import { tokenBalance } from '@/lib/quests';
import { actions, useStore } from '@/lib/store';
import { useTodayKey } from '@/lib/use-today';
import { dayWellbeing, LEVEL_COLOR } from '@/lib/wellbeing';

const PLAY = { breathe: BreatheGame, fidget: FidgetGame, bubbles: BubbleGame, shredder: ShredderGame, memory: MemoryGame, spray: SprayGame } as const;

export default function ArcadeScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ play?: string }>();
  const entries = useStore((s) => s.entries);
  const game = useStore((s) => s.game);
  const todayKey = useTodayKey();
  const [picked, setPicked] = useState<GameId | null>(null);
  // Deep links like /arcade?play=breathe open a game straight away, but only one the player owns.
  const linked = params.play && gameById(params.play) && isUnlocked(params.play as GameId, game.unlocked) ? (params.play as GameId) : null;
  const playing = picked ?? linked;
  const exit = () => {
    setPicked(null);
    if (linked) router.setParams({ play: undefined });
  };
  const [short, setShort] = useState<GameId | null>(null);

  const balance = useMemo(() => tokenBalance(game), [game]);
  // Games you own come first; locked ones follow, cheapest first.
  const sortedGames = useMemo(
    () => [...GAMES].sort((a, b) => Number(!isUnlocked(a.id, game.unlocked)) - Number(!isUnlocked(b.id, game.unlocked)) || a.price - b.price),
    [game.unlocked],
  );
  const w = useMemo(() => dayWellbeing(entries, todayKey), [entries, todayKey]);
  const earnedToday = game.claims.some((c) => c.day === todayKey && c.questId === ARCADE_CLAIM);
  const onFinish = useCallback(() => actions.finishGame(todayKey), [todayKey]);

  const current = playing ? gameById(playing) : undefined;
  const Game = current ? PLAY[current.id] : null;

  const high = w.level === 'high' || w.level === 'very high';

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Backdrop />
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + Space.sm, paddingBottom: Space.xl * 3 }]}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <T size={13} color={C.textDim} weight="600">
              One-minute resets
            </T>
            <Comic size={38}>STRESS ARCADE</Comic>
          </View>
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
          </View>
          <T size={11} color={earnedToday ? C.lime : C.textMute} weight="700">
            {earnedToday ? 'TODAY’S ARCADE XP COLLECTED' : `FINISH A FULL MINUTE FOR +${ARCADE_XP} XP TODAY`}
          </T>
        </Card>

        {sortedGames.map((g) => (
          <Cabinet
            key={g.id}
            g={g}
            open={isUnlocked(g.id, game.unlocked)}
            balance={balance}
            short={short === g.id}
            suggested={high && g.id === 'breathe'}
            onPlay={() => setPicked(g.id)}
            onUnlock={() => setShort(actions.unlockGame(g.id) ? null : g.id)}
          />
        ))}

        <PowerUps balance={balance} freezes={game.freezes ?? 0} />

        <HowItWorks balance={balance} />

      </ScrollView>

      {/* Games run full screen, over the tab bar and the quick-log button. */}
      <Modal visible={!!current} animationType="slide" presentationStyle="fullScreen" onRequestClose={exit}>
        {current && Game && (
          <View style={{ flex: 1, backgroundColor: C.bg }}>
            <Backdrop />
            <View style={[styles.play, { paddingTop: insets.top + Space.sm, paddingBottom: insets.bottom + Space.md }]}>
              <GameShell key={current.id} game={current} onExit={exit} onFinish={onFinish}>
                <Game />
              </GameShell>
            </View>
          </View>
        )}
      </Modal>
    </View>
  );
}

/** Token shop for things that aren't games: right now, streak freezes. */
function PowerUps({ balance, freezes }: { balance: number; freezes: number }) {
  const full = freezes >= MAX_FREEZES;
  const afford = balance >= FREEZE_PRICE;
  return (
    <Card style={{ gap: 10, marginTop: Space.sm }} accent={C.cyan + '99'}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={styles.freezeIcon}>
          <T size={26}>🧊</T>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Comic size={20}>STREAK FREEZE</Comic>
          <T size={12} color={C.textDim} style={{ lineHeight: 17 }}>
            Miss a day and a freeze is used automatically so your streak survives. Hold up to {MAX_FREEZES}.
          </T>
        </View>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <T size={13} rounded color={C.cyan} style={{ flex: 1 }}>
          OWNED {freezes}/{MAX_FREEZES}
        </T>
        <ArcadeButton
          label={full ? 'FULL' : `BUY · ${FREEZE_PRICE}`}
          size="md"
          disabled={full || !afford}
          colors={['#5FE2FF', '#1E8FE0']}
          textColor="#fff"
          icon={full ? undefined : <TokenCoin size={20} />}
          onPress={() => actions.buyFreeze()}
          style={{ minWidth: 150 }}
        />
      </View>
      {!full && !afford && (
        <T size={11} color={C.textMute} weight="700">
          NEED {FREEZE_PRICE - balance} MORE TOKENS
        </T>
      )}
    </Card>
  );
}

/** Plain-language explainer: tokens come from HQ quests, and each game is bought once. */
function HowItWorks({ balance }: { balance: number }) {
  const steps = [
    { n: '1', text: 'Clear daily quests on HQ. Each pays tokens: easy +5, medium +10, hard +20.' },
    { n: '2', text: 'Clear all 3 in a day for a Perfect Day bonus: +15 more.' },
    { n: '3', text: 'Spend tokens here to unlock a game. You pay once and keep it forever.' },
  ];
  return (
    <Card style={{ gap: 10, marginTop: Space.sm }} accent={C.yellow + '99'}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <T size={13} rounded color={C.text} style={{ flex: 1 }}>
          HOW TO UNLOCK GAMES
        </T>
        <TokenCount value={balance} />
      </View>
      {steps.map((st) => (
        <View key={st.n} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
          <View style={styles.step}>
            <T size={12} rounded color={C.ink}>
              {st.n}
            </T>
          </View>
          <T size={13} color={C.textDim} style={{ flex: 1, lineHeight: 18 }}>
            {st.text}
          </T>
        </View>
      ))}
      <Pressable onPress={() => router.navigate('/')} style={styles.cta} accessibilityRole="button">
        <Icon name="target" size={14} color={C.yellow} />
        <T size={12} rounded color={C.yellow}>
          GO TO TODAY’S QUESTS
        </T>
        <Icon name="chevron" size={12} color={C.yellow} />
      </Pressable>
    </Card>
  );
}

function Cabinet({
  g,
  open,
  balance,
  short,
  suggested,
  onPlay,
  onUnlock,
}: {
  g: GameDef;
  open: boolean;
  balance: number;
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
        <View style={{ gap: 8 }}>
          {balance >= g.price ? (
            <ArcadeButton label={`UNLOCK FOR ${g.price}`} size="md" onPress={onUnlock} icon={<TokenCoin size={22} />} />
          ) : (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Icon name="lock" size={14} color={C.textMute} />
                <View style={{ flex: 1 }}>
                  <Bar value={balance} max={g.price} color={C.yellow} height={6} />
                </View>
                <T size={12} rounded color={C.yellow}>
                  {balance}/{g.price}
                </T>
                <TokenCoin size={14} />
              </View>
              <T size={12} color={C.textDim} style={{ lineHeight: 17 }}>
                {short ? 'Not enough tokens yet. ' : ''}
                {g.price - balance} more tokens to unlock. That’s about {Math.max(1, Math.ceil((g.price - balance) / 10))} medium quest
                {Math.ceil((g.price - balance) / 10) === 1 ? '' : 's'} on HQ.
              </T>
            </>
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
  freezeIcon: { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#12303A', borderWidth: 2, borderColor: C.cyan },
  step: { width: 22, height: 22, borderRadius: 11, backgroundColor: C.yellow, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  cta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 9, borderRadius: 8, borderWidth: 2, borderColor: C.yellow + '88', backgroundColor: '#2A2410' },
});
