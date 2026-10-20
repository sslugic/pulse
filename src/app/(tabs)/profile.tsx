import { router } from 'expo-router';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, IconBadge } from '@/components/icon';
import { AccountCard } from '@/components/account-card';
import { PersonaPicker } from '@/components/persona-picker';
import { Field, inputStyle, ProfileFields } from '@/components/profile-form';
import { Card, Chip, SectionTitle, T } from '@/components/ui';
import { Backdrop, Comic, MetalPanel } from '@/components/underground';
import { C, MaxContentWidth, Space } from '@/constants/theme';
import { COACH_VOICES } from '@/lib/gemini';
import { GOAL_INFO, macroTargets, PACE_INFO } from '@/lib/nutrition';
import { actions, useStore } from '@/lib/store';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const profile = useStore((s) => s.profile);
  const settings = useStore((s) => s.settings);
  const entries = useStore((s) => s.entries);
  const t = macroTargets(profile);

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Backdrop />
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + Space.md, paddingBottom: Space.xl }]} keyboardShouldPersistTaps="handled">
        <Comic size={42}>THE CREW</Comic>

        <MetalPanel onPress={() => router.push('/goals')} accent={C.lime + '99'} style={{ marginTop: Space.sm }} innerStyle={{ gap: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <IconBadge name="target" color={C.lime} size={40} />
              <View style={{ flex: 1 }}>
                <T size={12} color={C.textDim} weight="700" style={{ letterSpacing: 0.8, textTransform: 'uppercase' }}>
                  Nutrition plan
                </T>
                <T size={17} weight="800">
                  {GOAL_INFO[profile.goal].label}
                  {profile.goal !== 'maintain' ? <T size={13} color={C.textDim}> · {PACE_INFO[profile.pace]}</T> : null}
                </T>
              </View>
              <Icon name="chevron" size={16} color={C.textMute} />
            </View>
            <View style={styles.targets}>
              <Target label="kcal" value={t.calories} color={C.lime} />
              <Target label="protein" value={t.protein} unit="g" color={C.protein} />
              <Target label="carbs" value={t.carbs} unit="g" color={C.carbs} />
              <Target label="fat" value={t.fat} unit="g" color={C.fat} />
            </View>
            <T size={12} rounded color={C.cyan}>
              SET A GOAL WITH AI OR EDIT TARGETS →
            </T>
        </MetalPanel>

        <SectionTitle>Account & credits</SectionTitle>
        <AccountCard />

        <SectionTitle>Your coach</SectionTitle>
        <PersonaPicker />

        <SectionTitle>Apple Health</SectionTitle>
        <Card style={{ gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <IconBadge name="heart" color={C.pink} size={36} />
            <View style={{ flex: 1 }}>
              <T size={14} rounded color={C.text}>
                {settings.health?.on ? 'CONNECTED' : 'NOT CONNECTED'}
              </T>
              <T size={12} color={C.textDim}>
                {settings.health?.lastSync ? `Last synced ${new Date(settings.health.lastSync).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' })}` : 'Workouts, sleep, weight and steps log themselves.'}
              </T>
            </View>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {settings.health?.on ? (
              <>
                <Chip
                  label="Sync now"
                  onPress={async () => {
                    const n = await actions.syncHealth();
                    Alert.alert('Apple Health', n ? `Imported ${n} new ${n === 1 ? 'entry' : 'entries'}.` : 'Everything is up to date.');
                  }}
                />
                <Chip label="Disconnect" onPress={() => actions.disconnectHealth()} />
              </>
            ) : (
              <Chip
                label="Connect Apple Health"
                active
                onPress={async () => {
                  if (!(await actions.connectHealth())) Alert.alert('Apple Health', 'Health isn’t available on this device, or access was declined. You can allow it in the Health app under Sharing.');
                }}
              />
            )}
          </View>
          <T size={12} color={C.textMute}>
            Pulse only reads from Health and never writes to it. Imported workouts and weigh-ins earn XP like any other log.
          </T>
        </Card>

        <SectionTitle>Streak reminder</SectionTitle>
        <Card style={{ gap: 12 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {[undefined, 18, 20, 21].map((h) => (
              <Chip
                key={String(h)}
                label={h == null ? 'Off' : `${h - 12} pm`}
                active={settings.reminderHour === h}
                onPress={async () => {
                  if (!(await actions.setReminder(h))) Alert.alert('Notifications are off', 'Allow notifications for Pulse in iPhone Settings to get streak reminders.');
                }}
              />
            ))}
          </View>
          <T size={12} color={C.textMute}>
            One nudge in the evening, only on days you haven’t logged anything yet.
          </T>
        </Card>

        <SectionTitle>Coach voice</SectionTitle>
        <Card style={{ gap: 12 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {[...COACH_VOICES, { id: 'device', label: 'Offline' }].map((v) => (
              <Chip
                key={v.id}
                label={v.id === 'device' ? v.label : `${v.id} · ${v.label}`}
                active={settings.coachVoice === v.id}
                onPress={() => {
                  actions.setCoachVoice(v.id);
                  actions.speakMessage('voice-preview', "Hey, I'm your Pulse coach. Let's crush today's goals together!");
                }}
              />
            ))}
          </View>
          <T size={12} color={C.textMute}>
            Natural voices come from Google Gemini and use AI credits. Offline uses the iPhone’s built-in voice.
          </T>
        </Card>

        <SectionTitle>Your details</SectionTitle>
        <Card style={{ gap: 18 }}>
          <Field label="Name">
            <TextInput value={profile.name} onChangeText={(name) => actions.updateProfile({ name })} placeholder="Your first name" placeholderTextColor={C.textMute} style={inputStyle} />
          </Field>
          <ProfileFields p={profile} set={actions.updateProfile} showGoal={false} />
        </Card>

        <SectionTitle>Data</SectionTitle>
        <Card style={{ gap: 12 }}>
          <T size={13} color={C.textDim}>
            {entries.length} entries stored on this device.
          </T>
          <Pressable
            onPress={() =>
              Alert.alert('Erase everything?', 'This deletes all logs, chat and your profile from this device.', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Erase', style: 'destructive', onPress: actions.resetAll },
              ])
            }>
            <T size={14} color={C.danger} weight="700">
              Erase all data
            </T>
          </Pressable>
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Target({ label, value, unit = '', color }: { label: string; value: number; unit?: string; color: string }) {
  return (
    <View style={{ alignItems: 'center', flex: 1, gap: 2 }}>
      <T size={20} weight="800" rounded color={color}>
        {value.toLocaleString()}
        {unit}
      </T>
      <T size={11} color={C.textDim} weight="600">
        {label}
      </T>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: Space.md, gap: Space.sm, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  targets: { flexDirection: 'row' },
});
