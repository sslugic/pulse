import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DayHistory } from '@/components/day-history';
import { Icon } from '@/components/icon';
import { WeightCard } from '@/components/weight-card';
import { Bar, Card, Chip, SectionTitle, T } from '@/components/ui';
import { Backdrop, Comic } from '@/components/underground';
import { C, MaxContentWidth, Radius, Space } from '@/constants/theme';
import { locale, t } from '@/lib/i18n';
import { fmtWater, lastNDays, macroTargets, streak } from '@/lib/nutrition';
import { buckets, overview, type Insight } from '@/lib/overview';
import { useStore } from '@/lib/store';
import { moodEmoji } from '@/lib/wellbeing';
import { useTodayKey } from '@/lib/use-today';

// ALL covers everything since the first log, up to a year.
const RANGES = { '7D': 7, '30D': 30, '90D': 90, ALL: 0 } as const;
const RANGE_LABEL: Record<keyof typeof RANGES, string> = { '7D': t('stats.range7d'), '30D': t('stats.range30d'), '90D': t('stats.range90d'), ALL: t('stats.rangeAll') };
const MOOD_COLORS = [C.danger, C.orange, C.yellow, C.cyan, C.lime];

export default function Trends() {
  const insets = useSafeAreaInsets();
  const entries = useStore((s) => s.entries);
  const profile = useStore((s) => s.profile);
  const frozen = useStore((s) => s.game.frozenDays);
  const [range, setRange] = useState<keyof typeof RANGES>('7D');
  const todayKey = useTodayKey();

  const span = useMemo(() => {
    if (RANGES[range]) return RANGES[range];
    const today = new Date(todayKey + 'T12:00').getTime();
    const first = entries.reduce((m, e) => (e.passive ? m : Math.min(m, e.createdAt)), today);
    return Math.min(365, Math.max(7, Math.ceil((today - first) / 864e5) + 1));
  }, [range, entries, todayKey]);
  const keys = useMemo(() => lastNDays(span, new Date(todayKey + 'T12:00')), [span, todayKey]);
  const o = useMemo(() => overview(entries, profile, keys), [entries, profile, keys]);
  const goals = macroTargets(profile);
  const target = goals.calories;
  const weights = entries.filter((e) => e.kind === 'weight' && e.weightKg).slice().reverse();

  const { cols, size } = useMemo(() => buckets(o.days), [o.days]);
  const maxBar = Math.max(target, ...cols.map((d) => Math.max(d.eaten, d.burned))) * 1.1;
  const short = cols.length <= 7;


  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Backdrop />
      <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + Space.md, paddingBottom: Space.xl }]}>
      <View style={styles.headerRow}>
        <Comic size={42}>{t('stats.title')}</Comic>
      </View>
      <View style={{ flexDirection: 'row', gap: 6, marginTop: -Space.sm }}>
        {(Object.keys(RANGES) as (keyof typeof RANGES)[]).map((r) => (
          <Chip key={r} label={RANGE_LABEL[r]} active={range === r} onPress={() => setRange(r)} />
        ))}
      </View>

      {/* KPI tiles */}
      <View style={styles.grid}>
        <Kpi label={t('stats.avgEaten')} value={o.avgEaten.toLocaleString(locale)} unit="kcal" color={C.eaten} />
        <Kpi label={t('stats.avgBurned')} value={o.avgBurned.toLocaleString(locale)} unit="kcal" color={C.burned} />
        <Kpi label={t('stats.avgProtein')} value={String(o.avgProtein)} unit="g" color={C.protein} />
        <Kpi label={t('stats.streak')} value={String(streak(entries, frozen))} unit={t('stats.days', { count: streak(entries, frozen) })} color={C.lime} />
        <Kpi label={t('stats.daysLogged')} value={String(o.daysLogged)} unit={t('stats.ofDays', { n: span })} color={C.cyan} />
        <Kpi label={t('stats.workoutsWeek')} value={String(o.workoutsPerWeek)} unit={t('stats.perWeek')} color={C.orange} />
      </View>

      {/* What to improve */}
      <SectionTitle>{t('stats.improveTitle')}</SectionTitle>
      <Card style={{ gap: 10 }} accent={C.yellow + '99'}>
        {o.insights.map((i) => (
          <InsightRow key={i.text} insight={i} />
        ))}
      </Card>

      {/* Day by day: tap any day for its full breakdown */}
      <SectionTitle>{t('stats.history')}</SectionTitle>
      <DayHistory todayKey={todayKey} />

      {/* Weight */}
      <SectionTitle>{t('stats.weight')}</SectionTitle>
      <WeightCard weighIns={weights} profile={profile} />

      {/* Calories in vs out */}
      <SectionTitle right={<Legend />}>{t('stats.caloriesInOut')}</SectionTitle>
      <Card>
        <View style={styles.chart}>
          {/* target line */}
          <View style={[styles.targetLine, { bottom: (target / maxBar) * 150 + (short ? 19 : 0) }]}>
            <T size={9} color={C.textMute} weight="700" style={styles.targetLabel}>
              {t('stats.goalLine', { n: target })}
            </T>
          </View>
          {cols.map((d) => (
            <View key={d.key} style={styles.barCol}>
              <View style={styles.barPair}>
                <View style={[styles.bar, { height: Math.max(2, (d.eaten / maxBar) * 150), backgroundColor: C.eaten }]} />
                <View style={[styles.bar, { height: Math.max(2, (d.burned / maxBar) * 150), backgroundColor: C.burned }]} />
              </View>
              {short && size === 1 && (
                <T size={10} color={d.key === todayKey ? C.text : C.textMute} weight="700">
                  {new Date(d.key + 'T12:00').toLocaleDateString(locale, { weekday: 'narrow' })}
                </T>
              )}
            </View>
          ))}
        </View>
        <T size={12} color={C.textDim} style={{ marginTop: 10 }}>
          {o.mealDays ? t('stats.onTarget', { n: o.onTargetDays, total: o.mealDays }) : t('stats.logAFewDays')}
          {size > 1 ? ` ${t('stats.weeklyBars')}` : ''}
        </T>
      </Card>

      {/* Averages against targets */}
      <SectionTitle>{t('stats.vsTargets')}</SectionTitle>
      <Card style={{ gap: 12 }}>
        <TargetRow label={t('stats.netCalories')} value={o.avgNet} goal={target} unit="kcal" color={C.eaten} />
        <TargetRow label={t('stats.protein')} value={o.avgProtein} goal={goals.protein} unit="g" color={C.protein} />
        <TargetRow label={t('stats.carbs')} value={o.avgCarbs} goal={goals.carbs} unit="g" color={C.carbs} />
        <TargetRow label={t('stats.fat')} value={o.avgFat} goal={goals.fat} unit="g" color={C.fat} />
        <TargetRow label={t('stats.water')} value={o.avgWater} goal={goals.waterMl} unit="" color={C.cyan} format={(n) => fmtWater(n, profile.units)} />
        <T size={11} color={C.textMute}>
          {t('stats.vsTargetsNote', { n: o.mealDays })}
        </T>
      </Card>

      {/* Macro split */}
      <SectionTitle>{t('stats.macroSplit')}</SectionTitle>
      <Card>
        <MacroSplit p={o.avgProtein} c={o.avgCarbs} f={o.avgFat} />
      </Card>

      {/* Mind and sleep */}
      <SectionTitle>{t('stats.mindTitle')}</SectionTitle>
      <Card style={{ gap: 14 }} accent={C.violet + '99'}>
        {o.avgMood == null && o.avgSleep == null && o.avgStress == null ? (
          <T size={13} color={C.textDim}>
            {t('stats.mindEmpty')}
          </T>
        ) : (
          <>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <MiniStat label={t('stats.avgMood')} value={o.avgMood != null ? `${moodEmoji(o.avgMood)} ${o.avgMood}` : '—'} color={C.yellow} />
              <MiniStat label={t('stats.avgSleep')} value={o.avgSleep != null ? `${o.avgSleep} h` : '—'} color={C.violet} />
              <MiniStat label={t('stats.avgStress')} value={o.avgStress != null ? `${o.avgStress}/10` : '—'} color={C.pink} />
            </View>
            {o.moodDays.some((n) => n > 0) && (
              <View style={{ gap: 6 }}>
                <T size={12} color={C.textDim} weight="600">
                  {t('stats.moodDays')}
                </T>
                <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, height: 70 }}>
                  {o.moodDays.map((n, i) => (
                    <View key={i} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
                      <T size={10} color={C.textMute}>
                        {n || ''}
                      </T>
                      <View style={{ width: '100%', height: Math.max(3, (n / Math.max(...o.moodDays)) * 40), borderRadius: 4, backgroundColor: MOOD_COLORS[i] }} />
                      <T size={14}>{moodEmoji(i + 1)}</T>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </>
        )}
      </Card>

    </ScrollView>
    </View>
  );
}

function InsightRow({ insight }: { insight: Insight }) {
  const color = insight.tone === 'good' ? C.lime : insight.tone === 'warn' ? C.orange : C.cyan;
  return (
    <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
      <Icon name={insight.tone === 'good' ? 'check' : insight.tone === 'warn' ? 'target' : 'sparkles'} size={16} color={color} />
      <T size={13} color={C.text} style={{ flex: 1, lineHeight: 19 }}>
        {insight.text}
      </T>
    </View>
  );
}

function TargetRow({ label, value, goal, unit, color, format }: { label: string; value: number; goal: number; unit: string; color: string; format?: (n: number) => string }) {
  const show = (n: number) => (format ? format(n) : `${n.toLocaleString(locale)}${unit ? ` ${unit}` : ''}`);
  const pct = goal ? Math.round((value / goal) * 100) : 0;
  return (
    <View style={{ gap: 4 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <T size={12} color={C.textDim} weight="600">
          {label}
        </T>
        <T size={12} rounded color={value ? color : C.textMute}>
          {value ? `${show(value)} / ${show(goal)} · ${pct}%` : '—'}
        </T>
      </View>
      <Bar value={value} max={goal} color={color} />
    </View>
  );
}

function MiniStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={{ gap: 2, alignItems: 'center', flex: 1 }}>
      <T size={11} color={C.textDim} weight="600">
        {label}
      </T>
      <T size={18} weight="800" rounded color={color}>
        {value}
      </T>
    </View>
  );
}

function Kpi({ label, value, unit, color }: { label: string; value: string; unit: string; color: string }) {
  return (
    <Card style={styles.kpi}>
      <T size={12} rounded color={C.textDim}>
        {label.toLocaleUpperCase(locale)}
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
        [t('stats.legendIn'), C.eaten],
        [t('stats.legendOut'), C.burned],
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
  if (!total) return <T size={13} color={C.textDim}>{t('stats.noMeals')}</T>;
  const parts = [
    { label: t('stats.protein'), g: p, pct: kp / total, color: C.protein },
    { label: t('stats.carbs'), g: c, pct: kc / total, color: C.carbs },
    { label: t('stats.fat'), g: f, pct: kf / total, color: C.fat },
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
              {t('stats.gramsPerDay', { g: x.g })}
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
