import { StyleSheet, TextInput, View } from 'react-native';

import { C, Radius } from '@/constants/theme';
import { t } from '@/lib/i18n';
import type { Activity, Goal, Profile } from '@/lib/types';

import { Chip, T } from './ui';

export const GOALS: { v: Goal; label: string }[] = [
  { v: 'lose', label: t('crew.goalLose') },
  { v: 'recomp', label: t('crew.goalRecomp') },
  { v: 'maintain', label: t('crew.goalMaintain') },
  { v: 'gain', label: t('crew.goalGain') },
];

export const ACTIVITIES: { v: Activity; label: string }[] = [
  { v: 'sedentary', label: t('crew.activitySedentary') },
  { v: 'light', label: t('crew.activityLight') },
  { v: 'moderate', label: t('crew.activityModerate') },
  { v: 'active', label: t('crew.activityActive') },
  { v: 'athlete', label: t('crew.activityAthlete') },
];

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 8 }}>
      <T size={12} weight="700" color={C.textDim} style={{ letterSpacing: 0.8, textTransform: 'uppercase' }}>
        {label}
      </T>
      {children}
    </View>
  );
}

export function NumInput({ value, onChange, suffix }: { value: number; onChange: (n: number) => void; suffix: string }) {
  return (
    <View style={styles.num}>
      <TextInput
        value={value ? String(value) : ''}
        onChangeText={(s) => onChange(Number(s.replace(/[^0-9.]/g, '')) || 0)}
        keyboardType="decimal-pad"
        style={styles.numText}
        selectTextOnFocus
      />
      <T size={13} color={C.textMute} weight="600">
        {suffix}
      </T>
    </View>
  );
}

/** Body + goal fields shared by onboarding and Profile. Stores metric; shows the user's units. */
export function ProfileFields({ p, set, showGoal = true }: { p: Profile; set: (patch: Partial<Profile>) => void; showGoal?: boolean }) {
  const imp = p.units === 'imperial';
  return (
    <View style={{ gap: 18 }}>
      <Field label={t('crew.fieldUnits')}>
        <View style={styles.row}>
          <Chip label={t('crew.unitsMetric')} active={!imp} onPress={() => set({ units: 'metric' })} />
          <Chip label={t('crew.unitsImperial')} active={imp} onPress={() => set({ units: 'imperial' })} />
        </View>
      </Field>
      <Field label={t('crew.fieldSex')}>
        <View style={styles.row}>
          <Chip label={t('crew.sexMale')} active={p.sex === 'male'} onPress={() => set({ sex: 'male' })} />
          <Chip label={t('crew.sexFemale')} active={p.sex === 'female'} onPress={() => set({ sex: 'female' })} />
        </View>
      </Field>
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Field label={t('crew.fieldAge')}>
            <NumInput value={p.age} onChange={(age) => set({ age })} suffix={t('crew.ageSuffix')} />
          </Field>
        </View>
        <View style={{ flex: 1 }}>
          <Field label={t('crew.fieldHeight')}>
            <NumInput
              value={imp ? Math.round(p.heightCm / 2.54) : p.heightCm}
              onChange={(n) => set({ heightCm: imp ? Math.round(n * 2.54) : n })}
              suffix={imp ? 'in' : 'cm'}
            />
          </Field>
        </View>
        <View style={{ flex: 1 }}>
          <Field label={t('crew.fieldWeight')}>
            <NumInput
              value={imp ? Math.round(p.weightKg * 2.20462) : p.weightKg}
              onChange={(n) => set({ weightKg: imp ? Math.round((n / 2.20462) * 10) / 10 : n })}
              suffix={imp ? 'lb' : 'kg'}
            />
          </Field>
        </View>
      </View>
      {showGoal && (
        <Field label={t('crew.fieldGoal')}>
          <View style={styles.wrap}>
            {GOALS.map((g) => (
              <Chip key={g.v} label={g.label} active={p.goal === g.v} onPress={() => set({ goal: g.v })} />
            ))}
          </View>
        </Field>
      )}
      <Field label={t('crew.fieldActivity')}>
        <View style={styles.wrap}>
          {ACTIVITIES.map((a) => (
            <Chip key={a.v} label={a.label} active={p.activity === a.v} color={C.cyan} onPress={() => set({ activity: a.v })} />
          ))}
        </View>
      </Field>
    </View>
  );
}

export const inputStyle = {
  backgroundColor: C.surface,
  borderRadius: Radius.md,
  borderWidth: StyleSheet.hairlineWidth,
  borderColor: C.border,
  color: C.text,
  fontSize: 16,
  paddingHorizontal: 16,
  height: 52,
} as const;

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  num: { ...inputStyle, flexDirection: 'row', alignItems: 'center', gap: 6 },
  numText: { flex: 1, color: C.text, fontSize: 18, fontWeight: '700' },
});
