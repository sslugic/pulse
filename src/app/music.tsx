import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassButton, Icon } from '@/components/icon';
import { Card, Chip, SectionTitle, T, tap } from '@/components/ui';
import { Backdrop, Comic } from '@/components/underground';
import { C, MaxContentWidth, Space } from '@/constants/theme';
import { locale, t } from '@/lib/i18n';
import { DEFAULT_TRACK, isTrackUnlocked, TRACKS, unlockHint, type MusicTrack, type TrackId } from '@/lib/music';
import { bestStreak } from '@/lib/nutrition';
import { questXp } from '@/lib/quests';
import { crewRank, RANKS } from '@/lib/rank';
import { spendableXp } from '@/lib/referrals';
import { previewTrack } from '@/lib/sound';
import { actions, useStore } from '@/lib/store';

const PREVIEW_MS = 12_000;
const STEPS = 10;

/** The jukebox: pick the background track, set its volume, and unlock more tracks. */
export default function MusicScreen() {
  const insets = useSafeAreaInsets();
  const settings = useStore((s) => s.settings);
  const entries = useStore((s) => s.entries);
  const game = useStore((s) => s.game);
  const level = useMemo(() => crewRank(entries, questXp(game.claims), game.frozenDays).level, [entries, game.claims, game.frozenDays]);
  const best = useMemo(() => bestStreak(entries, game.frozenDays), [entries, game.frozenDays]);
  const current = (settings.musicTrack as TrackId | undefined) ?? DEFAULT_TRACK;
  const musicOn = settings.music === true;
  const volume = settings.musicVolume ?? 0.5;
  const [xp, setXp] = useState<number | null>(null);
  const [previewing, setPreviewing] = useState<TrackId | null>(null);

  useEffect(() => {
    spendableXp().then(setXp).catch(() => setXp(null));
  }, [game.xpSpent]);

  // A preview plays for a few seconds, then the chosen track comes back.
  useEffect(() => {
    if (!previewing) return;
    previewTrack(previewing);
    const timer = setTimeout(() => setPreviewing(null), PREVIEW_MS);
    return () => {
      clearTimeout(timer);
      previewTrack(null);
    };
  }, [previewing]);

  const choose = (track: MusicTrack) => {
    tap();
    setPreviewing(null);
    actions.setSound({ musicTrack: track.id, music: true });
  };

  const unlock = (track: MusicTrack) => {
    tap();
    if (xp == null || xp < track.xp) {
      Alert.alert(t('music.notEnoughTitle'), t('music.notEnoughBody', { xp: (track.xp - (xp ?? 0)).toLocaleString(locale), rank: RANKS[track.level - 1].name }));
      return;
    }
    Alert.alert(t('music.unlockTitle', { name: track.name }), t('music.unlockBody', { xp: track.xp.toLocaleString(locale) }), [
      { text: t('music.cancel'), style: 'cancel' },
      {
        text: t('music.unlock'),
        onPress: () => {
          if (actions.unlockTrack(track.id, xp)) actions.setSound({ musicTrack: track.id, music: true });
        },
      },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Backdrop tags={['JUKEBOX', 'PULSE']} />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <T size={13} color={C.textDim} weight="600">
              {t('music.subtitle')}
            </T>
            <Comic size={38}>{t('music.title')}</Comic>
          </View>
          <GlassButton icon="close" onPress={() => router.back()} />
        </View>

        <Card style={{ gap: 12 }} accent={C.violet + '99'}>
          <View style={styles.between}>
            <T size={14} rounded color={C.text}>
              {t('music.volume')}
            </T>
            <Chip label={musicOn ? t('music.on') : t('music.off')} icon="music" active={musicOn} onPress={() => actions.setSound({ music: !musicOn })} />
          </View>
          <View style={styles.volume} accessibilityRole="adjustable" accessibilityValue={{ min: 0, max: 100, now: Math.round(volume * 100) }}>
            {Array.from({ length: STEPS }, (_, i) => {
              const v = (i + 1) / STEPS;
              const on = musicOn && volume >= v - 0.001;
              return (
                <Pressable
                  key={i}
                  onPress={() => (tap(), actions.setSound({ musicVolume: v, music: true }))}
                  hitSlop={{ top: 12, bottom: 12 }}
                  style={[styles.bar, { height: 10 + i * 2.6, backgroundColor: on ? C.violet : C.surfaceHi }]}
                />
              );
            })}
          </View>
          <T size={11} color={C.textMute}>
            {t('music.volumeNote')}
          </T>
        </Card>

        <SectionTitle right={xp != null ? <T size={11} rounded color={C.lime}>{t('music.spendable', { xp: xp.toLocaleString(locale) })}</T> : undefined}>
          {t('music.tracks')}
        </SectionTitle>
        {TRACKS.map((track) => {
          const unlocked = isTrackUnlocked(track, level, game.unlocked, best);
          const playing = musicOn && current === track.id && !previewing;
          const isPreview = previewing === track.id;
          return (
            <Card key={track.id} style={{ gap: 10 }} accent={playing ? C.lime : undefined}>
              <View style={styles.row}>
                <T size={30}>{track.emoji}</T>
                <View style={{ flex: 1 }}>
                  <T size={15} rounded color={unlocked ? C.text : C.textDim}>
                    {track.name}
                  </T>
                  <T size={12} color={C.textDim}>
                    {track.vibe}
                  </T>
                </View>
                <Pressable
                  onPress={() => (tap(), setPreviewing(isPreview ? null : track.id))}
                  hitSlop={8}
                  style={[styles.play, isPreview && { backgroundColor: C.violet }]}
                  accessibilityLabel={t('music.preview', { name: track.name })}>
                  <Icon name={isPreview ? 'stop' : 'speaker'} size={16} color={isPreview ? C.ink : C.text} />
                </Pressable>
              </View>
              {unlocked ? (
                playing ? (
                  <View style={styles.row}>
                    <Icon name="check" size={14} color={C.lime} weight="bold" />
                    <T size={12} rounded color={C.lime}>
                      {t('music.playing')}
                    </T>
                  </View>
                ) : (
                  <Chip label={t('music.choose')} onPress={() => choose(track)} />
                )
              ) : (
                <View style={styles.between}>
                  <View style={[styles.row, { flex: 1 }]}>
                    <Icon name="lock" size={13} color={C.textMute} />
                    <T size={12} color={C.textMute} style={{ flex: 1 }}>
                      {unlockHint(track, (l) => RANKS[l - 1].name)}
                    </T>
                  </View>
                  {track.xp > 0 && <Chip label={t('music.unlockFor', { xp: track.xp.toLocaleString(locale) })} icon="bolt" onPress={() => unlock(track)} />}
                </View>
              )}
            </Card>
          );
        })}
        <T size={11} color={C.textMute} style={{ lineHeight: 16 }}>
          {t('music.xpNote')}
        </T>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: Space.md, paddingTop: Space.lg, gap: Space.sm, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  volume: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 40 },
  bar: { flex: 1, borderRadius: 4, borderWidth: 2, borderColor: C.ink },
  play: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: C.surfaceHi, borderWidth: 2, borderColor: C.ink },
});
