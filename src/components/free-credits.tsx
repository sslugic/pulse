import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Share, StyleSheet, View } from 'react-native';

import { C } from '@/constants/theme';
import { locale, t } from '@/lib/i18n';
import {
  claimReferral,
  CREDITS_PER_TRADE,
  myReferrals,
  REFERRAL_CREDITS,
  referralLink,
  tradeXp,
  WEEKLY_TRADE_CAP,
  XP_PER_TRADE,
  xpTradeStatus,
  type ReferralStats,
  type TradeStatus,
} from '@/lib/referrals';
import { playSfx } from '@/lib/sound';

import { Icon } from './icon';
import { Bar, Card, Chip, SectionTitle, T, tap } from './ui';

/** Ways to earn credits without paying: inviting friends and trading XP. */
export function FreeCredits() {
  const [ref, setRef] = useState<ReferralStats | null>(null);
  const [trade, setTrade] = useState<TradeStatus | null>(null);
  // Set when a load fails, so the card offers a retry instead of spinning forever.
  const [refFailed, setRefFailed] = useState(false);
  const [tradeFailed, setTradeFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    myReferrals()
      .then(setRef)
      .catch(() => setRefFailed(true));
    xpTradeStatus()
      .then(setTrade)
      .catch(() => setTradeFailed(true));
  }, []);
  useEffect(load, [load]);
  const retry = () => {
    setRefFailed(false);
    setTradeFailed(false);
    load();
  };

  const fail = (e: unknown) => Alert.alert(t('credits.errorTitle'), (e as Error).message);

  const invite = () => {
    tap();
    if (ref) Share.share({ message: t('credits.referralMessage', { link: referralLink(ref.code), code: ref.code }) });
  };

  const enterCode = () => {
    tap();
    Alert.prompt(t('credits.haveCodeTitle'), t('credits.haveCodeBody', { n: REFERRAL_CREDITS }), async (code) => {
      if (!code?.trim()) return;
      try {
        await claimReferral(code);
        playSfx('fanfare');
        Alert.alert(t('credits.referralClaimedTitle'), t('credits.referralClaimedBody', { n: REFERRAL_CREDITS }));
        load();
      } catch (e) {
        fail(e);
      }
    });
  };

  const redeem = async () => {
    tap();
    setBusy(true);
    try {
      await tradeXp();
      playSfx('reward');
      load();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  const weekLeft = trade ? WEEKLY_TRADE_CAP - trade.creditsThisWeek : 0;
  const canTrade = !!trade && trade.eligible && trade.available >= XP_PER_TRADE && weekLeft >= CREDITS_PER_TRADE;

  return (
    <>
      <SectionTitle>{t('credits.freeTitle')}</SectionTitle>
      <Card style={{ gap: 10 }} accent={C.cyan + '99'}>
        <View style={styles.row}>
          <Icon name="people" size={24} color={C.cyan} />
          <View style={{ flex: 1 }}>
            <T size={15} rounded color={C.text}>
              {t('credits.inviteTitle', { n: REFERRAL_CREDITS })}
            </T>
            <T size={12} color={C.textDim} style={{ lineHeight: 17 }}>
              {t('credits.inviteBody', { n: REFERRAL_CREDITS })}
            </T>
          </View>
        </View>
        {ref ? (
          <>
            <View style={styles.between}>
              <T size={12} rounded color={C.textDim}>
                {t('credits.yourCode', { code: ref.code })}
              </T>
              <T size={12} rounded color={C.lime}>
                {t('credits.referredStats', { count: ref.referred, credits: ref.creditsEarned })}
              </T>
            </View>
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              <Chip label={t('credits.shareInvite')} icon="link" active color={C.cyan} onPress={invite} />
              {ref.canClaim && <Chip label={t('credits.haveCode')} onPress={enterCode} />}
            </View>
          </>
        ) : refFailed ? (
          <LoadFailed onRetry={retry} />
        ) : (
          <ActivityIndicator color={C.textMute} />
        )}
      </Card>

      <Card style={{ gap: 10 }} accent={C.lime + '99'}>
        <View style={styles.row}>
          <Icon name="bolt" size={24} color={C.lime} />
          <View style={{ flex: 1 }}>
            <T size={15} rounded color={C.text}>
              {t('credits.tradeTitle', { xp: XP_PER_TRADE.toLocaleString(locale), n: CREDITS_PER_TRADE })}
            </T>
            <T size={12} color={C.textDim} style={{ lineHeight: 17 }}>
              {t('credits.tradeBody', { cap: WEEKLY_TRADE_CAP })}
            </T>
          </View>
        </View>
        {trade ? (
          <>
            <View style={styles.between}>
              <T size={12} rounded color={C.textDim}>
                {t('credits.xpAvailable', { xp: trade.available.toLocaleString(locale) })}
              </T>
              <T size={12} rounded color={C.textDim}>
                {t('credits.weekLeft', { n: Math.max(0, weekLeft) })}
              </T>
            </View>
            <Bar value={Math.min(trade.available, XP_PER_TRADE)} max={XP_PER_TRADE} color={C.lime} />
            <Pressable onPress={redeem} disabled={!canTrade || busy} style={[styles.trade, (!canTrade || busy) && { opacity: 0.45 }]} accessibilityRole="button">
              {busy ? (
                <ActivityIndicator color={C.ink} />
              ) : (
                <T size={14} rounded color={C.ink}>
                  {t('credits.tradeButton', { xp: XP_PER_TRADE.toLocaleString(locale), n: CREDITS_PER_TRADE })}
                </T>
              )}
            </Pressable>
            {!trade.eligible && (
              <T size={11} color={C.textMute}>
                {t('credits.tradeTooNew')}
              </T>
            )}
          </>
        ) : tradeFailed ? (
          <LoadFailed onRetry={retry} />
        ) : (
          <ActivityIndicator color={C.textMute} />
        )}
      </Card>
    </>
  );
}

function LoadFailed({ onRetry }: { onRetry: () => void }) {
  return (
    <View style={styles.between}>
      <T size={12} color={C.textMute} style={{ flex: 1 }}>
        {t('credits.loadFailed')}
      </T>
      <Chip label={t('credits.retry')} icon="retry" onPress={onRetry} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  trade: { alignItems: 'center', paddingVertical: 11, borderRadius: 10, backgroundColor: C.lime, borderWidth: 2, borderColor: C.ink, borderBottomWidth: 4 },
});
