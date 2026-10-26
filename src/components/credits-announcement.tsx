import { useEffect } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';

import { C } from '@/constants/theme';
import { t } from '@/lib/i18n';
import { useOverlay, useOverlayBusy } from '@/lib/overlays';
import { playSfx } from '@/lib/sound';
import { dismissAnnouncement, nextStarter, STARTER_CREDITS, useAnnouncement } from '@/lib/starter-rewards';
import { useStore } from '@/lib/store';

import { Icon } from './icon';
import { T } from './ui';
import { ArcadeButton, Comic } from './underground';

const TITLE = { profile: 'starter.profileTitle', tour: 'starter.tourTitle', first_day: 'starter.firstDayTitle' } as const;
const HINT = { profile: 'starter.hintProfile', tour: 'starter.hintTour', first_day: 'starter.hintFirstDay' } as const;

/** "You just got 20 AI credits" pop-up for each starter reward, with what to do for the next one. */
export function CreditsAnnouncement() {
  const next = useAnnouncement();
  // Held while the app tour is up, so it doesn't cover the tour cards.
  const touring = useStore((s) => s.tourStep != null);
  const busy = useOverlayBusy('credits');
  const show = !!next && !touring && !busy;
  useOverlay('credits', show);

  useEffect(() => {
    if (show) playSfx('fanfare');
  }, [show, next]);

  if (!next || !show) return null;
  const upcoming = nextStarter();
  return (
    <Modal transparent animationType="fade" onRequestClose={dismissAnnouncement}>
      <View style={styles.scrim}>
        <Animated.View key={next.kind} entering={ZoomIn.springify().damping(14)} style={styles.card}>
          <View style={styles.badge}>
            <Icon name="sparkles" size={34} color={C.ink} />
          </View>
          <Comic size={30} color={C.lime} style={{ textAlign: 'center' }}>
            {t(TITLE[next.kind])}
          </Comic>
          <Comic size={44} color={C.yellow} style={{ textAlign: 'center' }}>
            {t('starter.plus', { n: next.credits })}
          </Comic>
          <T size={16} color={C.text} style={styles.center}>
            {t('starter.body', { n: next.credits })}
          </T>
          <T size={14} color={C.textDim} style={styles.center}>
            {upcoming ? t(HINT[upcoming], { n: STARTER_CREDITS[upcoming] }) : t('starter.hintDone')}
          </T>
          <ArcadeButton label={t('starter.cta')} size="md" onPress={dismissAnnouncement} style={{ alignSelf: 'stretch' }} />
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: '#000000B3', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: {
    width: '100%',
    maxWidth: 380,
    alignItems: 'center',
    gap: 12,
    padding: 24,
    borderRadius: 24,
    backgroundColor: C.surface,
    borderWidth: 3,
    borderColor: C.yellow,
    shadowColor: C.yellow,
    shadowOpacity: 0.6,
    shadowRadius: 18,
  },
  badge: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: C.yellow, borderWidth: 3, borderColor: C.ink },
  center: { textAlign: 'center', lineHeight: 21 },
});
