import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassButton, Icon } from '@/components/icon';
import { TokenCoin } from '@/components/quests-card';
import { Bar, Card, SectionTitle, T } from '@/components/ui';
import { Backdrop, Comic } from '@/components/underground';
import { C, MaxContentWidth, Space } from '@/constants/theme';
import { season, SEASON_BADGE_REWARD, SEASON_REWARD, seasonBadges } from '@/lib/seasons';
import { actions, useStore } from '@/lib/store';

/** This month's season: five challenges, a badge for clearing them all, and the trophy shelf. */
export default function SeasonScreen() {
  const insets = useSafeAreaInsets();
  const entries = useStore((s) => s.entries);
  const profile = useStore((s) => s.profile);
  const claims = useStore((s) => s.game.claims);
  const s = useMemo(() => season(entries, profile, claims), [entries, profile, claims]);
  const badges = useMemo(() => seasonBadges(claims), [claims]);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Backdrop />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <T size={13} color={C.textDim} weight="600">
              {new Date(s.month + '-15').toLocaleDateString([], { month: 'long', year: 'numeric' })} season · {s.daysLeft} days left
            </T>
            <Comic size={34} color={s.theme.color}>
              {`${s.theme.emoji} ${s.theme.name}`}
            </Comic>
          </View>
          <GlassButton icon="close" onPress={() => router.back()} />
        </View>

        <Card style={{ gap: 8 }} accent={s.theme.color + 'AA'}>
          <View style={styles.between}>
            <T size={13} rounded color={C.text}>
              {s.cleared}/5 CHALLENGES
            </T>
            <T size={12} rounded color={s.badge ? C.lime : C.textMute}>
              {s.badge ? 'BADGE EARNED' : `BADGE +${SEASON_BADGE_REWARD.tokens}`}
            </T>
          </View>
          <Bar value={s.cleared} max={5} color={s.theme.color} height={10} />
          <T size={12} color={C.textDim} style={{ lineHeight: 17 }}>
            Each challenge pays +{SEASON_REWARD.xp} XP and +{SEASON_REWARD.tokens} tokens. Clear all five this month for the {s.theme.name} badge.
          </T>
        </Card>

        <View style={{ gap: 8, marginTop: Space.sm }}>
          {s.challenges.map((c) => (
            <Card key={c.id} style={{ gap: 8 }} accent={c.claimed ? C.lime + '66' : undefined}>
              <View style={styles.row}>
                <View style={[styles.icon, { borderColor: c.color }]}>
                  <Icon name={c.icon} size={18} color={c.color} />
                </View>
                <T size={14} rounded color={c.claimed ? C.textDim : C.text} style={{ flex: 1 }}>
                  {c.title}
                </T>
                {c.claimed ? (
                  <Icon name="check" size={18} color={C.lime} weight="bold" />
                ) : c.done ? (
                  <Pressable onPress={() => actions.claimSeason(c.id)} style={styles.claim} accessibilityRole="button">
                    <Comic size={15} color={C.ink} outline={C.yellow}>
                      CLAIM
                    </Comic>
                  </Pressable>
                ) : (
                  <T size={12} rounded color={C.textMute}>
                    {c.value}/{c.goal}
                  </T>
                )}
              </View>
              {!c.claimed && <Bar value={c.value} max={c.goal} color={c.done ? C.lime : c.color} height={6} />}
            </Card>
          ))}
        </View>

        <SectionTitle>Trophy shelf</SectionTitle>
        <Card>
          {badges.length === 0 ? (
            <T size={13} color={C.textDim}>
              Clear a full season to put your first badge on the shelf.
            </T>
          ) : (
            <View style={styles.shelf}>
              {badges.map((b) => (
                <View key={b.month} style={[styles.badge, { borderColor: b.color }]}>
                  <T size={28}>{b.emoji}</T>
                  <T size={9} rounded color={C.text} style={{ textAlign: 'center' }}>
                    {b.name}
                  </T>
                  <T size={9} rounded color={C.textMute}>
                    {new Date(b.month + '-15').toLocaleDateString([], { month: 'short', year: '2-digit' }).toUpperCase()}
                  </T>
                </View>
              ))}
            </View>
          )}
        </Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'center', marginTop: Space.sm }}>
          <TokenCoin size={14} />
          <T size={11} color={C.textMute}>
            Spend tokens in the Arcade and on coaches in Crew.
          </T>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: Space.md, paddingTop: Space.lg, gap: Space.sm, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: Space.sm },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  icon: { width: 36, height: 36, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1D2023' },
  claim: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: C.yellow, borderWidth: 2, borderColor: C.ink, borderBottomWidth: 4 },
  shelf: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  badge: { width: 92, alignItems: 'center', gap: 2, padding: 8, borderRadius: 12, borderWidth: 3, backgroundColor: '#1D2023' },
});
