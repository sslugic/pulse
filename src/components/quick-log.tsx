import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { C, Space } from '@/constants/theme';
import { t } from '@/lib/i18n';
import { dayKey, fmtWater, macroTargets, summarize } from '@/lib/nutrition';
import { actions, useStore } from '@/lib/store';
import { dayWellbeing, MOODS } from '@/lib/wellbeing';

import { Icon } from './icon';
import { Bar, Card, T, tap } from './ui';

const SLEEP = [5, 6, 7, 8, 9];

/** One-tap water, mood and sleep logging at the top of HQ, so nothing needs a scroll. */
export function QuickLog({ todayKey }: { todayKey: string }) {
  const entries = useStore((s) => s.entries);
  const profile = useStore((s) => s.profile);
  const targets = macroTargets(profile);
  const water = useMemo(() => summarize(entries, todayKey).water, [entries, todayKey]);
  const mind = useMemo(() => dayWellbeing(entries, todayKey), [entries, todayKey]);
  // The latest quick mood/sleep today, so the chosen chip stays lit.
  const latest = useMemo(() => {
    const today = entries.filter((e) => e.kind === 'journal' && dayKey(e.createdAt) === todayKey);
    return { mood: today.find((e) => e.mood != null)?.mood, sleep: today.find((e) => e.sleepHours != null)?.sleepHours };
  }, [entries, todayKey]);

  const addWater = (ml: number) => {
    tap();
    actions.addEntry({ kind: 'water', title: ml === 250 ? t('hq.glassOfWater') : t('hq.bottleOfWater'), emoji: '💧', waterMl: ml, source: 'quick' });
  };
  const logMood = (mood: number) => {
    tap();
    actions.checkIn({ mood });
  };
  const logSleep = (h: number) => {
    tap();
    actions.checkIn({ sleepHours: h });
  };

  return (
    <Card style={{ gap: 14, marginTop: Space.sm }} accent={C.cyan + '88'}>
      <View style={styles.head}>
        <T size={13} rounded color={C.text} style={{ flex: 1 }}>
          {t('hq.quickLog')}
        </T>
        <Pressable onPress={() => router.push('/wellbeing')} style={styles.link} accessibilityRole="button">
          <T size={11} rounded color={C.pink}>
            {mind.stress != null ? t('hq.stressScore', { n: mind.stress }) : t('wellbeing.mindRecovery')}
          </T>
          <Icon name="chevron" size={11} color={C.pink} />
        </Pressable>
      </View>

      {/* Water */}
      <View style={styles.row}>
        <Icon name="drop" size={18} color={C.water} />
        <View style={{ flex: 1, gap: 4 }}>
          <T size={12} color={C.textDim} weight="700">
            <T size={13} rounded color={C.water}>
              {fmtWater(water, profile.units)}
            </T>{' '}
            / {fmtWater(targets.waterMl, profile.units)}
          </T>
          <Bar value={water} max={targets.waterMl} color={C.water} height={5} />
        </View>
        {[250, 500].map((ml) => (
          <Pressable key={ml} onPress={() => addWater(ml)} style={({ pressed }) => [styles.chip, styles.waterChip, pressed && styles.pressed]} accessibilityLabel={t('hq.addWater', { amount: fmtWater(ml, profile.units) })}>
            <T size={12} rounded color={C.water}>
              +{fmtWater(ml, profile.units)}
            </T>
          </Pressable>
        ))}
      </View>

      {/* Mood */}
      <View style={styles.row}>
        <T size={11} rounded color={C.textMute} style={styles.label}>
          {t('hq.mood')}
        </T>
        <View style={styles.spread}>
          {MOODS.map((m) => {
            const on = latest.mood === m.v;
            return (
              <Pressable key={m.v} onPress={() => logMood(m.v)} style={({ pressed }) => [styles.mood, on && styles.on, pressed && styles.pressed]} accessibilityLabel={t('hq.moodLabel', { mood: m.label })}>
                <T size={22}>{m.emoji}</T>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Sleep */}
      <View style={styles.row}>
        <T size={11} rounded color={C.textMute} style={styles.label}>
          {t('hq.sleep')}
        </T>
        <View style={styles.spread}>
          {SLEEP.map((h) => {
            const on = latest.sleep === h;
            return (
              <Pressable key={h} onPress={() => logSleep(h)} style={({ pressed }) => [styles.chip, styles.sleepChip, on && styles.on, pressed && styles.pressed]} accessibilityLabel={t('hq.sleptHoursLabel', { count: h })}>
                <T size={12} rounded color={on ? C.text : C.violet}>
                  {h}h
                </T>
              </Pressable>
            );
          })}
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center' },
  link: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { width: 44 },
  spread: { flex: 1, flexDirection: 'row', justifyContent: 'space-between' },
  chip: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8, borderWidth: 2, borderColor: C.ink, borderBottomWidth: 4 },
  waterChip: { backgroundColor: '#1B2A3C' },
  sleepChip: { backgroundColor: '#251B3A', minWidth: 44, alignItems: 'center' },
  mood: { width: 44, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1D2023', borderWidth: 2, borderColor: 'transparent' },
  on: { borderColor: C.lime, backgroundColor: '#22301A' },
  pressed: { transform: [{ translateY: 2 }] },
});
