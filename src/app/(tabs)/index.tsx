import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EntryRow } from '@/components/entry-row';
import { Icon, IconBadge, type IconName } from '@/components/icon';
import { QuickTiles } from '@/components/quick-tiles';
import { WellbeingCard } from '@/components/wellbeing-card';
import { Bar, Card, Ring, SectionTitle, T, tap } from '@/components/ui';
import { C, Gradients, MaxContentWidth, Radius, Space } from '@/constants/theme';
import { dailyInsight } from '@/lib/gemini';
import { dayKey, fmtWater, macroTargets, streak, summarize } from '@/lib/nutrition';
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

  const todayKey = useTodayKey();
  const today = useMemo(() => summarize(entries, todayKey), [entries, todayKey]);
  const targets = useMemo(() => macroTargets(profile), [profile]);
  const todays = useMemo(() => entries.filter((e) => dayKey(e.createdAt) === today.key), [entries, today.key]);
  const days = useMemo(() => streak(entries), [entries]);

  const budget = targets.calories + today.burned;
  const remaining = budget - today.eaten;

  const insight = useInsight(todays.length);

  const openCoach = (mode: 'voice' | 'camera' | 'type') => {
    tap();
    router.navigate({ pathname: '/coach', params: { mode, t: String(Date.now()) } });
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: C.bg }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + Space.md, paddingBottom: insets.bottom + 100 }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <T size={13} color={C.textDim} weight="600">
            {new Date().toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })}
          </T>
          <T size={28} weight="800" rounded>
            {greeting()}
            {profile.name ? `, ${profile.name.split(' ')[0]}` : ''}
          </T>
        </View>
        <View style={styles.streak}>
          <Icon name="flame" size={16} color={C.orange} />
          <T size={15} weight="800" rounded>
            {days}
          </T>
        </View>
      </View>

      {/* Hero ring */}
      <LinearGradient colors={['#161A24', '#0D0F15']} style={styles.hero}>
        <Ring size={190} stroke={16} progress={budget > 0 ? today.eaten / budget : 0} colors={Gradients.brand}>
          <T size={44} weight="800" rounded color={remaining < 0 ? C.danger : C.text}>
            {Math.abs(Math.round(remaining)).toLocaleString()}
          </T>
          <T size={13} color={C.textDim} weight="600">
            {remaining < 0 ? 'kcal over' : 'kcal left'}
          </T>
        </Ring>
        <View style={styles.heroStats}>
          <HeroStat label="Eaten" value={today.eaten} color={C.eaten} icon="fork" />
          <View style={styles.divider} />
          <HeroStat label="Burned" value={today.burned} color={C.burned} icon="bolt" />
          <View style={styles.divider} />
          <HeroStat label="Goal" value={targets.calories} color={C.textDim} icon="target" onPress={() => router.push('/goals')} />
        </View>
      </LinearGradient>

      {/* Quick log */}
      <View style={{ marginTop: Space.sm }}>
        <QuickTiles onTalk={() => openCoach('voice')} onSnap={() => openCoach('camera')} onType={() => openCoach('type')} />
      </View>

      {/* Mind & recovery, tied to today's food */}
      <View style={{ marginTop: Space.sm }}>
        <WellbeingCard todayKey={todayKey} onTalk={() => openCoach('voice')} />
      </View>

      {/* AI insight */}
      {!!settings.apiKey && (
        <Card style={styles.insight}>
          <LinearGradient colors={Gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.insightIcon}>
            <Icon name="sparkles" size={18} color="#07080C" />
          </LinearGradient>
          <T size={14} color={C.text} style={{ flex: 1, lineHeight: 20 }}>
            {insight ?? 'Thinking about your day…'}
          </T>
        </Card>
      )}

      {/* Macros */}
      <SectionTitle>Macros</SectionTitle>
      <Card style={{ gap: 14 }}>
        <Macro label="Protein" value={today.protein} target={targets.protein} color={C.protein} />
        <Macro label="Carbs" value={today.carbs} target={targets.carbs} color={C.carbs} />
        <Macro label="Fat" value={today.fat} target={targets.fat} color={C.fat} />
      </Card>

      {/* Water + activity */}
      <View style={styles.twoCol}>
        <Card style={{ flex: 1, gap: 10 }}>
          <View style={styles.cardHead}>
            <IconBadge name="drop" color={C.water} size={28} />
            <T size={13} weight="700" color={C.textDim}>
              Water
            </T>
          </View>
          <T size={24} weight="800" rounded color={C.water}>
            {fmtWater(today.water, profile.units)}
          </T>
          <Bar value={today.water} max={targets.waterMl} color={C.water} />
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {[250, 500].map((ml) => (
              <Pressable
                key={ml}
                onPress={() => {
                  tap();
                  actions.addEntry({ kind: 'water', title: ml === 250 ? 'Glass of water' : 'Bottle of water', emoji: '💧', waterMl: ml, source: 'quick' });
                }}
                style={({ pressed }) => [styles.waterBtn, pressed && { opacity: 0.6 }]}>
                <Icon name="plus" size={11} color={C.water} weight="bold" />
                <T size={12} weight="700" color={C.water}>
                  {fmtWater(ml, profile.units)}
                </T>
              </Pressable>
            ))}
          </View>
        </Card>
        <Card style={{ flex: 1, gap: 10 }}>
          <View style={styles.cardHead}>
            <IconBadge name="figure" color={C.burned} size={28} />
            <T size={13} weight="700" color={C.textDim}>
              Activity
            </T>
          </View>
          <T size={24} weight="800" rounded color={C.burned}>
            {today.activeMin} <T size={14} color={C.textDim}>min</T>
          </T>
          <Bar value={today.activeMin} max={45} color={C.burned} />
          <T size={12} color={C.textDim}>
            {today.workouts} workout{today.workouts === 1 ? '' : 's'} · {Math.round(today.burned)} kcal
          </T>
        </Card>
      </View>

      {/* Log */}
      <SectionTitle right={<T size={12} color={C.textMute}>{todays.length} entries</T>}>Today’s log</SectionTitle>
      {todays.length === 0 ? (
        <Card style={{ alignItems: 'center', paddingVertical: Space.xl, gap: 6 }}>
          <IconBadge name="sparkles" color={C.lime} size={52} />
          <T size={15} weight="700">
            Nothing logged yet
          </T>
          <T size={13} color={C.textDim} style={{ textAlign: 'center' }}>
            Tap Talk and say “two eggs and toast” — Pulse does the math.
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

function HeroStat({ label, value, color, icon, onPress }: { label: string; value: number; color: string; icon: IconName; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={{ alignItems: 'center', flex: 1, gap: 4 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
        <Icon name={icon} size={13} color={color === C.textDim ? C.textMute : color} />
        <T size={12} color={C.textDim} weight="600">
          {label}
        </T>
      </View>
      <T size={20} weight="800" rounded color={color}>
        {Math.round(value).toLocaleString()}
      </T>
    </Pressable>
  );
}

function Macro({ label, value, target, color }: { label: string; value: number; target: number; color: string }) {
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <T size={14} weight="600">
          {label}
        </T>
        <T size={13} color={C.textDim}>
          <T size={13} weight="800" color={color}>
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
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: Space.sm },
  streak: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: C.surfaceHi,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.border,
  },
  hero: {
    borderRadius: Radius.lg + 6,
    paddingVertical: Space.lg,
    alignItems: 'center',
    gap: Space.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.border,
  },
  heroStats: { flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch', paddingHorizontal: Space.md },
  divider: { width: StyleSheet.hairlineWidth, height: 32, backgroundColor: C.border },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  insight: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: Space.sm },
  insightIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  twoCol: { flexDirection: 'row', gap: Space.sm, marginTop: Space.sm },
  waterBtn: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 3,
    alignItems: 'center',
    paddingVertical: 7,
    borderRadius: Radius.pill,
    backgroundColor: C.water + '22',
  },
});
