import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { Share, StyleSheet, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';

import { C } from '@/constants/theme';
import { CHEST_LOOK } from '@/lib/brain';
import { t } from '@/lib/i18n';
import { onShareCard, type ShareCard } from '@/lib/share-card';
import { APP_STORE_URL } from '@/lib/social';

import { RankScene } from './backdrops';
import { ChestArt } from './chest';
import { Icon } from './icon';
import { T } from './ui';
import { Comic, Hazard, Sticker } from './underground';

export { shareCard } from '@/lib/share-card';

// One-tap brag cards for Instagram Stories, TikTok or a group chat: a 9:16 poster in the app's
// subway-arcade style, rendered off screen, captured as an image and handed to the share sheet.

const W = 360;
const H = 640;

/** Renders the pending card off screen and shares it once it has drawn. */
export function ShareCardHost() {
  const [card, setCard] = useState<ShareCard | null>(null);
  const ref = useRef<ComponentRef<typeof View>>(null);

  useEffect(() => {
    onShareCard(setCard);
    return () => onShareCard(null);
  }, []);

  useEffect(() => {
    if (!card) return;
    let cancelled = false;
    // Two frames so fonts, gradients and SVG art have drawn before the capture.
    const id = setTimeout(async () => {
      try {
        // view-shot's types predate RN's element refs; the runtime accepts the host view.
        const uri = await captureRef(ref as never, { format: 'jpg', quality: 0.92, width: W * 3, height: H * 3 });
        if (!cancelled) await Share.share({ url: uri, message: `${t('share.message')} ${APP_STORE_URL}` });
      } catch (e) {
        console.warn('[share] failed', e);
      } finally {
        if (!cancelled) setCard(null);
      }
    }, 120);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [card]);

  if (!card) return null;
  return (
    <View pointerEvents="none" style={styles.offscreen}>
      <View ref={ref} collapsable={false} style={styles.card}>
        <CardBody card={card} />
      </View>
    </View>
  );
}

function CardBody({ card }: { card: ShareCard }) {
  return (
    <View style={{ flex: 1 }}>
      {card.kind === 'rank' ? (
        <View style={StyleSheet.absoluteFill}>
          <RankScene level={card.level} width={W} height={H} tags={['PULSE', card.name.toUpperCase().slice(0, 10) || 'CREW']} />
          <LinearGradient colors={['#00000000', '#000000CC']} style={StyleSheet.absoluteFill} />
        </View>
      ) : (
        <LinearGradient colors={GRADIENT[card.kind]} style={StyleSheet.absoluteFill} />
      )}
      <Hazard height={14} />
      <View style={styles.inner}>
        <View style={{ alignItems: 'flex-start' }}>
          <Sticker text="PULSE" color={C.lime} rotate={-5} size={20} />
        </View>
        <View style={styles.center}>
          <Hero card={card} />
        </View>
        <View style={styles.footer}>
          <T size={13} rounded color={C.text}>
            {t('share.tagline')}
          </T>
          <View style={styles.store}>
            <Icon name="sparkles" size={14} color={C.ink} />
            <T size={12} rounded color={C.ink}>
              {t('share.getIt')}
            </T>
          </View>
        </View>
      </View>
      <Hazard height={14} style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }} />
    </View>
  );
}

const GRADIENT: Record<Exclude<ShareCard['kind'], 'rank'>, readonly [string, string, string]> = {
  streak: ['#3A1300', '#7A2A00', '#16181A'],
  chest: ['#2A1A00', '#4A3400', '#16181A'],
  challenge: ['#14002E', '#3A0C6E', '#16181A'],
  crew: ['#00262E', '#004E5C', '#16181A'],
};

function Hero({ card }: { card: ShareCard }) {
  switch (card.kind) {
    case 'streak':
      return (
        <>
          <Icon name="flame" size={96} color={C.orange} />
          <Comic size={150} color={C.yellow} style={{ lineHeight: 160 }}>
            {card.days}
          </Comic>
          <Comic size={34} color={C.text}>
            {t('share.dayStreak', { count: card.days })}
          </Comic>
          <T size={15} rounded color={C.textDim} style={{ marginTop: 8 }}>
            {card.name ? `${card.name.toUpperCase()} · ${card.rank.toUpperCase()}` : card.rank.toUpperCase()}
          </T>
        </>
      );
    case 'rank':
      return (
        <>
          <T size={16} rounded color={C.lime}>
            {t('share.rankUp')}
          </T>
          <Comic size={56} color={C.yellow} style={{ textAlign: 'center' }}>
            {card.rank.toUpperCase()}
          </Comic>
          <T size={15} rounded color={C.text} style={{ marginTop: 6 }}>
            {t('share.levelXp', { level: card.level, xp: card.xp.toLocaleString() })}
          </T>
          {!!card.name && (
            <T size={14} rounded color={C.textDim} style={{ marginTop: 4 }}>
              {card.name.toUpperCase()}
            </T>
          )}
        </>
      );
    case 'chest':
      return (
        <>
          <Comic size={36} color={CHEST_LOOK[card.tier].glow}>
            {t('share.chestOpened')}
          </Comic>
          <View style={{ marginVertical: 24 }}>
            <ChestArt tier={card.tier} size={190} open />
          </View>
          {card.lines.slice(0, 4).map((l, i) => (
            <T key={i} size={18} rounded color={C.text}>
              {l}
            </T>
          ))}
        </>
      );
    case 'challenge':
      return (
        <>
          <Comic size={64} color={C.yellow}>
            🏆
          </Comic>
          <Comic size={40} color={C.text} style={{ textAlign: 'center' }}>
            {t('share.challengeWon')}
          </Comic>
          <T size={18} rounded color={C.violet} style={{ textAlign: 'center', marginTop: 8 }}>
            {card.title}
          </T>
          {!!card.vs && (
            <T size={15} rounded color={C.textDim} style={{ marginTop: 6 }}>
              {t('share.vs', { name: card.vs })}
            </T>
          )}
        </>
      );
    case 'crew':
      return (
        <>
          <Icon name="people" size={80} color={C.cyan} />
          <Comic size={130} color={C.cyan} style={{ lineHeight: 140 }}>
            {card.days}
          </Comic>
          <Comic size={30} color={C.text} style={{ textAlign: 'center' }}>
            {t('share.crewStreak', { count: card.days })}
          </Comic>
          <T size={17} rounded color={C.yellow} style={{ marginTop: 8, textAlign: 'center' }}>
            {card.crew.toUpperCase()} · {t('share.members', { count: card.members })}
          </T>
        </>
      );
  }
}

const styles = StyleSheet.create({
  offscreen: { position: 'absolute', left: -W * 3, top: 0, width: W, height: H },
  card: { width: W, height: H, backgroundColor: C.bg, overflow: 'hidden' },
  inner: { flex: 1, padding: 24, paddingTop: 30, paddingBottom: 34 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  footer: { alignItems: 'center', gap: 10 },
  store: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.lime, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 2, borderColor: C.ink },
});

