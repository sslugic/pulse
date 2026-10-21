import { Image } from 'expo-image';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { C } from '@/constants/theme';
import { APP_ICONS, appIconHint, isAppIconUnlocked, type AppIconDef } from '@/lib/app-icons';
import { t } from '@/lib/i18n';
import { bestStreak } from '@/lib/nutrition';
import { questXp } from '@/lib/quests';
import { crewRank, RANKS } from '@/lib/rank';
import { useStore } from '@/lib/store';

import { appIconSupported, currentAppIcon, setAppIcon } from '../../modules/pulse-app-icon';
import { Icon } from './icon';
import { Card, SectionTitle, T, tap } from './ui';

/** Crew → App icon: pick an unlocked icon; locked ones say how to get them. Hidden where icons can't change. */
export function AppIconPicker() {
  const entries = useStore((s) => s.entries);
  const game = useStore((s) => s.game);
  const level = useMemo(() => crewRank(entries, questXp(game.claims), game.frozenDays).level, [entries, game.claims, game.frozenDays]);
  const best = useMemo(() => bestStreak(entries, game.frozenDays), [entries, game.frozenDays]);
  const [supported, setSupported] = useState(false);
  const [current, setCurrent] = useState<string | null>(null);

  useEffect(() => {
    appIconSupported()
      .then((ok) => {
        setSupported(ok);
        if (ok) return currentAppIcon().then(setCurrent);
      })
      .catch(() => setSupported(false));
  }, []);

  if (!supported) return null;

  const choose = async (icon: AppIconDef) => {
    if (icon.native === current) return;
    tap();
    try {
      await setAppIcon(icon.native);
      setCurrent(icon.native);
    } catch {
      Alert.alert(t('appIcons.section'), t('appIcons.failed'));
    }
  };

  return (
    <>
      <SectionTitle>{t('appIcons.section')}</SectionTitle>
      <Card style={{ gap: 12 }}>
        <View style={styles.grid}>
          {APP_ICONS.map((icon) => {
            const unlocked = isAppIconUnlocked(icon, level, game.unlocked, best);
            const inUse = icon.native === current;
            return (
              <Pressable
                key={icon.id}
                disabled={!unlocked}
                onPress={() => choose(icon)}
                style={styles.cell}
                accessibilityRole="button"
                accessibilityState={{ selected: inUse, disabled: !unlocked }}
                accessibilityLabel={icon.name}>
                <View style={[styles.frame, inUse && styles.frameActive]}>
                  <Image source={icon.thumb} style={[styles.thumb, !unlocked && styles.locked]} />
                  {!unlocked && (
                    <View style={styles.lock}>
                      <Icon name="lock" size={18} color={C.text} />
                    </View>
                  )}
                </View>
                <T size={11} rounded color={unlocked ? C.text : C.textDim} numberOfLines={1}>
                  {icon.name}
                </T>
                <T size={10} color={inUse ? C.lime : C.textMute} numberOfLines={1}>
                  {inUse ? t('appIcons.inUse') : unlocked ? ' ' : appIconHint(icon, (l) => RANKS[l - 1].name)}
                </T>
              </Pressable>
            );
          })}
        </View>
        <T size={12} color={C.textMute}>
          {t('appIcons.note')}
        </T>
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 14 },
  cell: { width: '31%', alignItems: 'center', gap: 4 },
  frame: { padding: 3, borderRadius: 22, borderWidth: 2, borderColor: 'transparent' },
  frameActive: { borderColor: C.lime },
  thumb: { width: 72, height: 72, borderRadius: 17 },
  locked: { opacity: 0.35 },
  lock: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
});
