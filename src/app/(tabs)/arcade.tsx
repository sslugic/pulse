import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BreatheGame, BubbleGame, FidgetGame, GameShell, MemoryGame, ShredderGame, SprayGame } from '@/components/arcade-games';
import { ChallengeShell, Stars } from '@/components/brain-games';
import { ChestArt, ChestOpener } from '@/components/chest';
import { Icon, IconBadge } from '@/components/icon';
import { TokenCoin, TokenCount } from '@/components/quests-card';
import { Bar, Card, SectionTitle, T } from '@/components/ui';
import { ArcadeButton, Backdrop, Comic } from '@/components/underground';
import { C, Gradients, MaxContentWidth, Space } from '@/constants/theme';
import { ARCADE_CLAIM, ARCADE_XP, FREEZE_PRICE, GAMES, MAX_FREEZES, SHOP, gameById, isUnlocked, type BrainId, type ChestTier, type ChillId, type GameDef, type GameId } from '@/lib/arcade';
import { CHEST_LOOK, PAID_WINS_PER_DAY, WIN_TOKENS, dailyChestId, stars, winsToday, type Chest } from '@/lib/brain';
import { locale, t } from '@/lib/i18n';
import { tokenBalance } from '@/lib/quests';
import { actions, getState, useStore } from '@/lib/store';
import { useTodayKey } from '@/lib/use-today';
import { dayWellbeing, LEVEL_COLOR, LEVEL_LABEL } from '@/lib/wellbeing';

const TIER_LABEL: Record<ChestTier, string> = { wood: t('arcade.tierWood'), silver: t('arcade.tierSilver'), gold: t('arcade.tierGold') };

const PLAY: Record<ChillId, () => React.JSX.Element> = { breathe: BreatheGame, fidget: FidgetGame, bubbles: BubbleGame, shredder: ShredderGame, memory: MemoryGame, spray: SprayGame };

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
  const [opening, setOpening] = useState<Chest | null>(null);
  const wins = winsToday(game.claims, todayKey);
  const w = useMemo(() => dayWellbeing(entries, todayKey), [entries, todayKey]);
  const earnedToday = game.claims.some((c) => c.day === todayKey && c.questId === ARCADE_CLAIM);
  const onFinish = useCallback(() => actions.finishGame(todayKey), [todayKey]);

  const current = playing ? gameById(playing) : undefined;
  const Game = current && current.kind === 'chill' ? PLAY[current.id as ChillId] : null;

  const high = w.level === 'high' || w.level === 'very high';

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Backdrop />
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + Space.sm, paddingBottom: Space.xl * 3 }]}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <T size={13} color={C.textDim} weight="600">
              {t('arcade.oneMinuteResets')}
            </T>
            <Comic size={38}>{t('arcade.title')}</Comic>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 4, paddingTop: 6 }}>
            <TokenCount value={balance} size={16} />
            {!!game.doubler && (
              <T size={11} rounded color={C.orange}>
                {t('arcade.doublerWins', { count: game.doubler })}
              </T>
            )}
          </View>
        </View>

        <Treasure
          chests={game.chests ?? []}
          day={todayKey}
          played={game.playedDay === todayKey || earnedToday}
          dailyTaken={game.claims.some((c) => c.questId === dailyChestId(todayKey))}
          onOpen={setOpening}
        />

        <Card style={{ gap: 6 }} accent={w.level ? LEVEL_COLOR[w.level] + 'AA' : undefined}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ flex: 1, gap: 2 }}>
              <T size={12} rounded color={w.level ? LEVEL_COLOR[w.level] : C.textDim}>
                {w.stress != null ? t('arcade.stressScore', { score: w.stress, level: w.level ? LEVEL_LABEL[w.level].toLocaleUpperCase(locale) : '' }) : t('arcade.noStressScore')}
              </T>
              <T size={13} color={C.textDim} style={{ lineHeight: 18 }}>
                {high
                  ? t('arcade.stressHigh')
                  : w.stress != null
                    ? t('arcade.stressPlay')
                    : t('arcade.stressNone')}
              </T>
            </View>
          </View>
          <T size={11} color={earnedToday ? C.lime : C.textMute} weight="700">
            {earnedToday ? t('arcade.chillXpCollected') : t('arcade.chillXpTodo', { xp: ARCADE_XP })}
          </T>
        </Card>

        <SectionTitle
          right={
            <T size={12} rounded color={wins >= PAID_WINS_PER_DAY ? C.textMute : C.lime}>
              {t('arcade.paidWins', { wins: Math.min(wins, PAID_WINS_PER_DAY), max: PAID_WINS_PER_DAY })}
            </T>
          }>
          {t('arcade.brainGym')}
        </SectionTitle>
        <T size={13} color={C.textDim} style={{ lineHeight: 18, marginTop: -4 }}>
          {t('arcade.brainGymIntro', { tokens: WIN_TOKENS })}
        </T>
        {sortedGames
          .filter((g) => g.kind === 'brain')
          .map((g) => (
            <Cabinet
              key={g.id}
              g={g}
              open={isUnlocked(g.id, game.unlocked)}
              balance={balance}
              short={short === g.id}
              suggested={false}
              best={game.bests?.[g.id as BrainId]}
              onPlay={() => setPicked(g.id)}
              onUnlock={() => setShort(actions.unlockGame(g.id) ? null : g.id)}
            />
          ))}

        <SectionTitle>{t('arcade.chillZone')}</SectionTitle>
        <T size={13} color={C.textDim} style={{ lineHeight: 18, marginTop: -4 }}>
          {t('arcade.chillIntro')}
        </T>
        {sortedGames
          .filter((g) => g.kind === 'chill')
          .map((g) => (
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

        <SectionTitle>{t('arcade.powerUps')}</SectionTitle>
        <PowerUps balance={balance} freezes={game.freezes ?? 0} />
        <Shop balance={balance} onChest={setOpening} />

        <HowItWorks balance={balance} />

      </ScrollView>

      {/* Games run full screen, over the tab bar and the quick-log button. */}
      <Modal visible={!!current} animationType="slide" presentationStyle="fullScreen" onRequestClose={exit}>
        {current && (
          <View style={{ flex: 1, backgroundColor: C.bg }}>
            <Backdrop />
            <View style={[styles.play, { paddingTop: insets.top + Space.sm, paddingBottom: insets.bottom + Space.md }]}>
              {current.kind === 'brain' ? (
                <ChallengeShell key={current.id} game={current} day={todayKey} onExit={exit} />
              ) : (
                Game && (
                  <GameShell key={current.id} game={current} onExit={exit} onFinish={onFinish}>
                    <Game />
                  </GameShell>
                )
              )}
            </View>
          </View>
        )}
      </Modal>
      <ChestOpener chest={opening} day={todayKey} onClose={() => setOpening(null)} />
    </View>
  );
}

/** Unopened chests, plus today's free chest once any game is finished. */
function Treasure({ chests, day, played, dailyTaken, onOpen }: { chests: Chest[]; day: string; played: boolean; dailyTaken: boolean; onOpen: (c: Chest) => void }) {
  const dailyReady = played && !dailyTaken;
  return (
    <Card style={{ gap: 12 }} accent={chests.length || dailyReady ? C.yellow + 'CC' : undefined}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <T size={13} rounded color={C.text} style={{ flex: 1 }}>
          {chests.length ? t('arcade.yourChests', { count: chests.length }) : t('arcade.chests')}
        </T>
        <T size={11} rounded color={C.textMute}>
          {t('arcade.tapToOpen')}
        </T>
      </View>
      <View style={styles.chestRow}>
        {!dailyTaken && (
          <Pressable
            onPress={() => {
              if (!dailyReady || !actions.claimDailyChest(day)) return;
              const c = getState().game.chests?.at(-1);
              if (c) onOpen(c);
            }}
            style={[styles.chestSlot, !dailyReady && { opacity: 0.45 }]}
            accessibilityRole="button"
            accessibilityLabel={dailyReady ? t('arcade.openDailyChest') : t('arcade.dailyChestLocked')}>
            <ChestArt tier="wood" size={58} bounce={dailyReady} />
            <T size={10} rounded color={dailyReady ? C.yellow : C.textMute}>
              {dailyReady ? t('arcade.dailyReady') : t('arcade.daily')}
            </T>
          </Pressable>
        )}
        {chests.map((c) => (
          <Pressable key={c.id} onPress={() => onOpen(c)} style={styles.chestSlot} accessibilityRole="button" accessibilityLabel={t('arcade.openChestNamed', { name: CHEST_LOOK[c.tier].name.toLowerCase() })}>
            <ChestArt tier={c.tier} size={58} bounce />
            <T size={10} rounded color={CHEST_LOOK[c.tier].glow}>
              {TIER_LABEL[c.tier]}
            </T>
          </Pressable>
        ))}
      </View>
      <T size={12} color={C.textDim} style={{ lineHeight: 17 }}>
        {dailyReady
          ? t('arcade.dailyReadyText')
          : !dailyTaken
            ? t('arcade.dailyHint')
            : chests.length
              ? t('arcade.chestsHold')
              : t('arcade.dailyOpened')}
      </T>
    </Card>
  );
}

/** Chests and boosts bought with tokens. */
function Shop({ balance, onChest }: { balance: number; onChest: (c: Chest) => void }) {
  const items: { key: string; icon: React.ReactNode; title: string; text: string; price: number; color: string; buy: () => void }[] = [
    {
      key: 'doubler',
      icon: <T size={26}>⚡</T>,
      title: t('arcade.tokenDoubler'),
      text: t('arcade.doublerText', { wins: SHOP.doubler.wins }),
      price: SHOP.doubler.price,
      color: C.orange,
      buy: () => actions.buyDoubler(),
    },
    ...(['silver', 'gold'] as const).map((tier) => ({
      key: tier,
      icon: <ChestArt tier={tier} size={42} />,
      title: CHEST_LOOK[tier].name,
      text: tier === 'gold' ? t('arcade.goldChestText') : t('arcade.silverChestText'),
      price: tier === 'gold' ? SHOP.chestGold.price : SHOP.chestSilver.price,
      color: CHEST_LOOK[tier].glow,
      buy: () => {
        const id = actions.buyChest(tier);
        if (id) onChest({ id, tier, from: 'shop', at: Date.now() });
      },
    })),
  ];
  return (
    <View style={{ gap: Space.sm }}>
      {items.map((it) => (
        <Card key={it.key} style={{ gap: 10 }} accent={it.color + '88'}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={styles.shopIcon}>{it.icon}</View>
            <View style={{ flex: 1, gap: 2 }}>
              <Comic size={19}>{it.title}</Comic>
              <T size={12} color={C.textDim} style={{ lineHeight: 17 }}>
                {it.text}
              </T>
            </View>
          </View>
          <ArcadeButton label={t('arcade.buy', { price: it.price })} size="md" disabled={balance < it.price} icon={<TokenCoin size={20} />} onPress={it.buy} />
        </Card>
      ))}
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
          <Comic size={20}>{t('arcade.streakFreeze')}</Comic>
          <T size={12} color={C.textDim} style={{ lineHeight: 17 }}>
            {t('arcade.freezeText', { max: MAX_FREEZES })}
          </T>
        </View>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <T size={13} rounded color={C.cyan} style={{ flex: 1 }}>
          {t('arcade.owned', { n: freezes, max: MAX_FREEZES })}
        </T>
        <ArcadeButton
          label={full ? t('arcade.full') : t('arcade.buy', { price: FREEZE_PRICE })}
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
          {t('arcade.needTokens', { n: FREEZE_PRICE - balance })}
        </T>
      )}
    </Card>
  );
}

/** Plain-language explainer: tokens come from HQ quests, and each game is bought once. */
function HowItWorks({ balance }: { balance: number }) {
  const steps = [
    { n: '1', text: t('arcade.howStep1') },
    { n: '2', text: t('arcade.howStep2', { tokens: WIN_TOKENS, wins: PAID_WINS_PER_DAY }) },
    { n: '3', text: t('arcade.howStep3') },
    { n: '4', text: t('arcade.howStep4') },
  ];
  return (
    <Card style={{ gap: 10, marginTop: Space.sm }} accent={C.yellow + '99'}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <T size={13} rounded color={C.text} style={{ flex: 1 }}>
          {t('arcade.howTitle')}
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
          {t('arcade.goToQuests')}
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
  best,
  onPlay,
  onUnlock,
}: {
  g: GameDef;
  open: boolean;
  balance: number;
  short: boolean;
  suggested: boolean;
  best?: number;
  onPlay: () => void;
  onUnlock: () => void;
}) {
  const brain = g.kind === 'brain';
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
                  {t('arcade.tryThis')}
                </T>
              </View>
            )}
          </View>
          <T size={13} color={C.textDim} style={{ lineHeight: 18 }}>
            {g.blurb}
          </T>
        </View>
      </View>
      {open && brain && (
        <View style={styles.brainMeta}>
          <Stars n={best ? stars(g, best) : 0} size={16} />
          <T size={12} rounded color={C.textDim} style={{ flex: 1 }}>
            {best ? t('arcade.bestScore', { score: best, unit: g.unit ?? '' }) : t('arcade.noRunsYet')}
          </T>
          <T size={12} rounded color={C.lime}>
            {t('arcade.winAt', { n: g.win ?? 0 })}
          </T>
        </View>
      )}
      {open ? (
        <ArcadeButton label={brain ? t('arcade.play') : t('arcade.play1Min')} size="md" colors={Gradients.brand} textColor="#fff" onPress={onPlay} />
      ) : (
        <View style={{ gap: 8 }}>
          {balance >= g.price ? (
            <ArcadeButton label={t('arcade.unlockFor', { price: g.price })} size="md" onPress={onUnlock} icon={<TokenCoin size={22} />} />
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
                {short ? `${t('arcade.notEnoughTokens')} ` : ''}
                {t('arcade.moreToUnlock', { n: g.price - balance, count: Math.max(1, Math.ceil((g.price - balance) / 10)) })}
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
  chestRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  chestSlot: { alignItems: 'center', gap: 4 },
  shopIcon: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  brainMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  step: { width: 22, height: 22, borderRadius: 11, backgroundColor: C.yellow, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  cta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 9, borderRadius: 8, borderWidth: 2, borderColor: C.yellow + '88', backgroundColor: '#2A2410' },
});
