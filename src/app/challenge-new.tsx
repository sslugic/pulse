import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChestArt } from '@/components/chest';
import { GlassButton, Icon } from '@/components/icon';
import { Avatar, challengeTitle, squadFail } from '@/components/squad-bits';
import { Card, Chip, SectionTitle, T, tap } from '@/components/ui';
import { ArcadeButton, Backdrop, Comic } from '@/components/underground';
import { C, MaxContentWidth, Space } from '@/constants/theme';
import { t } from '@/lib/i18n';
import { CHALLENGE_DAYS, CHALLENGES, challengeTarget, createChallenge, useSquad, type ChallengeDays, type ChallengeTemplate } from '@/lib/social';

/** Starts a challenge: pick what, how long, and solo or against a friend. */
export default function NewChallenge() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ opponent?: string }>();
  const board = useSquad((s) => s.board);
  const friends = useMemo(() => board.filter((r) => r.friend), [board]);
  const [template, setTemplate] = useState<ChallengeTemplate>('logging');
  const [days, setDays] = useState<ChallengeDays>(7);
  const [opponent, setOpponent] = useState<string | null>(params.opponent ?? null);
  const [busy, setBusy] = useState(false);

  const target = challengeTarget(template, days);
  const preview = challengeTitle(template, target, days);

  const start = async () => {
    setBusy(true);
    try {
      await createChallenge(template, days, opponent);
      router.back();
    } catch (e) {
      squadFail(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Backdrop tags={['VS', 'PULSE']} />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <T size={13} color={C.textDim} weight="600">
              {t('squad.newChallengeSubtitle')}
            </T>
            <Comic size={36}>{t('squad.newChallengeTitle')}</Comic>
          </View>
          <GlassButton icon="close" onPress={() => router.back()} />
        </View>

        <SectionTitle>{t('squad.pickGoal')}</SectionTitle>
        {(Object.keys(CHALLENGES) as ChallengeTemplate[]).map((k) => {
          const def = CHALLENGES[k];
          const on = template === k;
          return (
            <Pressable key={k} onPress={() => (tap(), setTemplate(k))} accessibilityRole="radio" accessibilityState={{ selected: on }}>
              <Card accent={on ? def.color : undefined} style={styles.row}>
                <Icon name={def.icon} size={22} color={def.color} />
                <View style={{ flex: 1 }}>
                  <T size={14} rounded color={C.text}>
                    {t(`squad.goal_${k}`)}
                  </T>
                  <T size={12} color={C.textDim}>
                    {t(`squad.goal_${k}_blurb`)}
                  </T>
                </View>
                {on && <Icon name="check" size={18} color={def.color} weight="bold" />}
              </Card>
            </Pressable>
          );
        })}

        <SectionTitle>{t('squad.howLong')}</SectionTitle>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {CHALLENGE_DAYS.map((d) => (
            <Chip key={d} label={t('squad.nDays', { count: d })} active={days === d} onPress={() => setDays(d)} />
          ))}
        </View>

        <SectionTitle>{t('squad.whoAgainst')}</SectionTitle>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          <Chip label={t('squad.solo')} active={!opponent} onPress={() => setOpponent(null)} />
          {friends.map((f) => (
            <Pressable key={f.userId} onPress={() => (tap(), setOpponent(f.userId))} style={[styles.friend, opponent === f.userId && { backgroundColor: C.violet }]}>
              <Avatar name={f.name} color={f.color} size={22} />
              <T size={13} rounded color={opponent === f.userId ? C.ink : C.text}>
                {f.name}
              </T>
            </Pressable>
          ))}
        </View>
        {!friends.length && (
          <T size={12} color={C.textMute}>
            {t('squad.noFriendsYet')}
          </T>
        )}

        <Card accent={C.yellow + '99'} style={{ gap: 10, marginTop: 8 }}>
          <T size={16} rounded color={C.text}>
            {preview}
          </T>
          <View style={styles.row}>
            <ChestArt tier={opponent ? 'gold' : 'silver'} size={44} />
            <T size={12} color={C.textDim} style={{ flex: 1, lineHeight: 17 }}>
              {opponent ? t('squad.duelPrize') : t('squad.soloPrize')}
            </T>
          </View>
        </Card>

        {busy ? <ActivityIndicator color={C.lime} /> : <ArcadeButton label={t('squad.startChallenge')} size="md" onPress={start} style={{ marginTop: 8 }} />}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: Space.md, paddingTop: Space.lg, gap: Space.sm, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  friend: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: C.surface, borderWidth: 2, borderColor: C.ink },
});
