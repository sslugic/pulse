import * as AppleAuthentication from 'expo-apple-authentication';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Linking, Platform, Pressable, RefreshControl, ScrollView, Share, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChestArt, ChestOpener } from '@/components/chest';
import { GlassButton, Icon, type IconName } from '@/components/icon';
import { openPlayerActions, sendNudge } from '@/components/player-actions';
import { inputStyle } from '@/components/profile-form';
import { Avatar, challengeLength, challengeTitle, enterCode, squadFail } from '@/components/squad-bits';
import { shareCard } from '@/components/share-card';
import { Bar, Card, Chip, SectionTitle, T, tap } from '@/components/ui';
import { ArcadeButton, Backdrop, Comic, Sticker } from '@/components/underground';
import { C, MaxContentWidth, Space } from '@/constants/theme';
import type { ChestTier } from '@/lib/arcade';
import { appleSignInAvailable, cloudConfigured, devBackend, devSignIn } from '@/lib/cloud';
import { locale, t } from '@/lib/i18n';
import { LEGAL } from '@/lib/legal';
import { dayKey, streak } from '@/lib/nutrition';
import { questXp } from '@/lib/quests';
import { crewRank } from '@/lib/rank';
import {
  challengeChest,
  challengeClaimId,
  CHALLENGES,
  claimChallenge,
  claimLeague,
  colorOf,
  createCrew,
  daysLeftInWeek,
  declineChallenge,
  enablePush,
  friendLink,
  joinSquad,
  lastWeekPrize,
  markNudgesSeen,
  nameOf,
  needsNudge,
  outcome,
  refreshSquad,
  SQUAD_COLORS,
  syncStats,
  updateCard,
  useSquad,
  type BoardRow,
  type Challenge,
  type CrewView,
  type SquadColor,
} from '@/lib/social';
import { actions, useStore } from '@/lib/store';
import { useTodayKey } from '@/lib/use-today';

/** Squad: the weekly friends board, challenges, crews and nudges. */
export default function SquadScreen() {
  const insets = useSafeAreaInsets();
  const userId = useStore((s) => s.account.userId);
  const loaded = useSquad((s) => s.loaded);
  const me = useSquad((s) => s.me);
  const loading = useSquad((s) => s.loading);
  const error = useSquad((s) => s.error);

  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      syncStats()
        .catch(() => {})
        .finally(() => refreshSquad());
      // Nudges count as seen once the player has been here.
      return () => {
        markNudgesSeen();
      };
    }, [userId]),
  );

  const pull = () => {
    syncStats()
      .catch(() => {})
      .finally(() => refreshSquad());
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Backdrop tags={['SQUAD', 'PULSE']} />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + Space.md, paddingBottom: 140 }]}
        keyboardShouldPersistTaps="handled"
        refreshControl={me ? <RefreshControl refreshing={false} onRefresh={pull} tintColor={C.lime} /> : undefined}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <T size={13} color={C.textDim} weight="600">
              {t('squad.subtitle')}
            </T>
            <Comic size={40}>{t('squad.title')}</Comic>
          </View>
          {me && <ShareMine />}
        </View>

        {!cloudConfigured ? (
          <Card>
            <T size={13} color={C.textDim}>
              {t('account.notSetUp')}
            </T>
          </Card>
        ) : !userId ? (
          <SignInPitch />
        ) : !loaded ? (
          error ? <ErrorCard text={error} /> : <ActivityIndicator color={C.lime} style={{ marginTop: 40 }} />
        ) : !me ? (
          <JoinCard />
        ) : (
          <>
            {error && <ErrorCard text={error} />}
            <Nudges />
            <LeaguePrize />
            <WeeklyBoard />
            <InviteRow />
            <Challenges />
            <Crews />
            <MyCardSettings />
          </>
        )}
        {loading && loaded && <ActivityIndicator color={C.textMute} style={{ marginTop: 8 }} />}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function ErrorCard({ text }: { text: string }) {
  return (
    <Card accent={C.danger + '99'} style={{ gap: 10 }}>
      <T size={13} color={C.text}>
        {text}
      </T>
      <Chip label={t('squad.retry')} icon="retry" onPress={() => refreshSquad()} />
    </Card>
  );
}

// ---------- Before joining ----------

function SignInPitch() {
  const [apple, setApple] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    appleSignInAvailable().then(setApple);
  }, []);
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      squadFail(e);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card style={{ gap: 14 }} accent={C.cyan + '99'}>
      <Pitch />
      <T size={13} color={C.textDim} style={{ lineHeight: 18 }}>
        {t('squad.signInPitch')}
      </T>
      {busy ? (
        <ActivityIndicator color={C.text} />
      ) : apple ? (
        <AppleAuthentication.AppleAuthenticationButton
          buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
          buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
          cornerRadius={10}
          style={{ height: 48 }}
          onPress={() => run(() => actions.signInWithApple())}
        />
      ) : (
        <T size={12} color={C.textMute}>
          {t('account.appleUnavailable')}
        </T>
      )}
      {__DEV__ && devBackend && (
        <Pressable onPress={() => run(() => devSignIn())}>
          <T size={12} rounded color={C.orange}>
            DEV: SIGN IN WITH TEST ACCOUNT
          </T>
        </Pressable>
      )}
    </Card>
  );
}

function Pitch() {
  const lines: [IconName, string, string][] = [
    ['trophy', C.yellow, t('squad.pitchBoard')],
    ['target', C.pink, t('squad.pitchChallenges')],
    ['people', C.cyan, t('squad.pitchCrews')],
    ['wave', C.orange, t('squad.pitchNudges')],
  ];
  return (
    <View style={{ gap: 10 }}>
      {lines.map(([icon, color, text]) => (
        <View key={icon} style={styles.row}>
          <Icon name={icon} size={20} color={color} />
          <T size={14} color={C.text} style={{ flex: 1 }}>
            {text}
          </T>
        </View>
      ))}
    </View>
  );
}

function JoinCard() {
  const profileName = useStore((s) => s.profile.name);
  const [name, setName] = useState(profileName.split(' ')[0] ?? '');
  const [color, setColor] = useState<SquadColor>('orange');
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);

  const join = async () => {
    setBusy(true);
    try {
      await joinSquad(name, color);
      enablePush().catch(() => {});
    } catch (e) {
      squadFail(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card style={{ gap: 14 }} accent={C.lime + '99'}>
      <Pitch />
      <View style={{ gap: 6 }}>
        <T size={12} rounded color={C.textDim}>
          {t('squad.yourName')}
        </T>
        <TextInput value={name} onChangeText={setName} maxLength={24} placeholder={t('squad.namePlaceholder')} placeholderTextColor={C.textMute} style={inputStyle} autoCorrect={false} />
        <T size={11} color={C.textMute}>
          {t('squad.nameNote')}
        </T>
      </View>
      <ColorPicker value={color} onChange={setColor} />
      <View style={styles.rules}>
        <T size={13} rounded color={C.yellow}>
          {t('squad.rulesTitle')}
        </T>
        {[t('squad.rule1'), t('squad.rule2'), t('squad.rule3'), t('squad.rule4')].map((r, i) => (
          <T key={i} size={12} color={C.text} style={{ lineHeight: 17 }}>
            • {r}
          </T>
        ))}
        <Pressable hitSlop={6} onPress={() => Linking.openURL(LEGAL.terms)}>
          <T size={12} rounded color={C.cyan}>
            {t('squad.readTerms')}
          </T>
        </Pressable>
      </View>
      <Pressable onPress={() => (tap(), setAgree((a) => !a))} style={styles.row} accessibilityRole="checkbox" accessibilityState={{ checked: agree }}>
        <View style={[styles.check, agree && { backgroundColor: C.lime }]}>{agree && <Icon name="check" size={14} color={C.ink} weight="bold" />}</View>
        <T size={13} color={C.text} style={{ flex: 1 }}>
          {t('squad.agree')}
        </T>
      </Pressable>
      {busy ? <ActivityIndicator color={C.lime} /> : <ArcadeButton label={t('squad.join')} size="md" disabled={!agree || !name.trim()} onPress={join} colors={[C.lime, '#5BE01E']} textColor="#fff" />}
    </Card>
  );
}

function ColorPicker({ value, onChange }: { value: SquadColor; onChange: (c: SquadColor) => void }) {
  return (
    <View style={{ gap: 6 }}>
      <T size={12} rounded color={C.textDim}>
        {t('squad.yourColor')}
      </T>
      <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
        {SQUAD_COLORS.map((c) => (
          <Pressable
            key={c}
            onPress={() => (tap(), onChange(c))}
            accessibilityLabel={c}
            accessibilityState={{ selected: value === c }}
            style={[styles.swatch, { backgroundColor: colorOf(c) }, value === c && { borderColor: C.text, transform: [{ scale: 1.12 }] }]}
          />
        ))}
      </View>
    </View>
  );
}

// ---------- Header share ----------

function ShareMine() {
  const entries = useStore((s) => s.entries);
  const game = useStore((s) => s.game);
  const me = useSquad((s) => s.me);
  const share = () => {
    const rank = crewRank(entries, questXp(game.claims), game.frozenDays);
    shareCard({ kind: 'streak', days: streak(entries, game.frozenDays), name: me?.name ?? '', rank: rank.rank });
  };
  return <GlassButton icon="share" onPress={share} />;
}

// ---------- Nudges ----------

function Nudges() {
  const all = useSquad((s) => s.nudges);
  const nudges = useMemo(() => all.filter((n) => !n.seen), [all]);
  if (!nudges.length) return null;
  const names = [...new Set(nudges.map((n) => n.senderName))];
  return (
    <Card accent={C.orange + 'AA'} style={{ gap: 6 }}>
      <View style={styles.row}>
        <Icon name="wave" size={22} color={C.orange} />
        <T size={15} rounded color={C.text} style={{ flex: 1 }}>
          {names.length === 1 ? t('squad.nudgedBy', { name: names[0] }) : t('squad.nudgedByMany', { name: names[0], count: names.length - 1 })}
        </T>
      </View>
      <T size={12} color={C.textDim}>
        {t('squad.nudgedHint')}
      </T>
    </Card>
  );
}

// ---------- Last week's prize ----------

function LeaguePrize() {
  const lastWeek = useSquad((s) => s.lastWeek);
  const claims = useStore((s) => s.game.claims);
  // lastWeekPrize reads both; they're listed so it recomputes when either changes.
  const prize = useMemo(() => lastWeekPrize(), [lastWeek, claims]); // eslint-disable-line react-hooks/exhaustive-deps
  const [chest, setChest] = useState<{ id: string; tier: ChestTier } | null>(null);
  if (!prize || (prize.claimed && !chest)) return <ChestOpener chest={chest} day={dayKey(new Date())} onClose={() => setChest(null)} />;
  return (
    <>
      <Card accent={C.yellow + 'CC'} style={{ gap: 12 }}>
        <View style={styles.row}>
          <ChestArt tier={prize.tier} size={56} bounce />
          <View style={{ flex: 1 }}>
            <Comic size={22} color={C.yellow}>
              {t('squad.lastWeekPlace', { place: prize.place })}
            </Comic>
            <T size={12} color={C.textDim}>
              {t('squad.lastWeekPrize')}
            </T>
          </View>
        </View>
        <ArcadeButton
          label={t('squad.claimChest')}
          size="md"
          onPress={() => {
            const id = claimLeague();
            if (id) setChest({ id, tier: prize.tier });
          }}
        />
      </Card>
      <ChestOpener chest={chest} day={dayKey(new Date())} onClose={() => setChest(null)} />
    </>
  );
}

// ---------- Weekly board ----------

function WeeklyBoard() {
  const board = useSquad((s) => s.board);
  const nudged = useSquad((s) => s.nudgedToday);
  const left = daysLeftInWeek();
  return (
    <>
      <SectionTitle
        right={
          <T size={11} rounded color={C.textMute}>
            {t('squad.resetsIn', { count: left })}
          </T>
        }>
        {t('squad.thisWeek')}
      </SectionTitle>
      <Card style={{ gap: 4, paddingVertical: 8 }}>
        {board.map((r, i) => (
          <BoardLine key={r.userId} row={r} place={i + 1} nudged={nudged.has(r.userId)} />
        ))}
        {board.length < 2 && (
          <View style={{ paddingVertical: 10, gap: 6 }}>
            <T size={13} color={C.textDim} style={{ lineHeight: 18 }}>
              {t('squad.emptyBoard')}
            </T>
          </View>
        )}
        <T size={11} color={C.textMute} style={{ marginTop: 6 }}>
          {t('squad.boardNote')}
        </T>
      </Card>
    </>
  );
}

const PLACE_COLORS = ['#E8B830', C.steelHi, C.rust];

function BoardLine({ row, place, nudged }: { row: BoardRow; place: number; nudged: boolean }) {
  const canNudge = !row.me && needsNudge(row) && !nudged;
  return (
    <Pressable
      disabled={row.me}
      onPress={() => openPlayerActions({ userId: row.userId, name: row.name, lastDay: row.lastDay })}
      style={({ pressed }) => [styles.line, row.me && styles.meLine, pressed && { opacity: 0.7 }]}>
      <T size={16} rounded color={PLACE_COLORS[place - 1] ?? C.textMute} style={{ width: 26, textAlign: 'center' }}>
        {place}
      </T>
      <Avatar name={row.name} color={row.color} />
      <View style={{ flex: 1 }}>
        <T size={14} rounded color={C.text} numberOfLines={1}>
          {row.me ? t('squad.you', { name: row.name }) : row.name}
        </T>
        <T size={11} color={C.textDim}>
          {t('squad.levelStreak', { level: row.level, streak: row.streak })}
        </T>
      </View>
      {canNudge && (
        <Pressable onPress={() => sendNudge(row.userId, row.name)} hitSlop={6} style={styles.nudgeBtn} accessibilityLabel={t('squad.nudgeA11y', { name: row.name })}>
          <Icon name="wave" size={14} color={C.ink} />
        </Pressable>
      )}
      <T size={16} rounded color={C.lime}>
        {row.weeklyXp.toLocaleString(locale)}
      </T>
      <T size={10} rounded color={C.textMute}>
        XP
      </T>
    </Pressable>
  );
}

// ---------- Inviting ----------

function InviteRow() {
  const me = useSquad((s) => s.me);
  const invite = () => {
    tap();
    if (me) Share.share({ message: t('squad.inviteMessage', { link: friendLink(me.inviteCode), code: me.inviteCode }) });
  };
  return (
    <View style={styles.inviteRow}>
      <ArcadeButton label={t('squad.inviteFriends')} size="md" onPress={invite} style={{ flex: 1 }} icon={<Icon name="link" size={18} color="#FF7A1A" />} />
      <Pressable onPress={enterCode} style={styles.codeBtn} accessibilityRole="button">
        <T size={12} rounded color={C.text} style={{ textAlign: 'center' }}>
          {t('squad.enterCode')}
        </T>
      </Pressable>
    </View>
  );
}

// ---------- Challenges ----------

function Challenges() {
  const all = useSquad((s) => s.challenges);
  const claims = useStore((s) => s.game.claims);
  const todayKey = useTodayKey();
  const [chest, setChest] = useState<{ id: string; tier: ChestTier } | null>(null);
  const recent = useMemo(() => {
    const d = new Date(todayKey + 'T12:00');
    d.setDate(d.getDate() - 3);
    return dayKey(d);
  }, [todayKey]);
  // Running ones, plus finished ones with an unclaimed chest or from the last few days.
  const shown = all.filter((c) => {
    const o = outcome(c);
    if (o === 'running') return true;
    if (o === 'off') return false;
    const claimable = !!challengeChest(o, c.hard) && !claims.some((x) => x.questId === challengeClaimId(c.id));
    return claimable || c.ends >= recent;
  });
  return (
    <>
      <SectionTitle
        right={
          <Pressable onPress={() => router.push('/challenge-new')} hitSlop={6}>
            <T size={12} rounded color={C.cyan}>
              {t('squad.newChallenge')}
            </T>
          </Pressable>
        }>
        {t('squad.challenges')}
      </SectionTitle>
      {shown.length ? (
        shown.map((c) => <ChallengeCard key={c.id} c={c} claimed={claims.some((x) => x.questId === challengeClaimId(c.id))} onChest={setChest} />)
      ) : (
        <Card onPress={() => router.push('/challenge-new')} style={{ gap: 6 }}>
          <T size={14} rounded color={C.text}>
            {t('squad.noChallenges')}
          </T>
          <T size={12} color={C.textDim}>
            {t('squad.noChallengesHint')}
          </T>
        </Card>
      )}
      <ChestOpener chest={chest} day={dayKey(new Date())} onClose={() => setChest(null)} />
    </>
  );
}

function ChallengeCard({ c, claimed, onChest }: { c: Challenge; claimed: boolean; onChest: (x: { id: string; tier: ChestTier }) => void }) {
  const uid = useStore((s) => s.account.userId) ?? '';
  const meName = useSquad((s) => s.me?.name ?? '');
  const def = CHALLENGES[c.template];
  const o = outcome(c, uid);
  const other = c.opponent ? (c.createdBy === uid ? c.opponent : c.createdBy) : null;
  const tier = challengeChest(o, c.hard);
  const today = dayKey(new Date());
  const daysLeft = Math.max(0, Math.round((new Date(c.ends + 'T12:00').getTime() - new Date(today + 'T12:00').getTime()) / 864e5) + 1);
  const title = challengeTitle(c.template, c.target, challengeLength(c));

  const menu = () => {
    if (o !== 'running') return;
    Alert.alert(title, undefined, [
      { text: t('squad.cancel'), style: 'cancel' },
      { text: c.opponent ? t('squad.callOff') : t('squad.drop'), style: 'destructive', onPress: () => declineChallenge(c.id).catch(squadFail) },
    ]);
  };

  return (
    <Card accent={def.color + '88'} style={{ gap: 10 }} onPress={menu}>
      <View style={styles.row}>
        <Icon name={def.icon} size={20} color={def.color} />
        <T size={14} rounded color={C.text} style={{ flex: 1 }}>
          {title}
        </T>
        {c.hard && <Sticker text={t('squad.hard')} color={C.danger} rotate={4} size={11} />}
        <OutcomeBadge o={o} daysLeft={daysLeft} />
      </View>
      <ProgressLine label={t('squad.youShort')} value={c.progress[uid]?.progress ?? 0} target={c.target} color={def.color} />
      {other && <ProgressLine label={nameOf(other)} value={c.progress[other]?.progress ?? 0} target={c.target} color={C.steelHi} />}
      {tier && !claimed && (
        <ArcadeButton
          label={t('squad.claimChest')}
          size="md"
          onPress={() => {
            const id = claimChallenge(c);
            if (id) onChest({ id, tier });
          }}
        />
      )}
      {o === 'won' && (
        <Chip label={t('squad.shareWin')} icon="share" onPress={() => shareCard({ kind: 'challenge', title, vs: other ? nameOf(other) : undefined, name: meName })} />
      )}
    </Card>
  );
}

function OutcomeBadge({ o, daysLeft }: { o: ReturnType<typeof outcome>; daysLeft: number }) {
  const map: Record<string, [string, string]> = {
    running: [t('squad.daysLeft', { count: daysLeft }), C.textDim],
    won: [t('squad.won'), C.lime],
    lost: [t('squad.lost'), C.danger],
    tied: [t('squad.tied'), C.yellow],
    done: [t('squad.done'), C.lime],
    missed: [t('squad.missed'), C.textMute],
  };
  const [label, color] = map[o] ?? ['', C.textMute];
  return o === 'running' ? (
    <T size={11} rounded color={color}>
      {label}
    </T>
  ) : (
    <Sticker text={label} color={color} rotate={-4} size={13} />
  );
}

function ProgressLine({ label, value, target, color }: { label: string; value: number; target: number; color: string }) {
  return (
    <View style={{ gap: 4 }}>
      <View style={styles.between}>
        <T size={12} rounded color={C.textDim} numberOfLines={1} style={{ flex: 1 }}>
          {label}
        </T>
        <T size={12} rounded color={C.text}>
          {value}/{target}
        </T>
      </View>
      <Bar value={value} max={target} color={color} />
    </View>
  );
}

// ---------- Crews ----------

function Crews() {
  const crews = useSquad((s) => s.crews);
  const start = () => {
    tap();
    Alert.prompt(t('squad.newCrewTitle'), t('squad.newCrewBody'), async (name) => {
      if (!name?.trim()) return;
      try {
        const id = await createCrew(name);
        router.push({ pathname: '/crew/[id]', params: { id } });
      } catch (e) {
        squadFail(e);
      }
    });
  };
  return (
    <>
      <SectionTitle
        right={
          crews.length < 3 ? (
            <Pressable onPress={start} hitSlop={6}>
              <T size={12} rounded color={C.cyan}>
                {t('squad.startCrew')}
              </T>
            </Pressable>
          ) : undefined
        }>
        {t('squad.crews')}
      </SectionTitle>
      {crews.length ? (
        crews.map((c) => <CrewCard key={c.id} crew={c} />)
      ) : (
        <Card onPress={start} style={{ gap: 6 }}>
          <T size={14} rounded color={C.text}>
            {t('squad.noCrews')}
          </T>
          <T size={12} color={C.textDim}>
            {t('squad.noCrewsHint')}
          </T>
        </Card>
      )}
    </>
  );
}

function CrewCard({ crew }: { crew: CrewView }) {
  const done = crew.members.filter((m) => m.loggedToday).length;
  return (
    <Card accent={C.cyan + '88'} style={{ gap: 10 }} onPress={() => router.push({ pathname: '/crew/[id]', params: { id: crew.id } })}>
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Comic size={22} color={C.text}>
            {crew.name.toUpperCase()}
          </Comic>
          <T size={12} color={C.textDim}>
            {t('squad.crewToday', { done, count: crew.members.length })}
          </T>
        </View>
        <View style={{ alignItems: 'center' }}>
          <View style={styles.row}>
            <Icon name="flame" size={18} color={crew.streak ? C.orange : C.textMute} />
            <Comic size={26} color={crew.streak ? C.yellow : C.textMute}>
              {crew.streak}
            </Comic>
          </View>
          <T size={10} rounded color={C.textMute}>
            {t('squad.crewStreak')}
          </T>
        </View>
        <Icon name="chevron" size={14} color={C.textMute} />
      </View>
      <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
        {crew.members.map((m) => (
          <View key={m.userId} style={{ opacity: m.loggedToday ? 1 : 0.35 }}>
            <Avatar name={m.name} color={m.color} size={28} dim={m.hidden} />
          </View>
        ))}
      </View>
    </Card>
  );
}

// ---------- My card, blocked players ----------

function MyCardSettings() {
  const me = useSquad((s) => s.me);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(me?.name ?? '');
  const [color, setColor] = useState<SquadColor>((me?.color as SquadColor) ?? 'orange');
  if (!me) return null;

  const save = async () => {
    try {
      await updateCard(name, color);
      setEditing(false);
    } catch (e) {
      squadFail(e);
    }
  };

  return (
    <>
      <SectionTitle>{t('squad.myCard')}</SectionTitle>
      <Card style={{ gap: 12 }}>
        {editing ? (
          <>
            <TextInput value={name} onChangeText={setName} maxLength={24} style={inputStyle} autoCorrect={false} />
            <ColorPicker value={color} onChange={setColor} />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Chip label={t('squad.save')} active onPress={save} />
              <Chip label={t('squad.cancel')} onPress={() => setEditing(false)} />
            </View>
          </>
        ) : (
          <Pressable onPress={() => (tap(), setName(me.name), setEditing(true))} style={styles.row}>
            <Avatar name={me.name} color={me.color} />
            <View style={{ flex: 1 }}>
              <T size={14} rounded color={C.text}>
                {me.name}
              </T>
              <T size={11} color={C.textDim}>
                {t('squad.inviteCode', { code: me.inviteCode })}
              </T>
            </View>
            <Icon name="pencil" size={16} color={C.textMute} />
          </Pressable>
        )}
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          <Chip label={t('squad.blockedPlayers')} onPress={() => router.push('/blocked')} />
          <Chip label={t('squad.notifications')} icon="wave" onPress={() => enablePush().then((ok) => !ok && Alert.alert(t('crew.notificationsOffTitle'), t('squad.notificationsOff')))} />
        </View>
        <T size={11} color={C.textMute} style={{ lineHeight: 16 }}>
          {t('squad.privacyNote')}
        </T>
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: Space.md, gap: Space.sm, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  rules: { gap: 6, padding: 12, borderRadius: 12, backgroundColor: '#00000055', borderWidth: 1, borderColor: C.border },
  check: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: C.lime, alignItems: 'center', justifyContent: 'center' },
  swatch: { width: 34, height: 34, borderRadius: 17, borderWidth: 3, borderColor: C.ink },
  line: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingHorizontal: 6, borderRadius: 10 },
  meLine: { backgroundColor: '#9CFF2E1A' },
  avatar: { alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: C.ink },
  nudgeBtn: { backgroundColor: C.orange, borderRadius: 999, padding: 6, borderWidth: 2, borderColor: C.ink },
  inviteRow: { flexDirection: 'row', gap: 10, alignItems: 'center', marginTop: 4 },
  codeBtn: { width: 92, height: 56, borderRadius: 12, borderWidth: 2, borderColor: C.steel, alignItems: 'center', justifyContent: 'center', backgroundColor: C.surface },
});
