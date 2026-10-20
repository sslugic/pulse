import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { C } from '@/constants/theme';
import { tap } from '@/lib/haptics';
import { t } from '@/lib/i18n';
import { summarize, targets as getTargets } from '@/lib/nutrition';
import { actions, useStore } from '@/lib/store';
import { dayWellbeing, impactFor, LEVEL_COLOR, LEVEL_LABEL, MOODS, moodEmoji, patterns } from '@/lib/wellbeing';

import { Icon, IconBadge } from './icon';
import { Ring, T } from './ui';
import { MetalPanel } from './underground';

/**
 * Today's stress, sleep and mood, tied to today's nutrition and the user's own history,
 * so the numbers explain each other instead of living on separate screens.
 */
export function WellbeingCard({ todayKey, onTalk }: { todayKey: string; onTalk: () => void }) {
  const entries = useStore((s) => s.entries);
  const profile = useStore((s) => s.profile);
  const w = useMemo(() => dayWellbeing(entries, todayKey), [entries, todayKey]);
  const day = useMemo(() => summarize(entries, todayKey), [entries, todayKey]);
  const history = useMemo(() => patterns(entries, profile), [entries, profile]);
  const tg = getTargets(profile);

  const logMood = (mood: number) => {
    tap();
    actions.addEntry({ kind: 'journal', title: t('wellbeing.moodCheckIn'), emoji: moodEmoji(mood), mood, source: 'quick' });
  };

  const color = w.level ? LEVEL_COLOR[w.level] : C.textMute;
  const links = correlate(w, day, tg, profile.goal, history);

  return (
    <MetalPanel onPress={() => router.push('/wellbeing')} accent={w.level ? color + 'CC' : undefined} innerStyle={styles.card}>
        <View style={styles.head}>
          <IconBadge name="brain" color={C.pink} size={32} />
          <T size={15} rounded style={{ flex: 1 }}>
            {t('wellbeing.mindRecovery')}
          </T>
          {w.level && (
            <View style={[styles.pill, { backgroundColor: color }]}>
              <T size={10} rounded color={C.ink}>
                {LEVEL_LABEL[w.level].toUpperCase()}
              </T>
            </View>
          )}
          <Icon name="chevron" size={14} color={C.textMute} />
        </View>

        {w.stress != null ? (
          <View style={styles.stats}>
            <Ring size={84} stroke={9} progress={w.stress / 100} colors={[color, color]}>
              <T size={24} weight="900" rounded color={color}>
                {w.stress}
              </T>
              <T size={9} color={C.textMute} weight="700">
                {t('wellbeing.stressCaps')}
              </T>
            </Ring>
            <View style={styles.trio}>
              <Stat icon="moon" color={C.violet} label={t('wellbeing.sleep')} value={w.sleepHours != null ? `${w.sleepHours}h` : '—'} />
              <Stat emoji={moodEmoji(w.mood)} label={t('wellbeing.mood')} value={w.mood ? MOODS[Math.round(w.mood) - 1].label : '—'} />
              <Stat icon="bolt" color={C.lime} label={t('wellbeing.energy')} value={w.energy ? `${w.energy.toFixed(0)}/5` : '—'} />
            </View>
          </View>
        ) : (
          <T size={13} color={C.textDim} style={{ lineHeight: 19 }}>
            {t('wellbeing.cardEmpty')}
          </T>
        )}

        {w.mood == null && (
          <View style={styles.moods}>
            {MOODS.map((m) => (
              <Pressable key={m.v} onPress={() => logMood(m.v)} style={({ pressed }) => [styles.mood, pressed && { transform: [{ scale: 0.9 }] }]}>
                <T size={26}>{m.emoji}</T>
                <T size={10} color={C.textMute} weight="700">
                  {m.label}
                </T>
              </Pressable>
            ))}
          </View>
        )}

        {links.map((l, i) => (
          <View key={i} style={styles.link}>
            <Icon name={l.icon} size={14} color={l.color} />
            <T size={13} color={C.text} style={{ flex: 1, lineHeight: 19 }}>
              {l.text}
            </T>
          </View>
        ))}

        <Pressable
          onPress={() => {
            tap();
            onTalk();
          }}
          style={({ pressed }) => [styles.talk, pressed && { opacity: 0.7 }]}>
          <Icon name="mic" size={14} color={C.pink} />
          <T size={13} rounded color={C.pink}>
            {w.notes.length ? t('wellbeing.addToJournal') : t('wellbeing.tellMe')}
          </T>
        </Pressable>
    </MetalPanel>
  );
}

type Link = { text: string; icon: 'warning' | 'sparkles' | 'flame' | 'dumbbell' | 'moon'; color: string };

/** Connect today's strain with today's food and the user's own patterns. */
function correlate(
  w: ReturnType<typeof dayWellbeing>,
  day: ReturnType<typeof summarize>,
  tg: ReturnType<typeof getTargets>,
  goal: Parameters<typeof impactFor>[1],
  history: ReturnType<typeof patterns>,
): Link[] {
  if (!w.level) return [];
  const out: Link[] = [{ text: impactFor(w.level, goal).body, icon: w.stress! >= 55 ? 'warning' : 'sparkles', color: LEVEL_COLOR[w.level] }];
  const left = tg.calories + day.burned - day.eaten;
  const proteinPct = tg.protein ? day.protein / tg.protein : 1;
  const stressed = w.stress! >= 55;
  const shortSleep = w.sleepHours != null && w.sleepHours < 6.5;

  if (stressed && left < 0) {
    out.push({ text: t('wellbeing.linkOver', { n: Math.abs(Math.round(left)) }), icon: 'flame', color: C.orange });
  } else if ((stressed || shortSleep) && proteinPct < 0.6 && day.meals > 0) {
    out.push({
      text: t('wellbeing.linkProtein', { pct: Math.round(proteinPct * 100), g: tg.protein }),
      icon: 'dumbbell',
      color: C.protein,
    });
  } else if (stressed && left > 300) {
    out.push({ text: t('wellbeing.linkLeft', { n: Math.round(left) }), icon: 'flame', color: C.lime });
  }

  const sleepPattern = history.find((p) => p.kind === 'sleep');
  if (shortSleep && sleepPattern) out.push({ text: t('wellbeing.headsUp', { text: sleepPattern.text }), icon: 'moon', color: C.violet });
  const stressPattern = history.find((p) => p.kind === 'stress');
  if (stressed && stressPattern) out.push({ text: t('wellbeing.headsUp', { text: stressPattern.text }), icon: 'warning', color: C.orange });

  return out.slice(0, 3);
}

function Stat({ icon, emoji, color, label, value }: { icon?: 'moon' | 'bolt'; emoji?: string; color?: string; label: string; value: string }) {
  return (
    <View style={{ alignItems: 'center', gap: 4, flex: 1 }}>
      {emoji ? <T size={20}>{emoji}</T> : <Icon name={icon!} size={20} color={color} />}
      <T size={15} weight="800" rounded>
        {value}
      </T>
      <T size={10} color={C.textMute} weight="700">
        {label.toUpperCase()}
      </T>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 14 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, borderWidth: 2, borderColor: C.ink, transform: [{ rotate: '-3deg' }] },
  stats: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  trio: { flex: 1, flexDirection: 'row' },
  moods: { flexDirection: 'row', justifyContent: 'space-between' },
  mood: { alignItems: 'center', gap: 2, paddingVertical: 6, paddingHorizontal: 4, borderRadius: 14 },
  link: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  talk: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#2A1424',
    borderWidth: 2,
    borderColor: C.ink,
    borderBottomWidth: 4,
  },
});
