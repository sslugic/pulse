import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EntryRow } from '@/components/entry-row';
import { Icon } from '@/components/icon';
import { WeightCard } from '@/components/weight-card';
import { Card, Chip, SectionTitle, T } from '@/components/ui';
import { Backdrop, Comic } from '@/components/underground';
import { C, MaxContentWidth, Radius, Space } from '@/constants/theme';
import { dayKey, lastNDays, macroTargets, streak, summarize } from '@/lib/nutrition';
import { useStore } from '@/lib/store';
import { useTodayKey } from '@/lib/use-today';

const RANGES = { '7D': 7, '30D': 30 } as const;

export default function Trends() {
  const insets = useSafeAreaInsets();
  const entries = useStore((s) => s.entries);
  const profile = useStore((s) => s.profile);
  const frozen = useStore((s) => s.game.frozenDays);
  const [range, setRange] = useState<keyof typeof RANGES>('7D');
  const todayKey = useTodayKey();

  const keys = useMemo(() => lastNDays(RANGES[range], new Date(todayKey + 'T12:00')), [range, todayKey]);
  const days = useMemo(() => keys.map((k) => summarize(entries, k)), [entries, keys]);
  const target = macroTargets(profile).calories;

  const logged = days.filter((d) => d.eaten > 0);
  const avg = (f: (d: (typeof days)[number]) => number, pool = logged) => (pool.length ? Math.round(pool.reduce((a, d) => a + f(d), 0) / pool.length) : 0);
  const onTarget = logged.filter((d) => Math.abs(d.eaten - d.burned - target) <= target * 0.1).length;
  const weights = entries.filter((e) => e.kind === 'weight' && e.weightKg).slice().reverse();

  const maxBar = Math.max(target, ...days.map((d) => Math.max(d.eaten, d.burned))) * 1.1;

  const history = useMemo(() => {
    const groups = new Map<string, typeof entries>();
    for (const e of entries.slice(0, 120)) {
      const k = dayKey(e.createdAt);
      if (k === todayKey) continue;
      groups.set(k, [...(groups.get(k) ?? []), e]);
    }
    return [...groups.entries()].slice(0, 10);
  }, [entries, todayKey]);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Backdrop />
      <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + Space.md, paddingBottom: Space.xl }]}>
      <View style={styles.headerRow}>
        <Comic size={42}>STATS</Comic>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {(Object.keys(RANGES) as (keyof typeof RANGES)[]).map((r) => (
            <Chip key={r} label={r} active={range === r} onPress={() => setRange(r)} />
          ))}
        </View>
      </View>

      {/* KPI tiles */}
      <View style={styles.grid}>
        <Kpi label="Avg eaten" value={avg((d) => d.eaten).toLocaleString()} unit="kcal" color={C.eaten} />
        <Kpi label="Avg burned" value={avg((d) => d.burned, days).toLocaleString()} unit="kcal" color={C.burned} />
        <Kpi label="Avg protein" value={String(avg((d) => d.protein))} unit="g" color={C.protein} />
        <Kpi label="Streak" value={String(streak(entries, frozen))} unit="days" color={C.lime} />
      </View>

      {/* Weight */}
      <SectionTitle>Weight</SectionTitle>
      <WeightCard weighIns={weights} profile={profile} />

      {/* Calories in vs out */}
      <SectionTitle right={<Legend />}>Calories in vs out</SectionTitle>
      <Card>
        <View style={styles.chart}>
          {/* target line */}
          <View style={[styles.targetLine, { bottom: (target / maxBar) * 150 + (RANGES[range] <= 7 ? 19 : 0) }]}>
            <T size={9} color={C.textMute} weight="700" style={styles.targetLabel}>
              GOAL {target}
            </T>
          </View>
          {days.map((d) => (
            <View key={d.key} style={styles.barCol}>
              <View style={styles.barPair}>
                <View style={[styles.bar, { height: Math.max(2, (d.eaten / maxBar) * 150), backgroundColor: C.eaten }]} />
                <View style={[styles.bar, { height: Math.max(2, (d.burned / maxBar) * 150), backgroundColor: C.burned }]} />
              </View>
              {RANGES[range] <= 7 && (
                <T size={10} color={d.key === todayKey ? C.text : C.textMute} weight="700">
                  {new Date(d.key + 'T12:00').toLocaleDateString([], { weekday: 'narrow' })}
                </T>
              )}
            </View>
          ))}
        </View>
        <T size={12} color={C.textDim} style={{ marginTop: 10 }}>
          {logged.length ? `On target ${onTarget} of ${logged.length} logged days (±10% net).` : 'Log a few days to see your pattern.'}
        </T>
      </Card>

      {/* Macro split */}
      <SectionTitle>Average macro split</SectionTitle>
      <Card>
        <MacroSplit p={avg((d) => d.protein)} c={avg((d) => d.carbs)} f={avg((d) => d.fat)} />
      </Card>

      {/* History */}
      {history.length > 0 && <SectionTitle>History</SectionTitle>}
      {history.map(([k, list]) => {
        const s = summarize(list, k);
        return (
          <View key={k} style={{ gap: 6, marginBottom: Space.sm }}>
            <Pressable
              onPress={() => router.push({ pathname: '/day/[key]', params: { key: k } })}
              accessibilityRole="button"
              style={({ pressed }) => [{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 4 }, pressed && { opacity: 0.6 }]}>
              <T size={14} weight="700">
                {new Date(k + 'T12:00').toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
              </T>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <T size={12} color={C.textDim}>
                  {Math.round(s.eaten)} in · {Math.round(s.burned)} out
                </T>
                <Icon name="chevron" size={12} color={C.textMute} />
              </View>
            </Pressable>
            {list.map((e) => (
              <EntryRow key={e.id} entry={e} />
            ))}
          </View>
        );
      })}
    </ScrollView>
    </View>
  );
}

function Kpi({ label, value, unit, color }: { label: string; value: string; unit: string; color: string }) {
  return (
    <Card style={styles.kpi}>
      <T size={12} rounded color={C.textDim}>
        {label.toUpperCase()}
      </T>
      <T size={26} weight="800" rounded color={color}>
        {value} <T size={12} color={C.textMute}>{unit}</T>
      </T>
    </Card>
  );
}

function Legend() {
  return (
    <View style={{ flexDirection: 'row', gap: 10 }}>
      {[
        ['In', C.eaten],
        ['Out', C.burned],
      ].map(([l, c]) => (
        <View key={l} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c }} />
          <T size={11} color={C.textDim} weight="600">
            {l}
          </T>
        </View>
      ))}
    </View>
  );
}

function MacroSplit({ p, c, f }: { p: number; c: number; f: number }) {
  const kp = p * 4, kc = c * 4, kf = f * 9;
  const total = kp + kc + kf;
  if (!total) return <T size={13} color={C.textDim}>No meals logged in this range yet.</T>;
  const parts = [
    { label: 'Protein', g: p, pct: kp / total, color: C.protein },
    { label: 'Carbs', g: c, pct: kc / total, color: C.carbs },
    { label: 'Fat', g: f, pct: kf / total, color: C.fat },
  ];
  return (
    <View style={{ gap: 14 }}>
      <View style={{ flexDirection: 'row', height: 14, borderRadius: 7, overflow: 'hidden', gap: 3 }}>
        {parts.map((x) => (
          <View key={x.label} style={{ flex: x.pct, backgroundColor: x.color, borderRadius: 7 }} />
        ))}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        {parts.map((x) => (
          <View key={x.label} style={{ gap: 2 }}>
            <T size={12} color={C.textDim} weight="600">
              {x.label}
            </T>
            <T size={18} weight="800" rounded color={x.color}>
              {Math.round(x.pct * 100)}%
            </T>
            <T size={11} color={C.textMute}>
              {x.g} g/day
            </T>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: Space.md, gap: Space.sm, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Space.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Space.sm },
  kpi: { width: '48.5%', flexGrow: 1, gap: 4, borderRadius: Radius.md + 2 },
  chart: { height: 170, flexDirection: 'row', alignItems: 'flex-end', gap: 4, paddingTop: 10 },
  barCol: { flex: 1, alignItems: 'center', gap: 6, justifyContent: 'flex-end', height: '100%' },
  barPair: { flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: 150 },
  bar: { width: 7, borderRadius: 4, minWidth: 3 },
  targetLine: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.18)' },
  targetLabel: { position: 'absolute', right: 0, top: -13 },
});
