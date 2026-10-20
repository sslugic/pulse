import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { C, Space } from '@/constants/theme';
import { tap } from '@/lib/haptics';
import { t } from '@/lib/i18n';
import type { DayWellbeing } from '@/lib/wellbeing';

import { Icon, IconBadge } from './icon';
import { Card, T } from './ui';
import { ArcadeButton, Comic } from './underground';

export const isStressHigh = (w: DayWellbeing) => w.level === 'high' || w.level === 'very high';

/** HQ entry to the Stress Arcade; turns into a loud nudge when today's stress score is high. */
export function ArcadePrompt({ w }: { w: DayWellbeing }) {
  if (isStressHigh(w)) {
    return (
      <Card style={{ gap: 10, marginTop: Space.sm }} accent={C.orange + 'CC'}>
        <View style={styles.row}>
          <IconBadge name="gauge" color={C.orange} size={40} />
          <View style={{ flex: 1, gap: 2 }}>
            <Comic size={22} color={C.orange}>
              {t('hq.stressHigh')}
            </Comic>
            <T size={13} color={C.textDim} style={{ lineHeight: 18 }}>
              {t('hq.stressHighBody', { n: w.stress ?? 0 })}
            </T>
          </View>
        </View>
        <ArcadeButton
          label={t('hq.reset60')}
          size="md"
          colors={['#5FE2FF', '#1E8FE0']}
          textColor="#fff"
          onPress={() => router.push({ pathname: '/arcade', params: { play: 'breathe' } })}
        />
      </Card>
    );
  }
  return (
    <Card
      style={{ marginTop: Space.sm }}
      onPress={() => {
        tap();
        router.push('/arcade');
      }}>
      <View style={styles.row}>
        <IconBadge name="sparkles" color={C.cyan} size={36} />
        <View style={{ flex: 1 }}>
          <T size={13} rounded color={C.text}>
            {t('hq.stressArcade')}
          </T>
          <T size={12} color={C.textDim}>
            {t('hq.stressArcadeBody')}
          </T>
        </View>
        <Icon name="chevron" size={14} color={C.textMute} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});
