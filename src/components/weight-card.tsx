import { Alert, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop } from 'react-native-svg';

import { C } from '@/constants/theme';
import { tap } from '@/lib/haptics';
import { dayKey } from '@/lib/nutrition';
import { actions } from '@/lib/store';
import type { Entry, Profile } from '@/lib/types';
import { useTodayKey } from '@/lib/use-today';

import { Icon } from './icon';

import { Card, T } from './ui';
import { Comic } from './underground';

const LB = 2.20462;
const shortDate = (t: number) => new Date(t).toLocaleDateString([], { month: 'short', day: 'numeric' });

/** Current weight, change since the first weigh-in, and the weigh-in trend line. */
export function WeightCard({ weighIns, profile }: { weighIns: Entry[]; profile: Profile }) {
  const imperial = profile.units === 'imperial';
  const unit = imperial ? 'lb' : 'kg';
  const show = (kg: number) => (imperial ? kg * LB : kg);
  const fmt = (kg: number) => (imperial ? `${Math.round(show(kg))}` : `${Math.round(kg * 10) / 10}`);

  const points = weighIns.filter((w) => w.weightKg).map((w) => ({ kg: w.weightKg!, at: w.createdAt }));
  const last = points[points.length - 1];
  const first = points[0];
  const current = last?.kg ?? profile.weightKg;
  const delta = last && first ? show(last.kg) - show(first.kg) : 0;

  // Down is progress when cutting, up when building, and flat is the win when maintaining.
  const wantDown = profile.goal === 'lose' || profile.goal === 'recomp';
  const good = profile.goal === 'maintain' ? Math.abs(delta) < (imperial ? 2 : 1) : profile.goal === 'gain' ? delta > 0 : delta < 0;
  const deltaColor = points.length < 2 || delta === 0 ? C.textDim : good ? C.lime : C.orange;

  return (
    <Card style={{ gap: 14 }} accent={C.violet + '88'}>
      <View style={styles.top}>
        <View style={{ gap: 2 }}>
          <T size={11} rounded color={C.textDim}>
            CURRENT
          </T>
          <View style={styles.big}>
            <Comic size={44} color={C.text}>
              {fmt(current)}
            </Comic>
            <T size={16} rounded color={C.textMute}>
              {unit}
            </T>
          </View>
          <T size={11} color={C.textMute} weight="700">
            {last ? `WEIGHED ${shortDate(last.at).toUpperCase()}` : 'FROM YOUR PROFILE'}
          </T>
        </View>
        <View style={styles.side}>
          <Stat label="CHANGE" value={points.length >= 2 ? `${delta > 0 ? '+' : ''}${delta.toFixed(1)} ${unit}` : '—'} color={deltaColor} />
          <Stat label="START" value={first ? `${fmt(first.kg)} ${unit}` : '—'} color={C.text} />
          <Stat label="WEIGH-INS" value={String(points.length)} color={C.violet} />
        </View>
      </View>

      {points.length > 0 ? (
        <Chart values={points.map((p) => show(p.kg))} dates={points.map((p) => p.at)} unit={unit} wantDown={wantDown} />
      ) : null}

      {weighIns.length > 0 && <WeighInList weighIns={weighIns} fmt={fmt} unit={unit} />}

      <T size={12} color={C.textDim} style={{ lineHeight: 17 }}>
        {points.length < 2
          ? `Log another weigh-in to see your trend. Say “I weigh ${imperial ? '172 lb' : '78 kg'}” to the Coach.`
          : `Say “I weigh ${imperial ? '172 lb' : '78 kg'}” to the Coach to add a weigh-in.`}
      </T>
    </Card>
  );
}

function dayLabel(t: number, todayKey: string) {
  const k = dayKey(t);
  const y = new Date(todayKey + 'T12:00');
  y.setDate(y.getDate() - 1);
  return k === todayKey ? 'TODAY' : k === dayKey(y) ? 'YESTERDAY' : new Date(t).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase();
}

/** Recent weigh-ins, newest first, with arrows to move one to another day and a delete button. */
function WeighInList({ weighIns, fmt, unit }: { weighIns: Entry[]; fmt: (kg: number) => string; unit: string }) {
  const todayKey = useTodayKey();
  const rows = weighIns.slice().reverse().slice(0, 7);
  const move = (e: Entry, days: number) => {
    tap();
    actions.moveEntryDays(e.id, days);
  };
  const remove = (e: Entry) =>
    Alert.alert('Delete weigh-in?', `${fmt(e.weightKg ?? 0)} ${unit} on ${dayLabel(e.createdAt, todayKey).toLowerCase()}`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => actions.removeEntry(e.id) },
    ]);
  return (
    <View style={styles.list}>
      <T size={10} rounded color={C.textMute}>
        WEIGH-INS · USE THE ARROWS TO FIX A DAY
      </T>
      {rows.map((e) => {
        const isToday = dayKey(e.createdAt) === todayKey;
        return (
          <View key={e.id} style={styles.row}>
            <Pressable onPress={() => move(e, -1)} style={styles.arrow} hitSlop={6} accessibilityLabel="Move to the day before">
              <Icon name="back" size={14} color={C.text} weight="bold" />
            </Pressable>
            <T size={12} rounded color={C.textDim} style={{ flex: 1, textAlign: 'center' }}>
              {dayLabel(e.createdAt, todayKey)}
            </T>
            <Pressable onPress={() => move(e, 1)} disabled={isToday} style={[styles.arrow, isToday && { opacity: 0.25 }]} hitSlop={6} accessibilityLabel="Move to the day after">
              <Icon name="chevron" size={14} color={C.text} weight="bold" />
            </Pressable>
            <T size={15} rounded color={C.text} style={{ width: 84, textAlign: 'right' }}>
              {fmt(e.weightKg ?? 0)} {unit}
            </T>
            <Pressable onPress={() => remove(e)} style={styles.trash} hitSlop={6} accessibilityLabel="Delete weigh-in">
              <Icon name="trash" size={14} color={C.textMute} />
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={styles.stat}>
      <T size={10} rounded color={C.textMute}>
        {label}
      </T>
      <T size={14} rounded color={color}>
        {value}
      </T>
    </View>
  );
}

function Chart({ values, dates, unit, wantDown }: { values: number[]; dates: number[]; unit: string; wantDown: boolean }) {
  const W = 320, H = 140, padX = 14, padTop = 14, padBottom = 22;
  const lo = Math.min(...values), hi = Math.max(...values);
  const span = Math.max(hi - lo, 1);
  const min = lo - span * 0.25, max = hi + span * 0.25;
  const x = (i: number) => (values.length === 1 ? W / 2 : padX + (i / (values.length - 1)) * (W - padX * 2));
  const y = (v: number) => padTop + (1 - (v - min) / (max - min)) * (H - padTop - padBottom);
  const xy = values.map((v, i) => [x(i), y(v)] as const);
  const line = xy.map(([px, py], i) => `${i ? 'L' : 'M'}${px},${py}`).join(' ');
  const area = `${line} L${xy[xy.length - 1][0]},${H - padBottom} L${xy[0][0]},${H - padBottom} Z`;
  const trendColor = values.length < 2 ? C.violet : (values[values.length - 1] < values[0]) === wantDown ? C.lime : C.orange;

  return (
    <View>
      <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
        <Defs>
          <LinearGradient id="wfill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={C.violet} stopOpacity={0.35} />
            <Stop offset="1" stopColor={C.violet} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        {[0.25, 0.5, 0.75].map((f) => (
          <Line key={f} x1={0} x2={W} y1={padTop + f * (H - padTop - padBottom)} y2={padTop + f * (H - padTop - padBottom)} stroke="rgba(255,255,255,0.08)" strokeDasharray="4 6" />
        ))}
        {values.length > 1 && <Path d={area} fill="url(#wfill)" />}
        {values.length > 1 && <Path d={line} stroke={C.violet} strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" />}
        {xy.map(([px, py], i) => {
          const lastPt = i === xy.length - 1;
          return <Circle key={i} cx={px} cy={py} r={lastPt ? 6 : 3.5} fill={lastPt ? trendColor : C.violet} stroke={lastPt ? C.ink : 'none'} strokeWidth={2} />;
        })}
      </Svg>
      <View style={styles.axis}>
        <T size={10} color={C.textMute} weight="700">
          {shortDate(dates[0]).toUpperCase()}
        </T>
        <T size={10} color={C.textMute} weight="700">
          {`${Math.round(lo * 10) / 10}–${Math.round(hi * 10) / 10} ${unit}`}
        </T>
        <T size={10} color={C.textMute} weight="700">
          {dates.length > 1 ? shortDate(dates[dates.length - 1]).toUpperCase() : ''}
        </T>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  big: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  side: { gap: 6, alignItems: 'flex-end', justifyContent: 'center' },
  stat: { alignItems: 'flex-end' },
  list: { gap: 6, paddingTop: 4, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  arrow: { width: 30, height: 28, borderRadius: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: C.surfaceHi, borderWidth: 2, borderColor: C.ink },
  trash: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  axis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: -16, paddingHorizontal: 4 },
});
