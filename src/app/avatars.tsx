import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassButton, Icon } from '@/components/icon';
import { TagAvatar } from '@/components/tag-avatar';
import { SectionTitle, T, tap } from '@/components/ui';
import { Backdrop, Comic } from '@/components/underground';
import { C, MaxContentWidth, Space } from '@/constants/theme';
import { AVATARS, DEFAULT_AVATAR, isAvatarUnlocked, isRewardAvatar, type AvatarDef, type AvatarId } from '@/lib/avatars';
import { locale, t } from '@/lib/i18n';
import { questXp } from '@/lib/quests';
import { crewRank, RANKS } from '@/lib/rank';
import { spendableXp } from '@/lib/referrals';
import { actions, useStore } from '@/lib/store';

/** Profile picture picker: wear an unlocked avatar, unlock more with XP, see which ones drop from chests. */
export default function AvatarsScreen() {
  const insets = useSafeAreaInsets();
  const profile = useStore((s) => s.profile);
  const entries = useStore((s) => s.entries);
  const game = useStore((s) => s.game);
  const level = useMemo(() => crewRank(entries, questXp(game.claims), game.frozenDays).level, [entries, game.claims, game.frozenDays]);
  const current = (profile.avatar as AvatarId | undefined) ?? DEFAULT_AVATAR;
  const letter = (profile.name || 'P')[0];
  const [xp, setXp] = useState<number | null>(null);

  useEffect(() => {
    spendableXp().then(setXp).catch(() => setXp(null));
  }, [game.xpSpent]);

  const press = (a: AvatarDef) => {
    tap();
    if (isAvatarUnlocked(a, level, game.unlocked)) {
      actions.chooseAvatar(a.id, level);
      return;
    }
    if (isRewardAvatar(a)) {
      Alert.alert(a.name, t('avatars.rewardOnlyBody'));
      return;
    }
    if (xp == null || xp < a.xp) {
      Alert.alert(t('avatars.notEnoughTitle'), t('avatars.notEnoughBody', { xp: (a.xp - (xp ?? 0)).toLocaleString(locale), rank: RANKS[a.level - 1].name }));
      return;
    }
    Alert.alert(t('avatars.unlockTitle', { name: a.name }), t('avatars.unlockBody', { xp: a.xp.toLocaleString(locale) }), [
      { text: t('avatars.cancel'), style: 'cancel' },
      {
        text: t('avatars.unlock'),
        onPress: () => {
          if (actions.unlockAvatar(a.id, xp)) actions.chooseAvatar(a.id, level);
        },
      },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Backdrop tags={['PLAYER', 'PULSE']} />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <T size={13} color={C.textDim} weight="600">
              {t('avatars.subtitle')}
            </T>
            <Comic size={38}>{t('avatars.title')}</Comic>
          </View>
          <GlassButton icon="close" onPress={() => router.back()} />
        </View>

        <View style={{ alignItems: 'center', marginVertical: Space.sm }}>
          <TagAvatar size={120} online={false} avatar={current} letter={letter} />
        </View>

        <SectionTitle right={xp != null ? <T size={11} rounded color={C.lime}>{t('avatars.spendable', { xp: xp.toLocaleString(locale) })}</T> : undefined}>
          {t('avatars.title')}
        </SectionTitle>
        <View style={styles.grid}>
          {AVATARS.map((a) => {
            const unlocked = isAvatarUnlocked(a, level, game.unlocked);
            const on = current === a.id;
            return (
              <Pressable
                key={a.id}
                onPress={() => press(a)}
                accessibilityRole="button"
                accessibilityLabel={a.name}
                accessibilityState={{ selected: on, disabled: !unlocked }}
                style={[styles.tile, on && { borderColor: C.lime, backgroundColor: C.lime + '1F' }]}>
                <View style={!unlocked && { opacity: 0.35 }}>
                  <TagAvatar size={64} online={false} avatar={a.id} letter={letter} />
                </View>
                {!unlocked && (
                  <View style={styles.lock}>
                    <Icon name="lock" size={14} color={C.text} />
                  </View>
                )}
                <T size={12} rounded color={unlocked ? C.text : C.textDim} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
                  {a.name}
                </T>
                <T size={10} rounded color={on ? C.lime : unlocked ? C.textMute : isRewardAvatar(a) ? C.yellow : C.textMute} numberOfLines={2} style={{ textAlign: 'center' }}>
                  {on
                    ? t('avatars.wearing')
                    : unlocked
                      ? t('avatars.choose')
                      : isRewardAvatar(a)
                        ? t('avatars.rewardOnly')
                        : `${t('avatars.unlocksAt', { rank: RANKS[a.level - 1].name })} · ${t('avatars.unlockFor', { xp: a.xp.toLocaleString(locale) })}`}
                </T>
              </Pressable>
            );
          })}
        </View>
        <T size={11} color={C.textMute} style={{ lineHeight: 16 }}>
          {t('avatars.xpNote')}
        </T>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: Space.md, paddingTop: Space.lg, gap: Space.sm, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: { width: '31.8%', alignItems: 'center', gap: 4, paddingVertical: 10, paddingHorizontal: 6, borderRadius: 12, borderWidth: 2, borderColor: C.ink, backgroundColor: C.surface },
  lock: { position: 'absolute', top: 30, alignSelf: 'center', width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: C.ink },
});
