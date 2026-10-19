import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EntryRow } from '@/components/entry-row';
import { QuestsCard } from '@/components/quests-card';
import { GlassButton, Icon } from '@/components/icon';
import { Bar, Card, SectionTitle, T, tap } from '@/components/ui';
import { Backdrop, Comic } from '@/components/underground';
import { C, MaxContentWidth, Space } from '@/constants/theme';
import { dayKey, fmtWater, macroTargets, summarize } from '@/lib/nutrition';
import { dailyQuests } from '@/lib/quests';
import { useStore } from '@/lib/store';
import { useTodayKey } from '@/lib/use-today';
import { dayWellbeing, LEVEL_COLOR, MOODS } from '@/lib/wellbeing';

const shift = (key: string, days: number) => {
  const d = new Date(key + 'T12:00');
  d.setDate(d.getDate() + days);
  return dayKey(d);
};

/** Read-only look back at one day: fuel, macros, water, mind and everything logged. */
export default function DayScreen() {
  const insets = useSafeAreaInsets();
  const todayKey = useTodayKey();
  const params = useLocalSearchParams<{ key: string }>();
  const key = /^\d{4}-\d{2}-\d{2}$/.test(params.key ?? '') ? params.key! : todayKey;

  const entries = useStore((s) => s.entries);
  const profile = useStore((s) => s.profile);
  const claims = useStore((s) => s.game.claims);
  const t = macroTargets(profile);

  const day = useMemo(() => summarize(entries, key), [entries, key]);
  const list = useMemo(() => entries.filter((e) => dayKey(e.createdAt) === key), [entries, key]);
  const mind = useMemo(() => dayWellbeing(entries, key), [entries, key]);
  const quests = useMemo(() => dailyQuests(entries, t, key, claims), [entries, t, key, claims]);

  const net = day.eaten - day.burned;
  const onTarget = day.eaten > 0 && Math.abs(net - t.calories) <= t.calories * 0.12;
  const isToday = key === todayKey;
  const title = isToday ? 'TODAY' : new Date(key + 'T12:00').toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase();

  const go = (days: number) => {
    tap();
    router.setParams({ key: shift(key, days) });
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Backdrop />
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + Space.sm, paddingBottom: insets.bottom + 40 }]}>
        <View style={styles.header}>
          <GlassButton icon="back" onPress={() => router.back()} />
          <View style={{ flex: 1, alignItems: 'center' }}>
            <T size={12} color={C.textDim} weight="600">
              Day log
            </T>
            <Comic size={28}>{title}</Comic>
          </View>
          <View style={{ width: 44 }} />
        </View>

        <View style={styles.nav}>
          <Pressable onPress={() => go(-1)} style={styles.navBtn} accessibilityLabel="Previous day">
            <Icon name="back" size={16} color={C.text} weight="bold" />
            <T size={12} rounded>
              PREV
            </T>
          </Pressable>
          {onTarget ? (
            <T size={12} rounded color={C.lime}>
              ON TARGET
            </T>
          ) : (
            <T size={12} rounded color={C.textMute}>
              {day.eaten > 0 ? 'OFF TARGET' : 'NO MEALS'}
            </T>
          )}
          <Pressable onPress={() => go(1)} disabled={isToday} style={[styles.navBtn, isToday && { opacity: 0.3 }]} accessibilityLabel="Next day">
            <T size={12} rounded>
              NEXT
            </T>
            <Icon name="chevron" size={16} color={C.text} weight="bold" />
          </Pressable>
        </View>

        {/* Fuel */}
        <Card style={{ gap: 12 }}>
          <View style={styles.row3}>
            <Stat label="EATEN" value={Math.round(day.eaten).toLocaleString()} color={C.eaten} />
            <Stat label="BURNED" value={Math.round(day.burned).toLocaleString()} color={C.burned} />
            <Stat label="NET" value={Math.round(net).toLocaleString()} sub={`of ${t.calories.toLocaleString()}`} color={onTarget ? C.lime : C.text} />
          </View>
          <Macro label="Protein" value={day.protein} target={t.protein} color={C.protein} unit="g" />
          <Macro label="Carbs" value={day.carbs} target={t.carbs} color={C.carbs} unit="g" />
          <Macro label="Fat" value={day.fat} target={t.fat} color={C.fat} unit="g" />
          <View style={{ gap: 6 }}>
            <View style={styles.between}>
              <T size={13} rounded>
                WATER
              </T>
              <T size={13} color={C.textDim}>
                <T size={13} rounded color={C.water}>
                  {fmtWater(day.water, profile.units)}
                </T>{' '}
                / {fmtWater(t.waterMl, profile.units)}
              </T>
            </View>
            <Bar value={day.water} max={t.waterMl} color={C.water} />
          </View>
          <T size={12} color={C.textMute} weight="700">
            {day.meals} MEAL{day.meals === 1 ? '' : 'S'} · {day.workouts} WORKOUT{day.workouts === 1 ? '' : 'S'} · {day.activeMin} ACTIVE MIN
          </T>
        </Card>

        {/* Mind */}
        <Card style={{ gap: 8, marginTop: Space.sm }} accent={mind.level ? LEVEL_COLOR[mind.level] + 'AA' : undefined}>
          <T size={12} rounded color={mind.level ? LEVEL_COLOR[mind.level] : C.textDim}>
            {mind.stress != null ? `STRESS ${mind.stress} · ${mind.level?.toUpperCase()}` : 'NO MIND CHECK-IN'}
          </T>
          <View style={styles.row3}>
            <Stat label="SLEEP" value={mind.sleepHours != null ? `${mind.sleepHours}h` : '—'} color={C.violet} />
            <Stat label="MOOD" value={mind.mood ? MOODS[Math.round(mind.mood) - 1].emoji : '—'} color={C.text} />
            <Stat label="ENERGY" value={mind.energy ? `${mind.energy.toFixed(0)}/5` : '—'} color={C.lime} />
          </View>
        </Card>

        {/* Quests: today is live (same card as HQ, with Claim); past days show how they ended */}
        {isToday ? (
          <>
            <SectionTitle>Quests</SectionTitle>
            <QuestsCard todayKey={key} />
          </>
        ) : (
          <>
            <SectionTitle right={<T size={12} rounded color={C.textMute}>{quests.filter((q) => q.claimed).length}/3 CLAIMED</T>}>Quests</SectionTitle>
            <Card style={{ gap: 10 }}>
              {quests.map((q) => (
                <View key={q.id} style={styles.between}>
                  <T size={14} rounded color={q.done ? C.text : C.textMute}>
                    {q.title}
                  </T>
                  <T size={12} rounded color={q.claimed ? C.lime : q.done ? C.yellow : C.textMute}>
                    {q.claimed ? 'CLAIMED' : q.done ? 'DONE' : 'MISSED'}
                  </T>
                </View>
              ))}
            </Card>
          </>
        )}

        {/* Log */}
        <SectionTitle right={<T size={12} rounded color={C.textMute}>{list.length} ENTRIES</T>}>Log</SectionTitle>
        {list.length === 0 ? (
          <Card style={{ alignItems: 'center', paddingVertical: Space.lg }}>
            <T size={13} color={C.textDim}>
              Nothing logged this day.
            </T>
          </Card>
        ) : (
          <View style={{ gap: 8 }}>
            {list.map((e) => (
              <EntryRow key={e.id} entry={e} />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function Stat({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <T size={11} rounded color={C.textDim}>
        {label}
      </T>
      <T size={24} rounded color={color}>
        {value}
      </T>
      {!!sub && (
        <T size={10} color={C.textMute} weight="700">
          {sub.toUpperCase()}
        </T>
      )}
    </View>
  );
}

function Macro({ label, value, target, color, unit }: { label: string; value: number; target: number; color: string; unit: string }) {
  return (
    <View style={{ gap: 6 }}>
      <View style={styles.between}>
        <T size={13} rounded>
          {label.toUpperCase()}
        </T>
        <T size={13} color={C.textDim}>
          <T size={13} rounded color={color}>
            {Math.round(value)}
          </T>{' '}
          / {target} {unit}
        </T>
      </View>
      <Bar value={value} max={target} color={color} />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: Space.md, gap: Space.sm, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: Space.xs },
  navBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: C.surfaceHi,
    borderWidth: 2,
    borderColor: C.ink,
  },
  row3: { flexDirection: 'row', gap: Space.sm },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
