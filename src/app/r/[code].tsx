import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { T } from '@/components/ui';
import { ArcadeButton, Backdrop, Comic } from '@/components/underground';
import { C } from '@/constants/theme';
import { t } from '@/lib/i18n';
import { REFERRAL_CREDITS, rememberReferral } from '@/lib/referrals';
import { useStore } from '@/lib/store';

/** pulse://r/CODE: a referral link. Claimed now when signed in, otherwise right after sign-in. */
export default function ReferralLink() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const signedIn = useStore((s) => !!s.account.userId);
  const [text, setText] = useState<string | null>(null);

  useEffect(() => {
    const c = String(code ?? '').toUpperCase();
    if (!c) return;
    let cancelled = false;
    rememberReferral(c)
      .then((balance) => {
        if (cancelled) return;
        setText(balance != null ? t('credits.referralClaimedBody', { n: REFERRAL_CREDITS }) : t('credits.referralSaved', { n: REFERRAL_CREDITS }));
      })
      .catch((e) => !cancelled && setText((e as Error).message));
    return () => {
      cancelled = true;
    };
  }, [code, signedIn]);

  return (
    <View style={styles.wrap}>
      <Backdrop tags={['PULSE', 'INVITE']} />
      <Comic size={34} style={{ textAlign: 'center' }}>
        {t('credits.referralTitle')}
      </Comic>
      {text ? (
        <T size={15} color={C.text} style={{ textAlign: 'center', lineHeight: 21 }}>
          {text}
        </T>
      ) : (
        <ActivityIndicator color={C.lime} />
      )}
      <ArcadeButton label={signedIn ? t('credits.openCredits') : t('credits.goToAccount')} size="md" onPress={() => router.replace(signedIn ? '/credits' : '/profile')} style={{ alignSelf: 'stretch' }} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', gap: 24, padding: 24 },
});
