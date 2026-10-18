import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassButton, Icon, IconBadge } from '@/components/icon';
import { Bar, Card, Chip, Ring, SectionTitle, T, tap } from '@/components/ui';
import { C, MaxContentWidth, Radius, Space } from '@/constants/theme';
import { wellbeingInsight, type WellbeingInsight } from '@/lib/gemini';
import { journalPhotoUri, pickImage } from '@/lib/media';
import { dayKey, lastNDays } from '@/lib/nutrition';
import { actions, getState, useStore } from '@/lib/store';
import { useTodayKey } from '@/lib/use-today';
import { dayWellbeing, impactFor, LEVEL_COLOR, MOODS, moodEmoji, patterns } from '@/lib/wellbeing';

export default function WellbeingScreen() {
  const insets = useSafeAreaInsets();
  const entries = useStore((s) => s.entries);
  const profile = useStore((s) => s.profile);
  const thinking = useStore((s) => s.thinking);
  const hasKey = useStore((s) => !!s.settings.apiKey);
  const todayKey = useTodayKey();

  const today = useMemo(() => dayWellbeing(entries, todayKey), [entries, todayKey]);
  const week = useMemo(() => lastNDays(14, new Date(todayKey + 'T12:00')).map((k) => dayWellbeing(entries, k)), [entries, todayKey]);
  const found = useMemo(() => patterns(entries, profile), [entries, profile]);
  const journal = useMemo(() => {
    const groups = new Map<string, typeof entries>();
    for (const e of entries) {
      if (e.kind !== 'journal' || (!e.summary && !e.photo && !e.tags?.length)) continue;
      const k = dayKey(e.createdAt);
      groups.set(k, [...(groups.get(k) ?? []), e]);
    }
    return [...groups.entries()].slice(0, 14);
  }, [entries]);

  const color = today.level ? LEVEL_COLOR[today.level] : C.textMute;
  const impact = today.level ? impactFor(today.level, profile.goal) : null;

  const [insight, setInsight] = useState<WellbeingInsight | null>(null);
  const [loading, setLoading] = useState(() => !!getState().settings.apiKey);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    const s = getState();
    if (!s.settings.apiKey) return;
    let cancelled = false;
    wellbeingInsight({ apiKey: s.settings.apiKey, model: s.settings.model, profile: s.profile, entries: s.entries })
      .catch(() => ({ headline: 'Couldn’t reach Gemini', body: 'Check your connection and tap refresh.', tips: [] }))
      .then((r) => {
        if (cancelled) return;
        setInsight(r);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refresh]);
  const loadInsight = () => {
    setLoading(true);
    setRefresh((n) => n + 1);
  };

  const logMood = (mood: number) => {
    tap();
    actions.addEntry({ kind: 'journal', title: 'Mood check-in', emoji: moodEmoji(mood), mood, source: 'quick' });
  };
  const logSleep = (h: number) => {
    tap();
    actions.addEntry({ kind: 'journal', title: `Slept ${h}h`, emoji: '😴', sleepHours: h, source: 'quick' });
  };
  const addMoment = async (from: 'camera' | 'library') => {
    const img = await pickImage(from);
    if (!img) return;
    await actions.sendToCoach({ image: img, text: 'Add this to my journal as a moment from today.' });
  };
  const talk = () => {
    router.back();
    router.navigate({ pathname: '/coach', params: { mode: 'voice', t: String(Date.now()) } });
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <T size={13} color={C.textDim} weight="600">
            Stress, sleep & journal
          </T>
          <T size={28} weight="800" rounded>
            Mind & recovery
          </T>
        </View>
        <GlassButton icon="close" onPress={() => router.back()} />
      </View>

      {/* Today */}
      <LinearGradient colors={['#1A1626', '#0F0E15']} style={[styles.hero, { borderColor: color + '44' }]}>
        {today.stress != null ? (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18 }}>
              <Ring size={128} stroke={12} progress={today.stress / 100} colors={[color, color]}>
                <T size={38} weight="900" rounded color={color}>
                  {today.stress}
                </T>
                <T size={10} color={C.textMute} weight="800">
                  / 100
                </T>
              </Ring>
              <View style={{ flex: 1, gap: 6 }}>
                <T size={12} weight="800" color={color} style={{ letterSpacing: 1 }}>
                  {today.level?.toUpperCase()} STRESS
                </T>
                <T size={18} weight="800">
                  {impact?.title}
                </T>
                <T size={13} color={C.textDim} style={{ lineHeight: 18 }}>
                  {impact?.body}
                </T>
              </View>
            </View>
            <View style={{ gap: 10 }}>
              {today.parts.map((p) => (
                <View key={p.key} style={{ gap: 5 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <T size={12} weight="700" color={C.textDim}>
                      {p.label}
                    </T>
                    <T size={12} weight="800" color={C.text}>
                      {Math.round(p.value)}
                    </T>
                  </View>
                  <Bar value={p.value} max={100} color={LEVEL_COLOR[p.value < 30 ? 'low' : p.value < 55 ? 'moderate' : p.value < 75 ? 'high' : 'very high']} height={6} />
                </View>
              ))}
            </View>
          </>
        ) : (
          <View style={{ alignItems: 'center', gap: 8, paddingVertical: Space.sm }}>
            <IconBadge name="brain" color={C.pink} size={52} />
            <T size={16} weight="800">
              No check-in yet today
            </T>
            <T size={13} color={C.textDim} style={{ textAlign: 'center', lineHeight: 19 }}>
              Log how you feel and how you slept. Pulse turns it into a stress score and shows how it’s affecting your progress.
            </T>
          </View>
        )}
      </LinearGradient>

      {/* Check-ins */}
      <SectionTitle>How do you feel?</SectionTitle>
      <Card style={styles.moods}>
        {MOODS.map((m) => {
          const on = today.mood != null && Math.round(today.mood) === m.v;
          return (
            <Pressable key={m.v} onPress={() => logMood(m.v)} style={({ pressed }) => [styles.mood, on && { backgroundColor: C.pink + '22' }, pressed && { transform: [{ scale: 0.9 }] }]}>
              <T size={30}>{m.emoji}</T>
              <T size={11} color={on ? C.pink : C.textMute} weight="700">
                {m.label}
              </T>
            </Pressable>
          );
        })}
      </Card>

      <SectionTitle right={today.sleepHours != null ? <T size={12} color={C.violet} weight="700">{today.sleepHours}h logged</T> : undefined}>Last night’s sleep</SectionTitle>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 2 }}>
        {[4, 5, 5.5, 6, 6.5, 7, 7.5, 8, 9].map((h) => (
          <Chip key={h} label={`${h}h`} active={today.sleepHours === h} color={C.violet} onPress={() => logSleep(h)} />
        ))}
      </ScrollView>

      <View style={styles.actions}>
        <ActionTile icon="mic" label="Talk about your day" color={C.pink} onPress={talk} />
        <ActionTile icon="photoAdd" label="Add a photo moment" color={C.cyan} onPress={() => addMoment('library')} busy={thinking} />
        <ActionTile icon="camera" label="Snap a moment" color={C.orange} onPress={() => addMoment('camera')} busy={thinking} />
      </View>

      {/* AI coaching */}
      {hasKey && (
        <>
          <SectionTitle
            right={
              <Pressable onPress={loadInsight} hitSlop={8} disabled={loading}>
                <Icon name="retry" size={14} color={C.textDim} />
              </Pressable>
            }>
            Coach on your progress
          </SectionTitle>
          <Card style={{ gap: 10 }}>
            {loading && !insight ? (
              <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                <ActivityIndicator color={C.pink} />
                <T size={13} color={C.textDim}>
                  Connecting your stress, sleep and food…
                </T>
              </View>
            ) : insight ? (
              <>
                <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                  <Icon name="sparkles" size={16} color={C.pink} />
                  <T size={16} weight="800" style={{ flex: 1 }}>
                    {insight.headline}
                  </T>
                </View>
                <T size={14} color={C.text} style={{ lineHeight: 20 }}>
                  {insight.body}
                </T>
                {insight.tips.map((tip, i) => (
                  <View key={i} style={{ flexDirection: 'row', gap: 8 }}>
                    <T size={13} weight="900" color={C.pink}>
                      {i + 1}
                    </T>
                    <T size={13} color={C.textDim} style={{ flex: 1, lineHeight: 19 }}>
                      {tip}
                    </T>
                  </View>
                ))}
              </>
            ) : null}
          </Card>
        </>
      )}

      {/* Trends */}
      <SectionTitle>Last 14 days</SectionTitle>
      <Card style={{ gap: 14 }}>
        <TrendRow label="Stress" days={week} value={(d) => d.stress} max={100} color={(d) => (d.level ? LEVEL_COLOR[d.level] : C.textMute)} />
        <TrendRow label="Sleep" days={week} value={(d) => d.sleepHours} max={10} color={() => C.violet} />
        <View style={{ gap: 6 }}>
          <T size={11} weight="700" color={C.textMute}>
            MOOD
          </T>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            {week.map((d) => (
              <T key={d.key} size={14} style={{ width: 20, textAlign: 'center', opacity: d.mood ? 1 : 0.25 }}>
                {d.mood ? moodEmoji(d.mood) : '·'}
              </T>
            ))}
          </View>
        </View>
      </Card>

      {/* Patterns */}
      <SectionTitle>Your patterns</SectionTitle>
      <Card style={{ gap: 12 }}>
        {found.length ? (
          found.map((p, i) => (
            <View key={i} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
              <Icon name={p.tone === 'warn' ? 'warning' : p.tone === 'good' ? 'heart' : 'chart'} size={15} color={p.tone === 'warn' ? C.orange : p.tone === 'good' ? C.lime : C.cyan} />
              <T size={13} style={{ flex: 1, lineHeight: 19 }}>
                {p.text}
              </T>
            </View>
          ))
        ) : (
          <T size={13} color={C.textDim} style={{ lineHeight: 19 }}>
            Check in for a few days and I’ll show how your sleep and stress line up with what you eat and how you train.
          </T>
        )}
      </Card>

      {/* Journal */}
      <SectionTitle>Journal</SectionTitle>
      {journal.length === 0 ? (
        <Card>
          <T size={13} color={C.textDim} style={{ lineHeight: 19 }}>
            Tell the Coach what happened today, or add a photo of something worth remembering. It all lands here.
          </T>
        </Card>
      ) : (
        journal.map(([k, list]) => (
          <View key={k} style={{ gap: 8, marginBottom: Space.sm }}>
            <T size={13} weight="800" color={C.textDim} style={{ paddingHorizontal: 4 }}>
              {k === todayKey ? 'Today' : new Date(k + 'T12:00').toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })}
            </T>
            {list.map((e) => (
              <Card key={e.id} style={{ gap: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <T size={22}>{e.mood ? moodEmoji(e.mood) : e.emoji}</T>
                  <View style={{ flex: 1 }}>
                    <T size={15} weight="700" numberOfLines={1}>
                      {e.title}
                    </T>
                    <T size={11} color={C.textMute}>
                      {new Date(e.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                      {e.sleepHours != null ? ` · slept ${e.sleepHours}h` : ''}
                      {e.stress != null ? ` · stress ${Math.round(e.stress)}/10` : ''}
                    </T>
                  </View>
                </View>
                {!!e.photo && <Image source={{ uri: journalPhotoUri(e.photo) }} style={styles.photo} contentFit="cover" />}
                {!!e.summary && (
                  <T size={14} style={{ lineHeight: 20 }}>
                    {e.summary}
                  </T>
                )}
                {!!e.tags?.length && (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                    {e.tags.map((t) => (
                      <View key={t} style={styles.tag}>
                        <T size={11} weight="700" color={C.pink}>
                          {t}
                        </T>
                      </View>
                    ))}
                  </View>
                )}
              </Card>
            ))}
          </View>
        ))
      )}
    </ScrollView>
  );
}

function TrendRow({
  label,
  days,
  value,
  max,
  color,
}: {
  label: string;
  days: ReturnType<typeof dayWellbeing>[];
  value: (d: ReturnType<typeof dayWellbeing>) => number | undefined;
  max: number;
  color: (d: ReturnType<typeof dayWellbeing>) => string;
}) {
  return (
    <View style={{ gap: 6 }}>
      <T size={11} weight="700" color={C.textMute}>
        {label.toUpperCase()}
      </T>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 54 }}>
        {days.map((d) => {
          const v = value(d);
          return (
            <View key={d.key} style={{ width: 20, alignItems: 'center' }}>
              <View style={{ width: 10, borderRadius: 5, height: v != null ? Math.max(4, (v / max) * 54) : 4, backgroundColor: v != null ? color(d) : C.surfaceHi }} />
            </View>
          );
        })}
      </View>
    </View>
  );
}

function ActionTile({ icon, label, color, onPress, busy }: { icon: 'mic' | 'photoAdd' | 'camera'; label: string; color: string; onPress: () => void; busy?: boolean }) {
  return (
    <Pressable
      disabled={busy}
      onPress={() => {
        tap();
        onPress();
      }}
      style={({ pressed }) => [styles.action, { opacity: busy ? 0.5 : 1 }, pressed && { transform: [{ scale: 0.96 }] }]}>
      <IconBadge name={icon} color={color} size={40} />
      <T size={12} weight="700" style={{ textAlign: 'center' }}>
        {label}
      </T>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { padding: Space.md, paddingTop: Space.lg, gap: Space.sm, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: Space.sm },
  hero: { borderRadius: Radius.lg, padding: Space.md, gap: 18, borderWidth: 1 },
  moods: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 8 },
  mood: { alignItems: 'center', gap: 4, paddingVertical: 8, paddingHorizontal: 6, borderRadius: 16 },
  actions: { flexDirection: 'row', gap: 8, marginTop: Space.md },
  action: { flex: 1, alignItems: 'center', gap: 8, padding: 12, borderRadius: Radius.md, backgroundColor: C.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border },
  photo: { width: '100%', aspectRatio: 4 / 3, borderRadius: 14 },
  tag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: C.pink + '1F' },
});
