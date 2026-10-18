import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassButton, Icon, IconBadge, type IconName } from '@/components/icon';
import { Card, Chip, GradientButton, SectionTitle, T, tap } from '@/components/ui';
import { C, Gradients, MaxContentWidth, Radius, Space } from '@/constants/theme';
import { planGoal } from '@/lib/gemini';
import { fmtWater, GOAL_INFO, PACE_INFO, recommendedTargets, targets as getTargets, tdee } from '@/lib/nutrition';
import { actions, getState, useStore } from '@/lib/store';
import type { Goal, Pace, Targets } from '@/lib/types';

const GOAL_ICON: Record<Goal, { icon: IconName; color: string }> = {
  lose: { icon: 'flame', color: C.orange },
  recomp: { icon: 'bolt', color: C.lime },
  maintain: { icon: 'heart', color: C.pink },
  gain: { icon: 'dumbbell', color: C.cyan },
};

const IDEAS = ['Build muscle and lose fat', 'Lose 5 kg by summer', 'Bulk for strength training', 'Run a half marathon', 'Stay lean, eat more protein'];

const ROWS: { key: keyof Targets; label: string; unit: string; step: number; icon: IconName; color: string }[] = [
  { key: 'calories', label: 'Calories', unit: 'kcal', step: 50, icon: 'flame', color: C.lime },
  { key: 'protein', label: 'Protein', unit: 'g', step: 5, icon: 'dumbbell', color: C.protein },
  { key: 'carbs', label: 'Carbs', unit: 'g', step: 5, icon: 'bolt', color: C.carbs },
  { key: 'fat', label: 'Fat', unit: 'g', step: 5, icon: 'drop', color: C.fat },
  { key: 'fiber', label: 'Fiber', unit: 'g', step: 1, icon: 'leaf', color: C.cyan },
  { key: 'waterMl', label: 'Water', unit: 'ml', step: 250, icon: 'drop', color: C.water },
];

export default function GoalsScreen() {
  const insets = useSafeAreaInsets();
  const profile = useStore((s) => s.profile);
  const t = getTargets(profile);
  const rec = recommendedTargets(profile);
  const maintenance = Math.round(tdee(profile) / 10) * 10;
  const kgPerWeek = ((t.calories - maintenance) * 7) / 7700;

  const [request, setRequest] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function buildPlan(text = request) {
    if (!text.trim()) return;
    const s = getState();
    setBusy(true);
    setError(null);
    try {
      const plan = await planGoal({ apiKey: s.settings.apiKey, model: s.settings.model, profile: s.profile, request: text });
      actions.applyPlan(plan);
      setRequest('');
      tap();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const macroKcal = t.protein * 4 + t.carbs * 4 + t.fat * 9;
  const edited = !!profile.custom && Object.keys(profile.custom).length > 0;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <T size={13} color={C.textDim} weight="600">
              Your daily targets
            </T>
            <T size={28} weight="800" rounded>
              Nutrition plan
            </T>
          </View>
          <GlassButton icon="close" onPress={() => router.back()} />
        </View>

        {/* AI planner */}
        <LinearGradient colors={['#1A1F2E', '#11141C']} style={styles.ai}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <LinearGradient colors={Gradients.brand} style={styles.aiIcon}>
              <Icon name="wand" size={18} color="#07080C" weight="bold" />
            </LinearGradient>
            <View style={{ flex: 1 }}>
              <T size={16} weight="800">
                Tell me your goal
              </T>
              <T size={12} color={C.textDim}>
                I’ll set calories and macros for your body.
              </T>
            </View>
          </View>
          <TextInput
            value={request}
            onChangeText={setRequest}
            placeholder="e.g. I want to build muscle and lose some belly fat"
            placeholderTextColor={C.textMute}
            style={styles.aiInput}
            multiline
            returnKeyType="done"
            submitBehavior="blurAndSubmit"
            onSubmitEditing={() => buildPlan()}
          />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {IDEAS.map((i) => (
              <Chip key={i} label={i} onPress={() => buildPlan(i)} />
            ))}
          </ScrollView>
          {busy ? (
            <View style={styles.busy}>
              <ActivityIndicator color={C.lime} />
              <T size={14} color={C.textDim} weight="600">
                Building your plan…
              </T>
            </View>
          ) : (
            <GradientButton label="Build my plan" onPress={() => buildPlan()} disabled={!request.trim()} icon={<Icon name="sparkles" size={18} color="#07080C" />} />
          )}
          {error && (
            <T size={13} color={C.danger}>
              {error}
            </T>
          )}
        </LinearGradient>

        {!!profile.planNote && (
          <Card style={styles.note}>
            <Icon name="sparkles" size={16} color={C.lime} />
            <T size={14} style={{ flex: 1, lineHeight: 20 }}>
              {profile.planNote}
            </T>
          </Card>
        )}

        {/* Goal */}
        <SectionTitle>Goal</SectionTitle>
        <View style={styles.grid}>
          {(Object.keys(GOAL_INFO) as Goal[]).map((g) => {
            const on = profile.goal === g;
            const { icon, color } = GOAL_ICON[g];
            return (
              <Pressable
                key={g}
                onPress={() => {
                  tap();
                  actions.setGoal(g);
                }}
                style={({ pressed }) => [styles.goal, on && { borderColor: color, backgroundColor: color + '14' }, pressed && { opacity: 0.8 }]}>
                <IconBadge name={icon} color={color} size={38} />
                <T size={15} weight="800">
                  {GOAL_INFO[g].label}
                </T>
                <T size={12} color={C.textDim} style={{ lineHeight: 16 }}>
                  {GOAL_INFO[g].blurb}
                </T>
              </Pressable>
            );
          })}
        </View>

        {profile.goal !== 'maintain' && (
          <>
            <SectionTitle
              right={
                <T size={12} color={C.textDim}>
                  ≈ {kgPerWeek > 0 ? '+' : ''}
                  {profile.units === 'imperial' ? `${(kgPerWeek * 2.20462).toFixed(1)} lb` : `${kgPerWeek.toFixed(2)} kg`} / week
                </T>
              }>
              Pace
            </SectionTitle>
            <View style={styles.segment}>
              {(Object.keys(PACE_INFO) as Pace[]).map((p) => {
                const on = profile.pace === p;
                return (
                  <Pressable
                    key={p}
                    onPress={() => {
                      tap();
                      actions.setGoal(profile.goal, p);
                    }}
                    style={[styles.segBtn, on && styles.segOn]}>
                    <T size={14} weight="700" color={on ? '#07080C' : C.textDim}>
                      {PACE_INFO[p]}
                    </T>
                  </Pressable>
                );
              })}
            </View>
          </>
        )}

        {/* Targets */}
        <SectionTitle
          right={
            edited ? (
              <Pressable onPress={() => actions.resetTargets()} hitSlop={8}>
                <T size={12} color={C.cyan} weight="700">
                  Reset to recommended
                </T>
              </Pressable>
            ) : (
              <T size={12} color={C.textMute}>
                Tap ± to fine-tune
              </T>
            )
          }>
          Daily targets
        </SectionTitle>
        <Card style={{ gap: 4, paddingVertical: 8 }}>
          {ROWS.map((r) => (
            <TargetRow
              key={r.key}
              row={r}
              value={t[r.key]}
              recommended={rec[r.key]}
              custom={profile.custom?.[r.key] != null}
              units={profile.units}
            />
          ))}
        </Card>
        <MacroSplit p={t.protein} c={t.carbs} f={t.fat} />
        <T size={12} color={C.textMute} style={{ paddingHorizontal: 4, lineHeight: 17 }}>
          Maintenance ≈ {maintenance.toLocaleString()} kcal (Mifflin-St Jeor × activity).{' '}
          {Math.abs(macroKcal - t.calories) > 60 && `Your macros add up to ${Math.round(macroKcal)} kcal. `}
          Protein is set per kg of body weight for your goal.
        </T>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function TargetRow({
  row,
  value,
  recommended,
  custom,
  units,
}: {
  row: (typeof ROWS)[number];
  value: number;
  recommended: number;
  custom: boolean;
  units: 'metric' | 'imperial';
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    if (draft == null) return;
    const n = Math.round(Number(draft.replace(/[^0-9.]/g, '')));
    if (n > 0) actions.setTarget(row.key, n === recommended ? undefined : n);
    setDraft(null);
  };
  const bump = (dir: 1 | -1) => {
    tap();
    const n = Math.max(row.step, value + dir * row.step);
    actions.setTarget(row.key, n === recommended ? undefined : n);
  };
  const display = row.key === 'waterMl' ? fmtWater(value, units) : `${value.toLocaleString()} ${row.unit}`;

  return (
    <View style={styles.row}>
      <IconBadge name={row.icon} color={row.color} size={34} />
      <View style={{ flex: 1, gap: 2 }}>
        <T size={14} weight="700">
          {row.label}
        </T>
        <T size={11} color={custom ? C.orange : C.textMute} weight="600">
          {custom ? `Edited · rec. ${recommended.toLocaleString()}` : 'Recommended'}
        </T>
      </View>
      <Pressable onPress={() => bump(-1)} style={styles.step} hitSlop={4}>
        <Icon name="minus" size={14} color={C.text} weight="bold" />
      </Pressable>
      {draft != null ? (
        <TextInput
          value={draft}
          onChangeText={setDraft}
          onBlur={commit}
          onSubmitEditing={commit}
          keyboardType="number-pad"
          autoFocus
          selectTextOnFocus
          style={[styles.valueBox, styles.valueInput, { color: row.color }]}
        />
      ) : (
        <Pressable onPress={() => setDraft(String(value))} style={styles.valueBox}>
          <T size={15} weight="800" rounded color={row.color} numberOfLines={1}>
            {display}
          </T>
        </Pressable>
      )}
      <Pressable onPress={() => bump(1)} style={styles.step} hitSlop={4}>
        <Icon name="plus" size={14} color={C.text} weight="bold" />
      </Pressable>
    </View>
  );
}

function MacroSplit({ p, c, f }: { p: number; c: number; f: number }) {
  const kp = p * 4, kc = c * 4, kf = f * 9;
  const total = kp + kc + kf || 1;
  const parts = [
    { label: 'Protein', pct: kp / total, color: C.protein },
    { label: 'Carbs', pct: kc / total, color: C.carbs },
    { label: 'Fat', pct: kf / total, color: C.fat },
  ];
  return (
    <View style={{ gap: 8, marginTop: Space.sm, paddingHorizontal: 4 }}>
      <View style={{ flexDirection: 'row', height: 10, gap: 3 }}>
        {parts.map((x) => (
          <View key={x.label} style={{ flex: x.pct, backgroundColor: x.color, borderRadius: 5 }} />
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: 14 }}>
        {parts.map((x) => (
          <T key={x.label} size={12} color={C.textDim} weight="600">
            <T size={12} color={x.color} weight="800">
              {Math.round(x.pct * 100)}%
            </T>{' '}
            {x.label}
          </T>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: Space.md, paddingTop: Space.lg, gap: Space.sm, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: Space.sm },
  ai: { borderRadius: Radius.lg, padding: Space.md, gap: 14, borderWidth: 1, borderColor: C.lime + '33' },
  aiIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  aiInput: {
    minHeight: 64,
    backgroundColor: C.bg,
    borderRadius: Radius.md,
    padding: 14,
    paddingTop: 12,
    color: C.text,
    fontSize: 15,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.border,
  },
  busy: { height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  note: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginTop: Space.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Space.sm },
  goal: {
    width: '48.5%',
    flexGrow: 1,
    gap: 6,
    padding: 14,
    borderRadius: Radius.md + 2,
    backgroundColor: C.surface,
    borderWidth: 1.5,
    borderColor: C.border,
  },
  segment: { flexDirection: 'row', backgroundColor: C.surface, borderRadius: Radius.pill, padding: 4, gap: 4 },
  segBtn: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: Radius.pill },
  segOn: { backgroundColor: C.lime },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  step: { width: 32, height: 32, borderRadius: 16, backgroundColor: C.surfaceHi, alignItems: 'center', justifyContent: 'center' },
  valueBox: { minWidth: 92, alignItems: 'center', paddingHorizontal: 6 },
  valueInput: { fontSize: 15, fontWeight: '800', textAlign: 'center', paddingVertical: 4, backgroundColor: C.surfaceHi, borderRadius: 10 },
});
