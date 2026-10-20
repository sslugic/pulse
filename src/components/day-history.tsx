import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { C, Space } from '@/constants/theme';
import { dayKey, lastNDays, loggedDays, macroTargets, summarize } from '@/lib/nutrition';
import { useStore } from '@/lib/store';
import type { Entry } from '@/lib/types';

import { Icon } from './icon';
import { Bar, Card, T, tap } from './ui';

const open = (key: string) => {
  tap();
  router.push({ pathname: '/day/[key]', params: { key } });
};

const label = (k: string, todayKey: string) => {
  const y = new Date(todayKey + 'T12:00');
  y.setDate(y.getDate() - 1);
  if (k === todayKey) return 'TODAY';
  if (k === dayKey(y)) return 'YESTERDAY';
  return new Date(k + 'T12:00').toLocaleDateString([], { weekday: 'long' }).toUpperCase();
};

/**
 * Day-by-day history: a strip of the last 14 days to jump to any of them, then one big
 * tappable card per logged day (today first) with its totals.
 */
export function DayHistory({ todayKey }: { todayKey: string }) {
  const entries = useStore((s) => s.entries);
  const profile = useStore((s) => s.profile);
  const t = macroTargets(profile);

  const strip = useMemo(() => {
    const logged = loggedDays(entries);
    return lastNDays(14, new Date(todayKey + 'T12:00'))
      .reverse()
      .map((k) => ({ k, logged: logged.has(k), d: new Date(k + 'T12:00') }));
  }, [entries, todayKey]);

  const days = useMemo(() => {
    const groups = new Map<string, Entry[]>();
    for (const e of entries) {
      const k = dayKey(e.createdAt);
      groups.set(k, [...(groups.get(k) ?? []), e]);
    }
    return [...groups.entries()].slice(0, 14);
  }, [entries]);

  return (
    <View style={{ gap: Space.sm }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
        {strip.map(({ k, logged, d }) => (
          <Pressable key={k} onPress={() => open(k)} style={[styles.chip, k === todayKey && styles.today, !logged && { opacity: 0.45 }]} accessibilityLabel={`Open ${k}`}>
            <T size={10} rounded color={k === todayKey ? C.ink : C.textDim}>
              {d.toLocaleDateString([], { weekday: 'short' }).toUpperCase()}
            </T>
            <T size={18} rounded color={k === todayKey ? C.ink : C.text}>
              {d.getDate()}
            </T>
            <View style={[styles.dot, { backgroundColor: logged ? (k === todayKey ? C.ink : C.lime) : 'transparent' }]} />
          </Pressable>
        ))}
      </ScrollView>

      {days.map(([k, list]) => {
        const s = summarize(list, k);
        const left = Math.round(t.calories + s.burned - s.eaten);
        return (
          <Pressable key={k} onPress={() => open(k)} accessibilityRole="button" accessibilityLabel={`Open ${label(k, todayKey)}`}>
            {({ pressed }) => (
              <Card style={{ gap: 10, opacity: pressed ? 0.75 : 1 }} accent={k === todayKey ? C.orange + '99' : undefined}>
                <View style={styles.head}>
                  <View style={{ flex: 1 }}>
                    <T size={15} rounded color={k === todayKey ? C.orange : C.text}>
                      {label(k, todayKey)}
                    </T>
                    <T size={11} color={C.textMute} weight="700">
                      {new Date(k + 'T12:00').toLocaleDateString([], { month: 'short', day: 'numeric' }).toUpperCase()} · {list.length} ENTRIES
                    </T>
                  </View>
                  <View style={styles.openBtn}>
                    <T size={11} rounded color={C.cyan}>
                      VIEW DAY
                    </T>
                    <Icon name="chevron" size={12} color={C.cyan} />
                  </View>
                </View>
                <View style={styles.row}>
                  <Stat label="EATEN" value={Math.round(s.eaten)} color={C.eaten} />
                  <Stat label="BURNED" value={Math.round(s.burned)} color={C.burned} />
                  <Stat label={left < 0 ? 'OVER' : 'LEFT'} value={Math.abs(left)} color={left < 0 ? C.danger : C.lime} />
                </View>
                <View style={styles.row}>
                  {[
                    ['P', s.protein, t.protein, C.protein],
                    ['C', s.carbs, t.carbs, C.carbs],
                    ['F', s.fat, t.fat, C.fat],
                  ].map(([l, v, max, color]) => (
                    <View key={l as string} style={{ flex: 1, gap: 3 }}>
                      <T size={10} rounded color={C.textDim}>
                        {l} {Math.round(v as number)}g
                      </T>
                      <Bar value={v as number} max={max as number} color={color as string} height={4} />
                    </View>
                  ))}
                </View>
              </Card>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={{ flex: 1 }}>
      <T size={10} rounded color={C.textMute}>
        {label}
      </T>
      <T size={18} rounded color={color}>
        {value.toLocaleString()}
      </T>
    </View>
  );
}

const styles = StyleSheet.create({
  strip: { gap: 8, paddingVertical: 2 },
  chip: { width: 52, alignItems: 'center', gap: 2, paddingVertical: 8, borderRadius: 10, backgroundColor: '#1D2023', borderWidth: 2, borderColor: C.ink },
  today: { backgroundColor: C.orange },
  dot: { width: 6, height: 6, borderRadius: 3, marginTop: 2 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  openBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 2, borderColor: C.cyan + '66', backgroundColor: '#12232A' },
  row: { flexDirection: 'row', gap: 12 },
});
