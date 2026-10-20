import { router, useLocalSearchParams } from 'expo-router';
import { Alert, Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassButton, Icon } from '@/components/icon';
import { openPlayerActions } from '@/components/player-actions';
import { shareCard } from '@/components/share-card';
import { Avatar, squadFail } from '@/components/squad-bits';
import { Card, Chip, SectionTitle, T, tap } from '@/components/ui';
import { Backdrop, Comic } from '@/components/underground';
import { C, MaxContentWidth, Space } from '@/constants/theme';
import { locale, t } from '@/lib/i18n';
import { crewLink, leaveCrew, useSquad } from '@/lib/social';
import { useStore } from '@/lib/store';

/** One crew: the shared streak, who has logged today, the invite code, and leaving. */
export default function CrewScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const crew = useSquad((s) => s.crews.find((c) => c.id === id));
  const uid = useStore((s) => s.account.userId);

  if (!crew) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        <T size={14} color={C.textDim}>
          {t('squad.crewGone')}
        </T>
        <Chip label={t('squad.ok')} onPress={() => router.back()} />
      </View>
    );
  }

  const done = crew.members.filter((m) => m.loggedToday).length;
  const invite = () => {
    tap();
    Share.share({ message: t('squad.crewInviteMessage', { crew: crew.name, link: crewLink(crew.inviteCode), code: crew.inviteCode }) });
  };
  const leave = () =>
    Alert.alert(t('squad.leaveTitle', { name: crew.name }), crew.members.length === 1 ? t('squad.leaveLastBody') : t('squad.leaveBody'), [
      { text: t('squad.cancel'), style: 'cancel' },
      {
        text: t('squad.leave'),
        style: 'destructive',
        onPress: () =>
          leaveCrew(crew.id)
            .then(() => router.back())
            .catch(squadFail),
      },
    ]);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Backdrop tags={['CREW', crew.name.toUpperCase().slice(0, 8)]} />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <T size={13} color={C.textDim} weight="600">
              {t('squad.crewLabel')}
            </T>
            <Comic size={34}>{crew.name.toUpperCase()}</Comic>
          </View>
          <GlassButton icon="close" onPress={() => router.back()} />
        </View>

        <Card accent={C.cyan + 'AA'} style={{ alignItems: 'center', gap: 4, paddingVertical: 18 }}>
          <View style={styles.row}>
            <Icon name="flame" size={30} color={crew.streak ? C.orange : C.textMute} />
            <Comic size={56} color={crew.streak ? C.yellow : C.textMute}>
              {crew.streak}
            </Comic>
          </View>
          <T size={13} rounded color={C.text}>
            {t('squad.crewStreakDays', { count: crew.streak })}
          </T>
          <T size={12} color={C.textDim} style={{ textAlign: 'center', marginTop: 6, lineHeight: 17 }}>
            {done === crew.members.length ? t('squad.crewAllIn') : t('squad.crewWaiting', { count: crew.members.length - done })}
          </T>
          {crew.streak > 0 && (
            <Chip label={t('squad.shareStreak')} icon="share" onPress={() => shareCard({ kind: 'crew', crew: crew.name, days: crew.streak, members: crew.members.length })} />
          )}
        </Card>

        <SectionTitle right={<T size={11} rounded color={C.textMute}>{`${crew.members.length}/8`}</T>}>{t('squad.members')}</SectionTitle>
        <Card style={{ gap: 4, paddingVertical: 8 }}>
          {crew.members.map((m) => {
            const me = m.userId === uid;
            return (
              <Pressable
                key={m.userId}
                disabled={me}
                onPress={() => openPlayerActions({ userId: m.userId, name: m.name ?? t('squad.hiddenPlayer'), loggedToday: m.loggedToday, crewId: crew.id })}
                style={({ pressed }) => [styles.line, me && { backgroundColor: '#38D6FF1A' }, pressed && { opacity: 0.7 }]}>
                <Avatar name={m.name} color={m.color} dim={m.hidden} />
                <View style={{ flex: 1 }}>
                  <T size={14} rounded color={m.hidden ? C.textMute : C.text} numberOfLines={1}>
                    {m.hidden ? t('squad.hiddenPlayer') : me ? t('squad.you', { name: m.name ?? '' }) : m.name}
                  </T>
                  {!m.hidden && (
                    <T size={11} color={C.textDim}>
                      {t('squad.levelStreakXp', { level: m.level, streak: m.streak, xp: m.weeklyXp.toLocaleString(locale) })}
                    </T>
                  )}
                </View>
                <View style={[styles.today, { backgroundColor: m.loggedToday ? C.lime : C.surfaceHi }]}>
                  <Icon name={m.loggedToday ? 'check' : 'minus'} size={14} color={m.loggedToday ? C.ink : C.textMute} weight="bold" />
                </View>
              </Pressable>
            );
          })}
          <T size={11} color={C.textMute} style={{ marginTop: 6 }}>
            {t('squad.crewRule')}
          </T>
        </Card>

        <SectionTitle>{t('squad.inviteToCrew')}</SectionTitle>
        <Card style={{ gap: 12 }}>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <T size={11} rounded color={C.textDim}>
                {t('squad.crewCode')}
              </T>
              <Comic size={28} color={C.lime}>
                {crew.inviteCode}
              </Comic>
            </View>
            {crew.members.length < 8 && <Chip label={t('squad.inviteFriends')} icon="link" active color={C.cyan} onPress={invite} />}
          </View>
        </Card>

        <Pressable onPress={leave} style={{ alignSelf: 'center', padding: 12 }}>
          <T size={14} weight="700" color={C.danger}>
            {t('squad.leaveCrew')}
          </T>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: Space.md, paddingTop: Space.lg, gap: Space.sm, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingHorizontal: 6, borderRadius: 10 },
  today: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: C.ink },
});
