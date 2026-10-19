import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { EntryRow } from '@/components/entry-row';
import { Icon, IconBadge } from '@/components/icon';
import { QuestsCard, TokenCount } from '@/components/quests-card';
import { TagAvatar } from '@/components/tag-avatar';
import { ArcadeButton, Backdrop, Chain, Comic, DripLetter, Sticker } from '@/components/underground';
import { WellbeingCard } from '@/components/wellbeing-card';
import { Bar, Card, SectionTitle, T, tap } from '@/components/ui';
import { C, Display, Gradients, MaxContentWidth, Space } from '@/constants/theme';
import { dailyInsight } from '@/lib/gemini';
import { dayKey, fmtWater, lastNDays, macroTargets, streak, summarize } from '@/lib/nutrition';
import { questXp, tokenBalance } from '@/lib/quests';
import { crewRank, weekDots } from '@/lib/rank';
import { actions, getState, useStore } from '@/lib/store';
import { useTodayKey } from '@/lib/use-today';

function greeting() {
  const h = new Date().getHours();
  return h < 5 ? 'Late night' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

export default function Today() {
  const insets = useSafeAreaInsets();
  const profile = useStore((s) => s.profile);
  const entries = useStore((s) => s.entries);
  const settings = useStore((s) => s.settings);
  const claims = useStore((s) => s.game.claims);

  const todayKey = useTodayKey();
  const today = useMemo(() => summarize(entries, todayKey), [entries, todayKey]);
  const targets = useMemo(() => macroTargets(profile), [profile]);
  const todays = useMemo(() => entries.filter((e) => dayKey(e.createdAt) === today.key), [entries, today.key]);
  const days = useMemo(() => streak(entries), [entries]);
  const crew = useMemo(() => crewRank(entries, questXp(claims)), [entries, claims]);
  const tokens = useMemo(() => tokenBalance(claims), [claims]);
  const week = useMemo(() => weekDots(entries, new Date(todayKey + 'T12:00')), [entries, todayKey]);
  const onTrack = useMemo(
    () =>
      lastNDays(7, new Date(todayKey + 'T12:00')).map((k) => {
        const d = summarize(entries, k);
        return d.eaten > 0 && Math.abs(d.eaten - d.burned - targets.calories) <= targets.calories * 0.12;
      }),
    [entries, todayKey, targets.calories],
  );

  const budget = targets.calories + today.burned;
  const remaining = budget - today.eaten;

  const insight = useInsight(todays.length);

  const openCoach = (mode: 'voice' | 'camera' | 'type') => {
    tap();
    router.navigate({ pathname: '/coach', params: { mode, t: String(Date.now()) } });
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Backdrop tags={['NYC', 'PULSE']} />
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + Space.sm, paddingBottom: Space.xl }]}>
        {/* Header: title, crew rank, avatar */}
        <View style={styles.header}>
          <View style={{ flex: 1, gap: 6 }}>
            <T size={14} color={C.lime} style={{ fontFamily: Display.tag }}>
              {greeting()}
              {profile.name ? `, ${profile.name.split(' ')[0]}` : ''}
            </T>
            <View>
              <Comic size={22} color={C.text}>
                THE PULSE
              </Comic>
              <Comic size={44} color={C.text}>
                UNDERGROUND
              </Comic>
            </View>
            <CrewBar label={crew.rank} progress={crew.progress} />
          </View>
          <Pressable onPress={() => router.navigate('/profile')} style={{ alignItems: 'center', gap: 4 }}>
            <TagAvatar size={78} band={C.orange} letter={(profile.name || 'P')[0]} />
            <T size={12} rounded color={C.text}>
              {(profile.name || 'Player').toUpperCase().slice(0, 10)}_{crew.level}
            </T>
            <TokenCount value={tokens} size={13} />
          </Pressable>
        </View>

        <Chain style={{ marginHorizontal: -Space.md, marginVertical: 2 }} />

        {/* Streak */}
        <View style={styles.streakRow}>
          <View style={styles.streakBadge}>
            <Icon name="flame" size={22} color={C.orange} />
            <Comic size={days >= 10 ? 18 : 22} color={C.yellow}>
              {`${days}-DAY`}
            </Comic>
            <Comic size={13} color={C.text}>
              STREAK
            </Comic>
          </View>
          <View style={styles.week}>
            {week.map((d, i) => (
              <DripLetter key={i} letter={d.letter} on={d.on} color={d.today ? C.orange : C.lime} />
            ))}
          </View>
        </View>

        {/* Daily quests */}
        <QuestsCard todayKey={todayKey} />

        {/* Stat plates */}
        <View style={styles.twoCol}>
          <Card style={{ flex: 1, gap: 2 }} accent={remaining < 0 ? C.danger : undefined} onPress={() => router.push('/goals')}>
            <T size={12} rounded color={C.textDim}>
              KCAL LEFT
            </T>
            <View style={styles.statRow}>
              <T size={34} rounded color={remaining < 0 ? C.danger : C.text}>
                {Math.abs(Math.round(remaining)).toLocaleString()}
              </T>
              <Icon name="flame" size={30} color={C.orange} />
            </View>
            <T size={11} color={C.textMute} weight="700">
              {remaining < 0 ? 'OVER' : 'OF'} {budget.toLocaleString()} TODAY
            </T>
          </Card>
          <Card style={{ flex: 1, gap: 2 }} accent={C.lime + '99'}>
            <T size={12} rounded color={C.textDim}>
              BURNED
            </T>
            <View style={styles.statRow}>
              <T size={34} rounded color={C.text}>
                {Math.round(today.burned)}
              </T>
              <Pulseline />
            </View>
            <T size={11} color={C.textMute} weight="700">
              {today.activeMin} MIN · {today.workouts} WORKOUT{today.workouts === 1 ? '' : 'S'}
            </T>
          </Card>
        </View>

        <Card style={{ gap: 12, marginTop: Space.sm }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <T size={12} rounded color={C.textDim}>
              FUEL
            </T>
            <T size={22} rounded>
              {Math.round(today.eaten).toLocaleString()}
              <T size={14} rounded color={C.textMute}>
                {' '}
                / {targets.calories.toLocaleString()}
              </T>
            </T>
          </View>
          <Macro label="Protein" value={today.protein} target={targets.protein} color={C.protein} />
          <Macro label="Carbs" value={today.carbs} target={targets.carbs} color={C.carbs} />
          <Macro label="Fat" value={today.fat} target={targets.fat} color={C.fat} />
        </Card>

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
            <Track days={onTrack} />
            <T size={11} color={C.textMute} weight="700">
              {onTrack.filter(Boolean).length}/7 DAYS ON TARGET
            </T>
          </Card>
          <Sticker text="STAY HARD" color={C.violet} rotate={-8} style={{ position: 'absolute', right: 70, top: -4 }} />
          <Sticker text="GO HARD" color={C.orange} rotate={7} style={{ position: 'absolute', right: 4, top: 30 }} size={20} />
        </View>

        {/* Capture */}
        <ArcadeButton
          label="TALK TO COACH"
          size="xl"
          onPress={() => openCoach('voice')}
          icon={<Icon name="mic" size={38} color="#FF6A00" weight="bold" />}
          style={{ marginTop: Space.lg }}
        />
        <View style={styles.twoCol}>
          <ArcadeButton label="SNAP" colors={Gradients.warm} textColor={C.yellow} onPress={() => openCoach('camera')} icon={<Icon name="camera" size={24} color={C.yellow} weight="bold" />} style={{ flex: 1 }} />
          <ArcadeButton label="TYPE" colors={Gradients.cool} textColor="#fff" onPress={() => openCoach('type')} icon={<Icon name="bubble" size={22} color="#fff" weight="bold" />} style={{ flex: 1 }} />
        </View>

        {/* Coach says */}
        {!!settings.apiKey && (
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

        {/* Mind & recovery, tied to today's food */}
        <View style={{ marginTop: Space.sm }}>
          <WellbeingCard todayKey={todayKey} onTalk={() => openCoach('voice')} />
        </View>

        {/* Water */}
        <Card style={{ gap: 10, marginTop: Space.sm }}>
          <View style={styles.cardHead}>
            <IconBadge name="drop" color={C.water} size={28} />
            <T size={13} rounded color={C.textDim} style={{ flex: 1 }}>
              WATER
            </T>
            <T size={20} rounded color={C.water}>
              {fmtWater(today.water, profile.units)}
            </T>
          </View>
          <Bar value={today.water} max={targets.waterMl} color={C.water} />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {[250, 500].map((ml) => (
              <Pressable
                key={ml}
                onPress={() => {
                  tap();
                  actions.addEntry({ kind: 'water', title: ml === 250 ? 'Glass of water' : 'Bottle of water', emoji: '💧', waterMl: ml, source: 'quick' });
                }}
                style={({ pressed }) => [styles.waterBtn, pressed && { transform: [{ translateY: 2 }] }]}>
                <Icon name="plus" size={12} color={C.water} weight="bold" />
                <T size={13} rounded color={C.water}>
                  {fmtWater(ml, profile.units)}
                </T>
              </Pressable>
            ))}
          </View>
        </Card>

        {/* Log */}
        <SectionTitle right={<T size={12} rounded color={C.textMute}>{todays.length} ENTRIES</T>}>Today’s log</SectionTitle>
        {todays.length === 0 ? (
          <Card style={{ alignItems: 'center', paddingVertical: Space.xl, gap: 6 }}>
            <Comic size={24} color={C.lime}>
              NOTHING LOGGED YET
            </Comic>
            <T size={13} color={C.textDim} style={{ textAlign: 'center' }}>
              Hit TALK TO COACH and say “two eggs and toast”. The math is on us.
            </T>
          </Card>
        ) : (
          <View style={{ gap: 8 }}>
            {todays.map((e) => (
              <EntryRow key={e.id} entry={e} />
            ))}
          </View>
        )}
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

/** Small green heartbeat line. */
function Pulseline() {
  return (
    <Svg width={58} height={30} viewBox="0 0 58 30">
      <Path d="M1 18 H14 L19 8 L25 26 L31 4 L36 18 H57" stroke={C.lime} strokeWidth={3} fill="none" strokeLinejoin="round" strokeLinecap="round" />
    </Svg>
  );
}

/** Subway rails where each sleeper lights up for a day on target. */
function Track({ days }: { days: boolean[] }) {
  return (
    <View style={{ height: 40, justifyContent: 'center' }}>
      <View style={styles.sleepers}>
        {Array.from({ length: 14 }).map((_, i) => {
          const day = days[Math.floor(i / 2)];
          return <View key={i} style={[styles.sleeper, day && { backgroundColor: '#5A3A1E', borderColor: C.lime, shadowColor: C.lime, shadowOpacity: 0.8, shadowRadius: 5 }]} />;
        })}
      </View>
      <View style={[styles.rail, { top: 9 }]} />
      <View style={[styles.rail, { bottom: 9 }]} />
    </View>
  );
}

/** Refreshes the AI insight whenever today's entry count changes. */
function useInsight(count: number) {
  const [text, setText] = useState<string | null>(null);
  const apiKey = useStore((s) => s.settings.apiKey);
  useEffect(() => {
    if (!apiKey) return;
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
  }, [count, apiKey]);
  return text;
}

function Macro({ label, value, target, color }: { label: string; value: number; target: number; color: string }) {
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <T size={13} rounded>
          {label.toUpperCase()}
        </T>
        <T size={13} color={C.textDim}>
          <T size={13} rounded color={color}>
            {Math.round(value)}
          </T>{' '}
          / {target} g
        </T>
      </View>
      <Bar value={value} max={target} color={color} />
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
  streakRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  streakBadge: {
    width: 104,
    height: 104,
    borderRadius: 52,
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
  twoCol: { flexDirection: 'row', gap: Space.sm, marginTop: Space.sm },
  statRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  insight: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: Space.md },
  sleepers: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4 },
  sleeper: { width: 10, height: 36, borderRadius: 2, backgroundColor: '#3B2A1C', borderWidth: 1, borderColor: '#1A120B' },
  rail: { position: 'absolute', left: 0, right: 0, height: 4, backgroundColor: '#9AA0A4', borderRadius: 2, borderBottomWidth: 1, borderBottomColor: '#3A3F43' },
  waterBtn: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 4,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#1B2A3C',
    borderWidth: 2,
    borderColor: C.ink,
    borderBottomWidth: 4,
  },
});
