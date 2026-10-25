import { router } from 'expo-router';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, IconBadge } from '@/components/icon';
import { AccountCard } from '@/components/account-card';
import { AppIconPicker } from '@/components/app-icon-picker';
import { WallPicker } from '@/components/wall-picker';
import { PersonaPicker } from '@/components/persona-picker';
import { TagAvatar } from '@/components/tag-avatar';
import { Field, inputStyle, ProfileFields } from '@/components/profile-form';
import { Card, Chip, SectionTitle, T } from '@/components/ui';
import { Backdrop, Comic, MetalPanel } from '@/components/underground';
import { C, MaxContentWidth, Space } from '@/constants/theme';
import type { AvatarId } from '@/lib/avatars';
import { locale, t } from '@/lib/i18n';
import { goalLabel, macroTargets, paceLabel } from '@/lib/nutrition';
import { NOTIFY_KINDS } from '@/lib/reminders';
import { actions, useStore } from '@/lib/store';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const profile = useStore((s) => s.profile);
  const settings = useStore((s) => s.settings);
  const entries = useStore((s) => s.entries);
  const targets = macroTargets(profile);

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Backdrop />
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + Space.md, paddingBottom: Space.xl }]} keyboardShouldPersistTaps="handled">
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Comic size={42}>{t('crew.title')}</Comic>
          <Pressable onPress={() => router.push('/avatars')} accessibilityRole="button" accessibilityLabel={t('crew.avatar')} style={({ pressed }) => [{ alignItems: 'center', gap: 2 }, pressed && { opacity: 0.7 }]}>
            <TagAvatar size={56} online={false} letter={(profile.name || 'P')[0]} avatar={profile.avatar as AvatarId | undefined} />
            <T size={11} rounded color={C.cyan}>
              {t('crew.avatar')} ›
            </T>
          </Pressable>
        </View>

        <MetalPanel onPress={() => router.push('/goals')} accent={C.lime + '99'} style={{ marginTop: Space.sm }} innerStyle={{ gap: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <IconBadge name="target" color={C.lime} size={40} />
              <View style={{ flex: 1 }}>
                <T size={12} color={C.textDim} weight="700" style={{ letterSpacing: 0.8, textTransform: 'uppercase' }}>
                  {t('crew.nutritionPlan')}
                </T>
                <T size={17} weight="800">
                  {goalLabel(profile.goal)}
                  {profile.goal !== 'maintain' ? <T size={13} color={C.textDim}> · {paceLabel(profile.pace)}</T> : null}
                </T>
              </View>
              <Icon name="chevron" size={16} color={C.textMute} />
            </View>
            <View style={styles.targets}>
              <Target label={t('crew.targetKcal')} value={targets.calories} color={C.lime} />
              <Target label={t('crew.targetProtein')} value={targets.protein} unit="g" color={C.protein} />
              <Target label={t('crew.targetCarbs')} value={targets.carbs} unit="g" color={C.carbs} />
              <Target label={t('crew.targetFat')} value={targets.fat} unit="g" color={C.fat} />
            </View>
            <T size={12} rounded color={C.cyan}>
              {t('crew.setGoalCta')}
            </T>
        </MetalPanel>

        <SectionTitle>{t('crew.sectionAccount')}</SectionTitle>
        <AccountCard />

        <SectionTitle>{t('crew.sectionCoach')}</SectionTitle>
        <PersonaPicker />

        <SectionTitle>Apple Health</SectionTitle>
        <Card style={{ gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <IconBadge name="heart" color={C.pink} size={36} />
            <View style={{ flex: 1 }}>
              <T size={14} rounded color={C.text}>
                {settings.health?.on ? t('crew.healthConnected') : t('crew.healthNotConnected')}
              </T>
              <T size={12} color={C.textDim}>
                {settings.health?.lastSync ? t('crew.healthLastSynced', { time: new Date(settings.health.lastSync).toLocaleString(locale, { weekday: 'short', hour: 'numeric', minute: '2-digit' }) }) : t('crew.healthBlurb')}
              </T>
            </View>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {settings.health?.on ? (
              <>
                <Chip
                  label={t('crew.syncNow')}
                  onPress={async () => {
                    const n = await actions.syncHealth();
                    Alert.alert('Apple Health', n == null ? t('crew.healthFailed') : n ? t('crew.healthImported', { count: n }) : t('crew.healthUpToDate'));
                  }}
                />
                <Chip label={t('crew.disconnect')} onPress={() => actions.disconnectHealth()} />
              </>
            ) : (
              <Chip
                label={t('crew.connectHealth')}
                active
                onPress={async () => {
                  if (!(await actions.connectHealth())) Alert.alert('Apple Health', t('crew.healthUnavailable'));
                }}
              />
            )}
          </View>
          <T size={12} color={C.textMute}>
            {t('crew.healthNote')}
          </T>
        </Card>

        <SectionTitle>{t('notify.section')}</SectionTitle>
        <Card style={{ gap: 12 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {[false, true].map((on) => (
              <Chip
                key={String(on)}
                label={on ? t('notify.on') : t('notify.off')}
                active={(settings.reminderHour != null) === on}
                onPress={async () => {
                  if (!(await actions.setReminder(on ? (settings.reminderHour ?? 20) : undefined))) Alert.alert(t('crew.notificationsOffTitle'), t('crew.notificationsOffBody'));
                }}
              />
            ))}
          </View>
          {settings.reminderHour != null && (
            <>
              <T size={12} rounded color={C.textDim}>
                {t('notify.kinds')}
              </T>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {NOTIFY_KINDS.map((kind) => {
                  const on = !settings.notifyOff?.includes(kind);
                  return <Chip key={kind} label={t(`notify.kind_${kind}`)} active={on} onPress={() => actions.setNotifyKind(kind, !on)} />;
                })}
              </View>
              <T size={12} rounded color={C.textDim}>
                {t('notify.eveningAt')}
              </T>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {[18, 20, 21].map((h) => (
                  <Chip
                    key={h}
                    label={new Date(2000, 0, 1, h).toLocaleTimeString(locale, { hour: 'numeric' })}
                    active={settings.reminderHour === h}
                    onPress={() => actions.setReminder(h)}
                  />
                ))}
              </View>
            </>
          )}
          <T size={12} color={C.textMute}>
            {t('notify.note')}
          </T>
        </Card>

        <SectionTitle>{t('crew.sectionSound')}</SectionTitle>
        <Card style={{ gap: 12 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <Chip label={t('crew.music')} icon="music" active={settings.music === true} onPress={() => actions.setSound({ music: settings.music !== true })} />
            <Chip label={t('crew.sfx')} icon="speaker" active={settings.sfx !== false} onPress={() => actions.setSound({ sfx: settings.sfx === false })} />
            <Chip label={t('crew.jukebox')} icon="chevron" onPress={() => router.push('/music')} />
          </View>
          <T size={12} color={C.textMute}>
            {t('crew.soundNote')}
          </T>
        </Card>

        <WallPicker />
        <AppIconPicker />

        <Pressable onPress={() => actions.startTour()} style={styles.tourLink} accessibilityRole="button">
          <Icon name="sparkles" size={16} color={C.yellow} />
          <T size={14} rounded color={C.yellow}>
            {t('crew.replayTour')}
          </T>
        </Pressable>

        <SectionTitle>{t('crew.sectionDetails')}</SectionTitle>
        <Card style={{ gap: 18 }}>
          <Field label={t('crew.fieldName')}>
            <TextInput value={profile.name} onChangeText={(name) => actions.updateProfile({ name })} placeholder={t('crew.namePlaceholder')} placeholderTextColor={C.textMute} style={inputStyle} />
          </Field>
          <ProfileFields p={profile} set={actions.updateProfile} showGoal={false} />
        </Card>

        <SectionTitle>{t('crew.sectionData')}</SectionTitle>
        <Card style={{ gap: 12 }}>
          <T size={13} color={C.textDim}>
            {t('crew.entriesStored', { count: entries.length })}
          </T>
          <Pressable
            onPress={() =>
              Alert.alert(t('crew.eraseTitle'), t('crew.eraseBody'), [
                { text: t('crew.cancel'), style: 'cancel' },
                { text: t('crew.erase'), style: 'destructive', onPress: actions.resetAll },
              ])
            }>
            <T size={14} color={C.danger} weight="700">
              {t('crew.eraseAll')}
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
  tourLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12 },
});
