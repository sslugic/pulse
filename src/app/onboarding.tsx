import type React from 'react';
import { Image } from 'expo-image';
import { useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AccountCard } from '@/components/account-card';
import { Icon, IconBadge, type IconName } from '@/components/icon';
import { Field, GOALS, inputStyle, ProfileFields } from '@/components/profile-form';
import { Chip, GradientButton, T, tap } from '@/components/ui';
import { Backdrop, Comic } from '@/components/underground';
import { C, MaxContentWidth, Space } from '@/constants/theme';
import { cloudConfigured } from '@/lib/cloud';
import { healthAvailable } from '@/lib/health';
import { locale, t } from '@/lib/i18n';
import { HEALTH_DISCLAIMER } from '@/lib/legal';
import { goalBlurb, macroTargets, paceLabel } from '@/lib/nutrition';
import { PERSONAS, personaById } from '@/lib/personas';
import { earnStarter } from '@/lib/starter-rewards';
import { actions, getState, useStore } from '@/lib/store';
import type { Pace, Profile } from '@/lib/types';

// First-run setup: what Pulse is, an optional account (which also restores a backup), the player's
// details, a goal, a coach, Apple Health and a reminder, then an optional tour of the app. Every
// optional step can be skipped and changed later in Crew.

type Step = 'welcome' | 'account' | 'about' | 'goal' | 'coach' | 'health' | 'reminder' | 'ready';

const PACES: Pace[] = ['gentle', 'standard', 'aggressive'];
const REMINDER_HOURS = [18, 20, 21];

export default function Onboarding() {
  const insets = useSafeAreaInsets();
  const steps: Step[] = [
    'welcome',
    ...(cloudConfigured ? (['account'] as const) : []),
    'about',
    'goal',
    'coach',
    ...(Platform.OS === 'ios' && healthAvailable() ? (['health'] as const) : []),
    'reminder',
    'ready',
  ];
  const [index, setIndex] = useState(0);
  const step = steps[index];
  const [p, setP] = useState<Profile>(getState().profile);
  // A backup restored by signing in (or the name from Apple) fills in the answers still to come.
  const stored = useStore((st) => st.profile);
  const [seen, setSeen] = useState(stored);
  if (stored !== seen) {
    setSeen(stored);
    setP((x) => ({ ...x, ...stored }));
  }
  const signedIn = useStore((st) => !!st.account.userId);
  const healthOn = useStore((st) => !!st.settings.health?.on);
  const reminderHour = useStore((st) => st.settings.reminderHour);
  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const set = (patch: Partial<Profile>) => setP((x) => ({ ...x, ...patch }));

  const go = (delta: number) => {
    tap();
    setIndex((i) => Math.min(steps.length - 1, Math.max(0, i + delta)));
    scroll.current?.scrollTo({ y: 0, animated: false });
  };

  const finish = (tour: boolean) => {
    // The coach is chosen straight into the store by the picker, so it isn't overwritten here.
    const { persona: _persona, ...rest } = p;
    actions.completeOnboarding(rest, { tour });
    earnStarter('profile').catch(() => {});
  };

  const targets = macroTargets(p);

  const primary: Record<Step, { label: string; onPress: () => void; disabled?: boolean }> = {
    welcome: { label: t('onboarding.getStarted'), onPress: () => go(1) },
    account: { label: signedIn ? t('onboarding.continue') : t('onboarding.skipForNow'), onPress: () => go(1) },
    about: { label: t('onboarding.continue'), onPress: () => go(1), disabled: !p.name.trim() },
    goal: { label: t('onboarding.continue'), onPress: () => go(1) },
    coach: { label: t('onboarding.continue'), onPress: () => go(1) },
    health: { label: healthOn ? t('onboarding.continue') : t('onboarding.skipForNow'), onPress: () => go(1) },
    reminder: { label: reminderHour != null ? t('onboarding.continue') : t('onboarding.skipForNow'), onPress: () => go(1) },
    ready: { label: t('onboarding.takeTour'), onPress: () => finish(true) },
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Backdrop />
      <ScrollView
        ref={scroll}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + Space.md, paddingBottom: Space.lg }]}
        keyboardShouldPersistTaps="handled">
        <View style={styles.topBar}>
          {index > 0 && step !== 'ready' ? (
            <Pressable onPress={() => go(-1)} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('onboarding.back')}>
              <Icon name="back" size={22} color={C.textDim} />
            </Pressable>
          ) : (
            <View style={{ width: 22 }} />
          )}
          <View style={styles.dots}>
            {steps.map((s, i) => (
              <View key={s} style={[styles.dot, i <= index && { backgroundColor: C.lime, width: i === index ? 22 : 10 }]} />
            ))}
          </View>
          <T size={12} rounded color={C.textMute} style={{ width: 40, textAlign: 'right' }}>
            {index + 1}/{steps.length}
          </T>
        </View>

        {step === 'welcome' && (
          <Animated.View entering={FadeIn.duration(400)} style={styles.hero}>
            <Image source={require('@/assets/images/icon.png')} style={styles.logo} />
            <Comic size={56} color={C.yellow}>
              PULSE
            </Comic>
            <Comic size={20}>{t('onboarding.tagline')}</Comic>
            <T size={17} color={C.textDim} style={{ textAlign: 'center', lineHeight: 24, maxWidth: 320 }}>
              {t('onboarding.intro')}
            </T>
            <View style={{ gap: 12, marginTop: Space.lg, alignSelf: 'stretch' }}>
              {(
                [
                  ['mic', C.violet, t('onboarding.featureVoice')],
                  ['camera', C.orange, t('onboarding.featureSnap')],
                  ['people', C.lime, t('onboarding.featureSquad')],
                  ['game', C.yellow, t('onboarding.featureArcade')],
                ] as const
              ).map(([i, color, text]) => (
                <View key={text} style={styles.feature}>
                  <IconBadge name={i} color={color} size={40} />
                  <T size={15} weight="600" style={{ flex: 1 }}>
                    {text}
                  </T>
                </View>
              ))}
            </View>
            <T size={12} color={C.textMute} style={{ textAlign: 'center' }}>
              {t('onboarding.takesAMinute')}
            </T>
          </Animated.View>
        )}

        {step === 'account' && (
          <Animated.View entering={FadeInDown.duration(350)} style={{ gap: 18 }}>
            <StepTitle icon="key" color={C.yellow} title={t('onboarding.accountTitle')} />
            <T size={14} color={C.textDim} style={{ lineHeight: 20 }}>
              {t('onboarding.accountBody')}
            </T>
            <Perks
              items={[
                ['sparkles', t('onboarding.perkCredits')],
                ['retry', t('onboarding.perkBackup')],
                ['people', t('onboarding.perkSquad')],
              ]}
            />
            <AccountCard />
            <T size={12} color={C.textMute} style={{ lineHeight: 17 }}>
              {t('onboarding.accountLater')}
            </T>
          </Animated.View>
        )}

        {step === 'about' && (
          <Animated.View entering={FadeInDown.duration(350)} style={{ gap: 18 }}>
            <StepTitle icon="person" color={C.cyan} title={t('onboarding.aboutTitle')} />
            <T size={14} color={C.textDim}>
              {t('onboarding.aboutBody')}
            </T>
            <Field label={t('onboarding.fieldName')}>
              <TextInput value={p.name} onChangeText={(name) => set({ name })} placeholder={t('onboarding.namePlaceholder')} placeholderTextColor={C.textMute} style={inputStyle} />
            </Field>
            <ProfileFields p={p} set={set} showGoal={false} />
          </Animated.View>
        )}

        {step === 'goal' && (
          <Animated.View entering={FadeInDown.duration(350)} style={{ gap: 18 }}>
            <StepTitle icon="target" color={C.lime} title={t('onboarding.goalTitle')} />
            <View style={{ gap: 10 }}>
              {GOALS.map((g) => (
                <Pressable
                  key={g.v}
                  onPress={() => (tap(), set({ goal: g.v }))}
                  style={[styles.option, p.goal === g.v && { borderColor: C.lime, backgroundColor: '#9CFF2E1A' }]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: p.goal === g.v }}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <T size={16} rounded color={C.text}>
                      {g.label}
                    </T>
                    <T size={12} color={C.textDim}>
                      {goalBlurb(g.v)}
                    </T>
                  </View>
                  {p.goal === g.v && <Icon name="check" size={18} color={C.lime} weight="bold" />}
                </Pressable>
              ))}
            </View>
            {p.goal !== 'maintain' && (
              <Field label={t('onboarding.paceLabel')}>
                <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                  {PACES.map((x) => (
                    <Chip key={x} label={paceLabel(x)} active={p.pace === x} onPress={() => set({ pace: x })} />
                  ))}
                </View>
              </Field>
            )}
            <View style={styles.targetBox}>
              <T size={13} color={C.textDim} weight="600">
                {t('onboarding.dailyTarget')}
              </T>
              <T size={28} weight="900" rounded color={C.lime}>
                {t('onboarding.kcal', { kcal: targets.calories.toLocaleString(locale) })}
              </T>
              <T size={13} rounded color={C.textDim}>
                {t('onboarding.macros', { p: targets.protein, c: targets.carbs, f: targets.fat })}
              </T>
              <T size={11} color={C.textMute} style={{ marginTop: 6 }}>
                {t('onboarding.goalLater')}
              </T>
            </View>
          </Animated.View>
        )}

        {step === 'coach' && (
          <Animated.View entering={FadeInDown.duration(350)} style={{ gap: 18 }}>
            <StepTitle icon="sparkles" color={C.violet} title={t('onboarding.coachTitle')} />
            <T size={14} color={C.textDim} style={{ lineHeight: 20 }}>
              {t('onboarding.coachBody')}
            </T>
            <StarterCoach />
          </Animated.View>
        )}

        {step === 'health' && (
          <Animated.View entering={FadeInDown.duration(350)} style={{ gap: 18 }}>
            <StepTitle icon="heart" color={C.pink} title={t('onboarding.healthTitle')} />
            <T size={14} color={C.textDim} style={{ lineHeight: 20 }}>
              {t('onboarding.healthBody')}
            </T>
            <Perks
              items={[
                ['figure', t('onboarding.healthWorkouts')],
                ['moon', t('onboarding.healthSleep')],
                ['scale', t('onboarding.healthWeight')],
              ]}
            />
            {healthOn ? (
              <Done text={t('onboarding.healthConnected')} />
            ) : (
              <GradientButton
                label={t('onboarding.connectHealth')}
                onPress={async () => {
                  if (!(await actions.connectHealth())) Alert.alert('Apple Health', t('crew.healthUnavailable'));
                }}
              />
            )}
            <T size={12} color={C.textMute} style={{ lineHeight: 17 }}>
              {t('crew.healthNote')}
            </T>
          </Animated.View>
        )}

        {step === 'reminder' && (
          <Animated.View entering={FadeInDown.duration(350)} style={{ gap: 18 }}>
            <StepTitle icon="flame" color={C.orange} title={t('onboarding.reminderTitle')} />
            <T size={14} color={C.textDim} style={{ lineHeight: 20 }}>
              {t('onboarding.reminderBody')}
            </T>
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              {REMINDER_HOURS.map((h) => (
                <Chip
                  key={h}
                  label={new Date(2000, 0, 1, h).toLocaleTimeString(locale, { hour: 'numeric' })}
                  active={reminderHour === h}
                  onPress={async () => {
                    if (!(await actions.setReminder(h))) Alert.alert(t('crew.notificationsOffTitle'), t('crew.notificationsOffBody'));
                  }}
                />
              ))}
            </View>
            {reminderHour != null && <Done text={t('onboarding.reminderSet')} />}
          </Animated.View>
        )}

        {step === 'ready' && (
          <Animated.View entering={FadeIn.duration(400)} style={[styles.hero, { marginTop: Space.md }]}>
            <Comic size={44} color={C.yellow} style={{ textAlign: 'center' }}>
              {t('onboarding.readyTitle', { name: p.name.split(' ')[0] || t('hq.player') })}
            </Comic>
            <T size={15} color={C.textDim} style={{ textAlign: 'center', lineHeight: 22 }}>
              {t('onboarding.readyBody')}
            </T>
            <View style={[styles.targetBox, { alignSelf: 'stretch', alignItems: 'center' }]}>
              <T size={13} color={C.textDim} weight="600">
                {t('onboarding.dailyTarget')}
              </T>
              <T size={30} weight="900" rounded color={C.lime}>
                {t('onboarding.kcal', { kcal: targets.calories.toLocaleString(locale) })}
              </T>
              <T size={13} rounded color={C.textDim}>
                {t('onboarding.macros', { p: targets.protein, c: targets.carbs, f: targets.fat })}
              </T>
            </View>
            <View style={{ gap: 8, alignSelf: 'stretch' }}>
              <Summary ok={signedIn} text={signedIn ? t('onboarding.sumAccount') : t('onboarding.sumNoAccount')} />
              <Summary ok={healthOn} text={healthOn ? t('onboarding.sumHealth') : t('onboarding.sumNoHealth')} />
              <Summary ok={reminderHour != null} text={reminderHour != null ? t('onboarding.sumReminder') : t('onboarding.sumNoReminder')} />
            </View>
            <T size={11} color={C.textMute} style={{ lineHeight: 15, textAlign: 'center' }}>
              {HEALTH_DISCLAIMER}
            </T>
          </Animated.View>
        )}

      </ScrollView>
      {/* The main button stays in reach on every step instead of scrolling with the content. */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + Space.sm }]}>
        <GradientButton label={primary[step].label} onPress={primary[step].onPress} disabled={primary[step].disabled} />
        {step === 'ready' && (
          <Pressable onPress={() => (tap(), finish(false))} style={{ alignSelf: 'center', padding: 10 }}>
            <T size={14} rounded color={C.textDim}>
              {t('onboarding.skipTour')}
            </T>
          </Pressable>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

function StarterCoach() {
  const current = personaById(useStore((st) => st.profile.persona)).id;
  return (
    <View style={{ gap: 10 }}>
      {PERSONAS.map((x) => {
        const on = x.id === current;
        return (
          <Pressable
            key={x.id}
            onPress={() => (tap(), actions.pickStarterCoach(x.id))}
            style={[styles.option, on && { borderColor: C.violet, backgroundColor: '#A267FF1F' }]}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}>
            <T size={28}>{x.emoji}</T>
            <View style={{ flex: 1, gap: 2 }}>
              <Comic size={20} color={on ? C.text : C.textDim}>
                {x.name.toUpperCase()}
              </Comic>
              <T size={12} color={C.textDim}>
                {x.tagline}
              </T>
            </View>
            {on && <Icon name="check" size={18} color={C.violet} weight="bold" />}
          </Pressable>
        );
      })}
    </View>
  );
}

function StepTitle({ icon, color, title }: { icon: IconName; color: string; title: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <IconBadge name={icon} color={color} size={44} />
      <Comic size={34} style={{ flex: 1 }}>
        {title}
      </Comic>
    </View>
  );
}

function Perks({ items }: { items: [IconName, string][] }) {
  return (
    <View style={{ gap: 10 }}>
      {items.map(([icon, text]) => (
        <View key={text} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Icon name={icon} size={18} color={C.lime} />
          <T size={14} color={C.text} style={{ flex: 1 }}>
            {text}
          </T>
        </View>
      ))}
    </View>
  );
}

function Done({ text }: { text: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Icon name="check" size={18} color={C.lime} weight="bold" />
      <T size={14} rounded color={C.lime}>
        {text}
      </T>
    </View>
  );
}

function Summary({ ok, text }: { ok: boolean; text: string }) {
  return (
    <View style={styles.summary}>
      <Icon name={ok ? 'check' : 'minus'} size={16} color={ok ? C.lime : C.textMute} weight="bold" />
      <T size={13} color={ok ? C.text : C.textDim} style={{ flex: 1 }}>
        {text}
      </T>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, paddingHorizontal: Space.lg, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  footer: { paddingHorizontal: Space.lg, paddingTop: Space.sm, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', backgroundColor: C.bg + 'E6' },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Space.lg },
  dots: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  dot: { height: 6, width: 6, borderRadius: 3, backgroundColor: C.surfaceHi },
  hero: { alignItems: 'center', gap: 14, marginTop: Space.sm },
  logo: { width: 84, height: 84, borderRadius: 20, marginBottom: 4 },
  feature: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: C.surface, padding: 14, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, borderWidth: 2, borderColor: C.ink, backgroundColor: C.surface },
  targetBox: { backgroundColor: C.surface, borderRadius: 20, padding: 18, gap: 4, borderWidth: 1, borderColor: C.lime + '44' },
  summary: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 12, backgroundColor: C.surface },
});
