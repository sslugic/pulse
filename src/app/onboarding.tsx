import type React from 'react';
import { Image } from 'expo-image';
import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconBadge } from '@/components/icon';
import { Field, inputStyle, ProfileFields } from '@/components/profile-form';
import { GradientButton, T } from '@/components/ui';
import { Backdrop, Comic } from '@/components/underground';
import { C, MaxContentWidth, Space } from '@/constants/theme';
import { calorieTarget } from '@/lib/nutrition';
import { AccountCard } from '@/components/account-card';
import { cloudConfigured } from '@/lib/cloud';
import { HEALTH_DISCLAIMER } from '@/lib/legal';
import { actions, getState, useStore } from '@/lib/store';
import type { Profile } from '@/lib/types';

export default function Onboarding() {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0);
  const [p, setP] = useState<Profile>(getState().profile);
  const signedIn = useStore((st) => !!st.account.userId);
  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const set = (patch: Partial<Profile>) => setP((x) => ({ ...x, ...patch }));

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Backdrop />
      <ScrollView
        ref={scroll}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + Space.lg, paddingBottom: insets.bottom + Space.lg }]}
        keyboardShouldPersistTaps="handled">
        <View style={styles.dots}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={[styles.dot, i <= step && { backgroundColor: C.lime, width: 22 }]} />
          ))}
        </View>

        {step === 0 && (
          <Animated.View entering={FadeIn.duration(400)} style={styles.hero}>
            <Image source={require('@/assets/images/icon.png')} style={styles.logo} />
            <Comic size={56} color={C.yellow}>
              PULSE
            </Comic>
            <Comic size={20}>THE UNDERGROUND FITNESS CREW</Comic>
            <T size={17} color={C.textDim} style={{ textAlign: 'center', lineHeight: 24, maxWidth: 320 }}>
              Your AI fitness coach. Just talk, snap a photo, or type a few words — calories, macros and burn are worked out for you.
            </T>
            <View style={{ gap: 12, marginTop: Space.lg, alignSelf: 'stretch' }}>
              {(
                [
                  ['mic', C.violet, 'Say “I had a burrito and a beer”'],
                  ['camera', C.orange, 'Snap your plate or the treadmill screen'],
                  ['chart', C.cyan, 'See calories in vs out, macros and trends'],
                ] as const
              ).map(([i, color, t]) => (
                <View key={t} style={styles.feature}>
                  <IconBadge name={i} color={color} size={40} />
                  <T size={15} weight="600" style={{ flex: 1 }}>
                    {t}
                  </T>
                </View>
              ))}
            </View>
          </Animated.View>
        )}

        {step === 1 && (
          <Animated.View entering={FadeInDown.duration(350)} style={{ gap: 18 }}>
            <Comic size={38}>ABOUT YOU</Comic>
            <T size={14} color={C.textDim}>
              Used to estimate calorie burn and set your daily targets.
            </T>
            <Field label="Name">
              <TextInput value={p.name} onChangeText={(name) => set({ name })} placeholder="Your first name" placeholderTextColor={C.textMute} style={inputStyle} />
            </Field>
            <ProfileFields p={p} set={set} />
            <View style={styles.targetBox}>
              <T size={13} color={C.textDim} weight="600">
                Daily target
              </T>
              <T size={28} weight="900" rounded color={C.lime}>
                {calorieTarget(p).toLocaleString()} kcal
              </T>
            </View>
          </Animated.View>
        )}

        {step === 2 && cloudConfigured && (
          <Animated.View entering={FadeInDown.duration(350)} style={{ gap: 18 }}>
            <Comic size={38}>JOIN THE CREW</Comic>
            <T size={14} color={C.textDim} style={{ lineHeight: 20 }}>
              The Coach, plans and recaps run on AI credits. Sign in to start with 50 free and keep your progress backed up.
            </T>
            <AccountCard />
            <T size={11} color={C.textMute} style={{ lineHeight: 15 }}>
              {HEALTH_DISCLAIMER}
            </T>
          </Animated.View>
        )}

        <View style={{ flex: 1 }} />
        <GradientButton
          label={step === 0 ? 'Get started' : step === 1 ? 'Continue' : signedIn ? 'Start logging' : 'Skip for now'}
          onPress={() => {
            if (step < 2) {
              setStep(step + 1);
              scroll.current?.scrollTo({ y: 0, animated: false });
            } else actions.completeOnboarding(p);
          }}
          style={{ marginTop: Space.xl }}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, paddingHorizontal: Space.lg, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  dots: { flexDirection: 'row', gap: 6, marginBottom: Space.xl },
  dot: { height: 6, width: 6, borderRadius: 3, backgroundColor: C.surfaceHi },
  hero: { alignItems: 'center', gap: 14, marginTop: Space.lg },
  logo: { width: 108, height: 108, borderRadius: 26, marginBottom: Space.sm },
  feature: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: C.surface, padding: 16, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border },
  targetBox: { backgroundColor: C.surface, borderRadius: 20, padding: 18, gap: 4, borderWidth: 1, borderColor: C.lime + '44' },
});
