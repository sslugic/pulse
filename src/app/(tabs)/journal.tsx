import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@/components/icon';
import { MomentArt } from '@/components/moment-art';
import { openCoach } from '@/components/quick-fab';
import { Card, T, tap } from '@/components/ui';
import { Backdrop, Comic, Sticker } from '@/components/underground';
import { C, MaxContentWidth, Space } from '@/constants/theme';
import { dayKey, fmtKg, fmtWater, summarize } from '@/lib/nutrition';
import { sceneFor } from '@/lib/scene';
import { useStore } from '@/lib/store';
import type { Entry } from '@/lib/types';
import { useTodayKey } from '@/lib/use-today';
import { dayWellbeing, LEVEL_COLOR, moodEmoji } from '@/lib/wellbeing';

const STICKER_COLORS = [C.violet, C.orange, C.pink, C.cyan, C.lime];

/** A journal entry worth a full panel: something was said, tagged or photographed, not just a quick tap. */
const isMoment = (e: Entry) => e.kind === 'journal' && (!!e.summary || !!e.photo || !!e.tags?.length);

/** Every logged day as a comic page: illustrated moments, how it felt, and what else went in the log. */
export default function JournalScreen() {
  const insets = useSafeAreaInsets();
  const entries = useStore((s) => s.entries);
  const units = useStore((s) => s.profile.units);
  const todayKey = useTodayKey();

  const days = useMemo(() => {
    const groups = new Map<string, Entry[]>();
    for (const e of entries) {
      const k = dayKey(e.createdAt);
      groups.set(k, [...(groups.get(k) ?? []), e]);
    }
    return [...groups.entries()].slice(0, 30);
  }, [entries]);

  const moments = useMemo(() => entries.filter(isMoment).length, [entries]);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Backdrop tags={['DIARY', 'PULSE']} />
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + Space.sm, paddingBottom: 120 }]}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <T size={13} color={C.textDim} weight="600">
              Your days, drawn
            </T>
            <Comic size={40}>JOURNAL</Comic>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <T size={22} rounded color={C.pink}>
              {moments}
            </T>
            <T size={10} rounded color={C.textMute}>
              MOMENTS
            </T>
          </View>
        </View>

        <Pressable onPress={() => router.push('/recap')} style={({ pressed }) => [styles.recap, pressed && { transform: [{ translateY: 2 }] }]} accessibilityRole="button">
          <T size={20}>📰</T>
          <View style={{ flex: 1 }}>
            <T size={13} rounded color={C.ink}>
              YOUR WEEKLY RECAP
            </T>
            <T size={11} color={C.ink}>
              Your last 7 days as a comic page, ready to share
            </T>
          </View>
          <Icon name="chevron" size={14} color={C.ink} />
        </Pressable>

        <Pressable onPress={() => openCoach('voice')} style={({ pressed }) => [styles.prompt, pressed && { transform: [{ translateY: 2 }] }]} accessibilityRole="button">
          <Icon name="mic" size={18} color={C.pink} />
          <T size={13} rounded color={C.pink} style={{ flex: 1 }}>
            TELL THE COACH ABOUT YOUR DAY
          </T>
          <Icon name="chevron" size={14} color={C.pink} />
        </Pressable>

        {days.length === 0 ? (
          <Card style={{ alignItems: 'center', gap: 8, paddingVertical: Space.xl }}>
            <Comic size={24} color={C.lime}>
              BLANK PAGES
            </Comic>
            <T size={13} color={C.textDim} style={{ textAlign: 'center', lineHeight: 19 }}>
              Tell the Coach something like “Amazing day, went to the beach, swam for a while and grabbed lunch with friends”. It turns up here as a page.
            </T>
          </Card>
        ) : (
          days.map(([k, list]) => <DayPage key={k} dayKey={k} todayKey={todayKey} list={list} units={units} />)
        )}
      </ScrollView>
    </View>
  );
}

function dayTitle(k: string, todayKey: string) {
  const y = new Date(todayKey + 'T12:00');
  y.setDate(y.getDate() - 1);
  if (k === todayKey) return 'TODAY';
  if (k === dayKey(y)) return 'YESTERDAY';
  return new Date(k + 'T12:00').toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' }).toUpperCase();
}

function DayPage({ dayKey: k, todayKey, list, units }: { dayKey: string; todayKey: string; list: Entry[]; units: 'metric' | 'imperial' }) {
  const mind = dayWellbeing(list, k);
  const sum = summarize(list, k);
  const moments = list.filter(isMoment).slice().reverse();
  const weight = list.find((e) => e.kind === 'weight' && e.weightKg);
  const tags = [...new Set(moments.flatMap((m) => m.tags ?? []))].slice(0, 5);

  const facts: { icon: IconName; color: string; text: string }[] = [];
  if (mind.sleepHours != null) facts.push({ icon: 'moon', color: C.violet, text: `${mind.sleepHours}h sleep` });
  if (sum.meals) facts.push({ icon: 'fork', color: C.orange, text: `${sum.meals} meal${sum.meals === 1 ? '' : 's'} · ${Math.round(sum.eaten)} kcal` });
  if (sum.workouts) facts.push({ icon: 'dumbbell', color: C.lime, text: `${sum.workouts} workout${sum.workouts === 1 ? '' : 's'} · ${sum.activeMin} min` });
  if (sum.water) facts.push({ icon: 'drop', color: C.water, text: fmtWater(sum.water, units) });
  if (weight?.weightKg) facts.push({ icon: 'scale', color: C.violet, text: fmtKg(weight.weightKg, units) });

  return (
    <View style={{ marginTop: Space.md }}>
      <Pressable
        onPress={() => {
          tap();
          router.push({ pathname: '/day/[key]', params: { key: k } });
        }}
        style={styles.dayHead}
        accessibilityRole="button"
        accessibilityLabel={`Open ${dayTitle(k, todayKey)}`}>
        <Comic size={22} color={k === todayKey ? C.orange : C.text}>
          {dayTitle(k, todayKey)}
        </Comic>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {mind.mood != null && <T size={22}>{moodEmoji(mind.mood)}</T>}
          {mind.level && (
            <View style={[styles.pill, { backgroundColor: LEVEL_COLOR[mind.level] }]}>
              <T size={9} rounded color={C.ink}>
                STRESS {mind.stress}
              </T>
            </View>
          )}
          <Icon name="chevron" size={14} color={C.textMute} />
        </View>
      </Pressable>

      <Card style={{ gap: 14 }} accent={mind.level ? LEVEL_COLOR[mind.level] + '77' : undefined}>
        {moments.length === 0 ? (
          <T size={13} color={C.textDim} style={{ lineHeight: 19 }}>
            No story for this day yet. Tell the Coach what happened and it becomes a panel here.
          </T>
        ) : (
          moments.map((m) => (
            <View key={m.id} style={{ gap: 8 }}>
              <MomentArt scene={sceneFor(m)} mood={m.mood ?? mind.mood} photo={!!m.photo} />
              <T size={15} color={C.text} style={{ lineHeight: 21 }}>
                {m.summary || m.title}
              </T>
              <T size={11} rounded color={C.textMute}>
                {new Date(m.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                {m.energy != null ? ` · ENERGY ${Math.round(m.energy)}/5` : ''}
              </T>
              {!!m.note && (
                <View style={styles.note}>
                  <Icon name="sparkles" size={12} color={C.violet} />
                  <T size={12} color={C.textDim} style={{ flex: 1, lineHeight: 17 }}>
                    {m.note}
                  </T>
                </View>
              )}
            </View>
          ))
        )}

        {tags.length > 0 && (
          <View style={styles.tags}>
            {tags.map((t, i) => (
              <Sticker key={t} text={t.toUpperCase()} color={STICKER_COLORS[i % STICKER_COLORS.length]} rotate={i % 2 ? 3 : -3} size={13} />
            ))}
          </View>
        )}

        {facts.length > 0 && (
          <View style={styles.facts}>
            {facts.map((f) => (
              <View key={f.text} style={styles.fact}>
                <Icon name={f.icon} size={13} color={f.color} />
                <T size={12} rounded color={C.textDim}>
                  {f.text}
                </T>
              </View>
            ))}
          </View>
        )}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: Space.md, gap: Space.sm, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  recap: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 10, backgroundColor: C.yellow, borderWidth: 2, borderColor: C.ink, borderBottomWidth: 4 },
  prompt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 10,
    backgroundColor: '#2A1424',
    borderWidth: 2,
    borderColor: C.pink + '88',
    borderBottomWidth: 4,
  },
  dayHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4, marginBottom: 6 },
  pill: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  note: { flexDirection: 'row', gap: 6, alignItems: 'flex-start', padding: 8, borderRadius: 8, backgroundColor: '#1D1A2A' },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingTop: 2 },
  facts: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingTop: 10, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)' },
  fact: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 6, backgroundColor: '#1D2023' },
});
