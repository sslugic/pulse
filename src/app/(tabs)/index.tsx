import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ArcadePrompt, isStressHigh } from '@/components/arcade-prompt';
import { EntryRow } from '@/components/entry-row';
import { Icon } from '@/components/icon';
import { openCoach } from '@/components/quick-fab';
import { QuickLog } from '@/components/quick-log';
import { TodayPlanCard } from '@/components/today-plan-card';
import { QuestsCard, TokenCount } from '@/components/quests-card';
import { TagAvatar } from '@/components/tag-avatar';
import { Backdrop, Comic, DripLetter, Sticker } from '@/components/underground';
import { WellbeingCard } from '@/components/wellbeing-card';
import { Bar, Card, SectionTitle, T, tap } from '@/components/ui';
import { C, Display, MaxContentWidth, Space } from '@/constants/theme';
import { dailyInsight } from '@/lib/gemini';
import { dayKey, lastNDays, macroTargets, streak, summarize } from '@/lib/nutrition';
import { questXp, tokenBalance } from '@/lib/quests';
import { crewRank, weekDots } from '@/lib/rank';
import { actions, getState, useAiReady, useStore } from '@/lib/store';
import { useTodayKey } from '@/lib/use-today';
import { useSteps } from '@/lib/health';
import { season } from '@/lib/seasons';
import { dayWellbeing } from '@/lib/wellbeing';

function greeting() {
  const h = new Date().getHours();
  return h < 5 ? 'Late night' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

export default function Today() {
  const insets = useSafeAreaInsets();
  const profile = useStore((s) => s.profile);
  const entries = useStore((s) => s.entries);
  const settings = useStore((s) => s.settings);
  const aiReady = useAiReady();
  const game = useStore((s) => s.game);
  const claims = game.claims;

  const todayKey = useTodayKey();
  const today = useMemo(() => summarize(entries, todayKey), [entries, todayKey]);
  const targets = useMemo(() => macroTargets(profile), [profile]);
  const todays = useMemo(() => entries.filter((e) => dayKey(e.createdAt) === today.key), [entries, today.key]);
  const days = useMemo(() => streak(entries, game.frozenDays), [entries, game.frozenDays]);
  const crew = useMemo(() => crewRank(entries, questXp(claims), game.frozenDays), [entries, claims, game.frozenDays]);
  const tokens = useMemo(() => tokenBalance(game), [game]);
  const mind = useMemo(() => dayWellbeing(entries, todayKey), [entries, todayKey]);
  const seasonNow = useMemo(() => season(entries, profile, claims, new Date(todayKey + 'T12:00')), [entries, profile, claims, todayKey]);
  const week = useMemo(() => weekDots(entries, new Date(todayKey + 'T12:00')), [entries, todayKey]);
  // Last 7 days for the subway track: nothing logged, logged, or on calorie target (net within 12%).
  const track = useMemo(
    () =>
      lastNDays(7, new Date(todayKey + 'T12:00')).map((k): TrackDay => {
        const d = summarize(entries, k);
        const any = entries.some((e) => dayKey(e.createdAt) === k);
        const hit = d.eaten > 0 && Math.abs(d.eaten - d.burned - targets.calories) <= targets.calories * 0.12;
        return { key: k, letter: new Date(k + 'T12:00').toLocaleDateString([], { weekday: 'narrow' }), state: hit ? 'target' : any ? 'logged' : 'none', today: k === todayKey };
      }),
    [entries, todayKey, targets.calories],
  );

  const budget = targets.calories + today.burned;
  const remaining = budget - today.eaten;

  const insight = useInsight(todays.length);
  // A new day may have opened a gap in the streak; owned freezes cover it. Health catches up too.
  useEffect(() => {
    actions.applyStreakFreezes();
    actions.syncHealth();
    actions.ensurePlans();
  }, [todayKey]);
  const steps = useSteps(!!settings.health?.on);

  const openDay = (key: string) => {
    tap();
    router.push({ pathname: '/day/[key]', params: { key } });
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Backdrop tags={['NYC', 'PULSE']} />
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + Space.sm, paddingBottom: 120 }]}>
        {/* Header: title, crew rank, avatar */}
        <View style={styles.header}>
          <View style={{ flex: 1, gap: 6 }}>
            <T size={14} color={C.lime} style={{ fontFamily: Display.tag }}>
              {greeting()}
              {profile.name ? `, ${profile.name.split(' ')[0]}` : ''}
            </T>
            <Comic size={34} color={C.text}>
              PULSE HQ
            </Comic>
            <Pressable onPress={() => router.push('/ranks')} accessibilityRole="button" accessibilityLabel={`${crew.rank}, see all ranks`} style={({ pressed }) => pressed && { opacity: 0.7 }}>
              <CrewBar label={crew.rank} progress={crew.progress} />
              <T size={10} rounded color={C.textMute} style={{ marginTop: 3, marginLeft: 4 }}>
                {crew.next ? `${crew.toNext} XP TO ${crew.next.toUpperCase()} · TAP FOR RANKS` : 'MAX RANK · TAP FOR RANKS'}
              </T>
            </Pressable>
          </View>
          <Pressable onPress={() => router.navigate('/profile')} style={{ alignItems: 'center', gap: 4 }}>
            <TagAvatar size={60} band={C.orange} letter={(profile.name || 'P')[0]} />
            <T size={12} rounded color={C.text}>
              {(profile.name || 'Player').toUpperCase().slice(0, 10)}_{crew.level}
            </T>
            <TokenCount value={tokens} size={13} />
          </Pressable>
        </View>

        {/* Streak */}
        <View style={styles.streakRow}>
          <View style={styles.streakBadge}>
            <Icon name="flame" size={16} color={C.orange} />
            <Comic size={days >= 10 ? 15 : 18} color={C.yellow}>
              {`${days}-DAY`}
            </Comic>
            <Comic size={10} color={C.text}>
              STREAK
            </Comic>
            {!!game.freezes && (
              <View style={styles.freeze}>
                <T size={10} rounded color={C.ink}>
                  🧊×{game.freezes}
                </T>
              </View>
            )}
          </View>
          <View style={styles.week}>
            {week.map((d, i) => (
              <Pressable key={i} onPress={() => openDay(d.key)} accessibilityLabel={`Open ${d.key}`} hitSlop={4}>
                <DripLetter letter={d.letter} on={d.on} color={d.today ? C.orange : C.lime} />
              </Pressable>
            ))}
          </View>
        </View>

        {/* Today's numbers first: calories left, eaten, burned and macros in one card */}
        <Card style={{ gap: 12, marginTop: Space.xs }} accent={remaining < 0 ? C.danger : C.orange + '99'} onPress={() => openDay(todayKey)}>
          <View style={styles.todayRow}>
            <View style={{ flex: 1.3 }}>
              <T size={11} rounded color={C.textDim}>
                {remaining < 0 ? 'KCAL OVER' : 'KCAL LEFT'}
              </T>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <T size={34} rounded color={remaining < 0 ? C.danger : C.text}>
                  {Math.abs(Math.round(remaining)).toLocaleString()}
                </T>
                <Icon name="flame" size={24} color={C.orange} />
              </View>
              <T size={10} color={C.textMute} weight="700">
                OF {budget.toLocaleString()} TODAY
              </T>
            </View>
            <View style={styles.todayStat}>
              <T size={11} rounded color={C.textDim}>
                EATEN
              </T>
              <T size={22} rounded color={C.eaten}>
                {Math.round(today.eaten).toLocaleString()}
              </T>
              <T size={10} color={C.textMute} weight="700">
                {today.meals} MEAL{today.meals === 1 ? '' : 'S'}
              </T>
            </View>
            <View style={styles.todayStat}>
              <T size={11} rounded color={C.textDim}>
                BURNED
              </T>
              <T size={22} rounded color={C.burned}>
                {Math.round(today.burned).toLocaleString()}
              </T>
              <T size={10} color={C.textMute} weight="700" numberOfLines={1}>
                {steps != null ? `${steps.toLocaleString()} STEPS` : `${today.activeMin} MIN`}
              </T>
            </View>
          </View>
          <View style={styles.macroRow}>
            <MiniMacro label="PROTEIN" value={today.protein} target={targets.protein} color={C.protein} />
            <MiniMacro label="CARBS" value={today.carbs} target={targets.carbs} color={C.carbs} />
            <MiniMacro label="FAT" value={today.fat} target={targets.fat} color={C.fat} />
          </View>
          <View style={styles.fuelActions}>
            <Pressable onPress={() => router.push('/plans')} style={styles.fuelBtn} accessibilityRole="button">
              <Icon name="fork" size={14} color={C.orange} />
              <T size={12} rounded color={C.orange}>
                PLANS
              </T>
            </Pressable>
            <Pressable onPress={() => router.push('/scan')} style={styles.fuelBtn} accessibilityRole="button">
              <Icon name="viewfinder" size={14} color={C.cyan} />
              <T size={12} rounded color={C.cyan}>
                SCAN BARCODE
              </T>
            </Pressable>
          </View>
        </Card>

        {/* Today's planned meals and workout */}
        <TodayPlanCard todayKey={todayKey} />

        {/* Stress alert only when today's score is high */}
        {isStressHigh(mind) && <ArcadePrompt w={mind} />}

        {/* One-tap water, mood and sleep */}
        <QuickLog todayKey={todayKey} />

        {/* Daily quests */}
        <QuestsCard todayKey={todayKey} />

        {/* Log */}
        <SectionTitle right={<T size={12} rounded color={C.textMute}>{todays.length} ENTRIES</T>}>Today’s log</SectionTitle>
        {todays.length === 0 ? (
          <Card style={{ alignItems: 'center', paddingVertical: Space.xl, gap: 6 }}>
            <Comic size={24} color={C.lime}>
              NOTHING LOGGED YET
            </Comic>
            <T size={13} color={C.textDim} style={{ textAlign: 'center' }}>
              Tap the + button and say “two eggs and toast”. The math is on us.
            </T>
          </Card>
        ) : (
          <View style={{ gap: 8 }}>
            {todays.map((e) => (
              <EntryRow key={e.id} entry={e} />
            ))}
          </View>
        )}

        {/* Mind & recovery, tied to today's food */}
        <View style={{ marginTop: Space.sm }}>
          <WellbeingCard todayKey={todayKey} onTalk={() => openCoach('voice')} />
        </View>

        {/* Coach says */}
        {aiReady && (
          <Card style={styles.insight} accent={C.violet + 'AA'}>
            <TagAvatar size={44} band={C.violet} online={false} letter="C" />
            <View style={{ flex: 1, gap: 2 }}>
              <T size={12} rounded color={C.violet}>
                COACH SAYS
              </T>
              <T size={14} color={C.text} style={{ lineHeight: 20 }}>
                {insight ?? 'Reading the signs of your day…'}
              </T>
            </View>
          </Card>
        )}

        {/* This month's season */}
        <Pressable onPress={() => router.push('/season')} accessibilityRole="button">
          <Card style={{ gap: 6, marginTop: Space.sm }} accent={seasonNow.theme.color + '99'}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <T size={26}>{seasonNow.theme.emoji}</T>
              <View style={{ flex: 1 }}>
                <T size={10} rounded color={C.textMute}>
                  SEASON · {seasonNow.daysLeft} DAYS LEFT
                </T>
                <Comic size={20} color={seasonNow.theme.color}>
                  {seasonNow.theme.name}
                </Comic>
              </View>
              <T size={13} rounded color={C.text}>
                {seasonNow.cleared}/5
              </T>
              <Icon name="chevron" size={14} color={C.textMute} />
            </View>
            <Bar value={seasonNow.challenges.reduce((n, c) => n + c.value / c.goal, 0)} max={5} color={seasonNow.theme.color} height={6} />
          </Card>
        </Pressable>

        {/* Weekly subway track */}
        <View>
          <Card style={{ gap: 10, marginTop: Space.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <T size={13} rounded color={C.text}>
                WEEKLY PROGRESS
              </T>
              <T size={11} rounded color={C.lime}>
                SUBWAY TRACK
              </T>
            </View>
            <Track days={track} onOpen={openDay} />
            <T size={11} color={C.textMute} weight="700">
              {track.filter((d) => d.state === 'target').length}/7 ON TARGET · {track.filter((d) => d.state !== 'none').length}/7 LOGGED · TAP A DAY
            </T>
          </Card>
          <Sticker text="STAY HARD" color={C.violet} rotate={6} style={{ position: 'absolute', right: 6, top: -6 }} size={14} />
        </View>
      </ScrollView>
    </View>
  );
}

/** Segmented XP bar, like an arcade health meter. */
function CrewBar({ label, progress }: { label: string; progress: number }) {
  const cells = 12;
  const lit = Math.max(1, Math.round(progress * cells));
  return (
    <View style={styles.crew}>
      <T size={11} rounded color={C.text} style={{ width: 62, lineHeight: 12 }}>
        {label.toUpperCase()}
      </T>
      <View style={styles.cells}>
        {Array.from({ length: cells }).map((_, i) => {
          const on = i < lit;
          const hue = i < 4 ? C.orange : i < 8 ? C.yellow : C.lime;
          return <View key={i} style={[styles.cell, { backgroundColor: on ? hue : '#15181A' }, i === lit - 1 && on && { shadowColor: hue, shadowOpacity: 1, shadowRadius: 6 }]} />;
        })}
      </View>
    </View>
  );
}

type TrackDay = { key: string; letter: string; state: 'none' | 'logged' | 'target'; today: boolean };

/** Subway rails, one pair of sleepers per day: dark when nothing was logged, amber when logged, glowing lime on target. */
function Track({ days, onOpen }: { days: TrackDay[]; onOpen: (key: string) => void }) {
  return (
    <View style={styles.trackRow}>
      <View style={[styles.rail, { top: 9 }]} />
      <View style={[styles.rail, { top: 27 }]} />
      {days.map((d) => {
        const lit = d.state === 'target' ? C.lime : d.state === 'logged' ? C.orange : null;
        return (
          <Pressable key={d.key} onPress={() => onOpen(d.key)} style={styles.trackDay} accessibilityLabel={`${d.key}: ${d.state}`}>
            <View style={styles.sleepers}>
              {[0, 1].map((i) => (
                <View
                  key={i}
                  style={[styles.sleeper, lit && { backgroundColor: '#5A3A1E', borderColor: lit, shadowColor: lit, shadowOpacity: d.state === 'target' ? 0.9 : 0.4, shadowRadius: 5 }]}
                />
              ))}
            </View>
            <T size={11} rounded color={d.today ? C.orange : lit ?? C.textMute}>
              {d.letter}
            </T>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Refreshes the AI insight whenever today's entry count changes. */
function useInsight(count: number) {
  const [text, setText] = useState<string | null>(null);
  const ready = useAiReady();
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      const s = getState();
      try {
        const out = await dailyInsight({ apiKey: s.settings.apiKey, model: s.settings.model, profile: s.profile, entries: s.entries });
        if (!cancelled && out) setText(out);
      } catch {
        if (!cancelled) setText('Log a meal or workout and I’ll start spotting patterns.');
      }
    }, 600);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [count, ready]);
  return text;
}

/** Compact macro: name, grams of target and a thin bar, three to a row. */
function MiniMacro({ label, value, target, color }: { label: string; value: number; target: number; color: string }) {
  return (
    <View style={{ flex: 1, gap: 4 }}>
      <T size={10} rounded color={C.textDim}>
        {label}
      </T>
      <T size={12} color={C.textDim}>
        <T size={14} rounded color={color}>
          {Math.round(value)}
        </T>
        /{target}g
      </T>
      <Bar value={value} max={target} color={color} height={5} />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: Space.md, gap: Space.sm, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  crew: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 6,
    paddingLeft: 10,
    borderRadius: 10,
    backgroundColor: '#2A2E31',
    borderWidth: 2,
    borderColor: '#5E6468',
    alignSelf: 'flex-start',
  },
  cells: { flexDirection: 'row', gap: 3, padding: 3, backgroundColor: '#0B0C0D', borderRadius: 4 },
  cell: { width: 11, height: 18, borderRadius: 2 },
  todayRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  todayStat: { flex: 1, paddingLeft: 10, borderLeftWidth: 1, borderLeftColor: 'rgba(255,255,255,0.08)' },
  macroRow: { flexDirection: 'row', gap: 12 },
  fuelActions: { flexDirection: 'row', gap: 8, marginTop: 2 },
  fuelBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 9, borderRadius: 8, backgroundColor: '#1D2023', borderWidth: 2, borderColor: C.ink, borderBottomWidth: 4 },
  freeze: { position: 'absolute', bottom: -6, paddingHorizontal: 5, paddingVertical: 1, borderRadius: 6, backgroundColor: C.cyan, borderWidth: 2, borderColor: C.ink },
  streakRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: Space.md },
  streakBadge: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2B1A10',
    borderWidth: 3,
    borderColor: C.orange,
    shadowColor: C.orange,
    shadowOpacity: 0.8,
    shadowRadius: 12,
  },
  week: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingTop: 6,
    paddingBottom: 2,
    borderRadius: 10,
    backgroundColor: 'rgba(12,13,14,0.78)',
    borderWidth: 2,
    borderColor: '#3A3F43',
  },
  insight: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: Space.md },
  trackRow: { flexDirection: 'row', justifyContent: 'space-between' },
  trackDay: { alignItems: 'center', gap: 4, flex: 1 },
  sleepers: { flexDirection: 'row', gap: 6, height: 36, alignItems: 'center' },
  sleeper: { width: 10, height: 36, borderRadius: 2, backgroundColor: '#3B2A1C', borderWidth: 1, borderColor: '#1A120B' },
  rail: { position: 'absolute', left: 0, right: 0, height: 4, backgroundColor: '#9AA0A4', borderRadius: 2, borderBottomWidth: 1, borderBottomColor: '#3A3F43' },
});
