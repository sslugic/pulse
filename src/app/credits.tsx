import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FreeCredits } from '@/components/free-credits';
import { GlassButton, Icon } from '@/components/icon';
import { TokenCoin } from '@/components/quests-card';
import { Card, SectionTitle, T, tap } from '@/components/ui';
import { ArcadeButton, Backdrop, Comic } from '@/components/underground';
import { C, MaxContentWidth, Space } from '@/constants/theme';
import { locale, t } from '@/lib/i18n';
import { LEGAL } from '@/lib/legal';
import { buy, loadOffers, purchasesConfigured, restore, type CreditOffer } from '@/lib/purchases';
import { actions, useStore } from '@/lib/store';

const FEATURE_LABELS: Record<string, string> = {
  coach: t('credits.featureCoach'),
  coach_media: t('credits.featureCoachMedia'),
  voice: t('credits.featureVoice'),
  meal_plan: t('credits.featureMealPlan'),
  meal_plan_3d: t('credits.featureMealPlan3d'),
  workout_plan: t('credits.featureWorkoutPlan'),
  workout_plan_3d: t('credits.featureWorkoutPlan3d'),
  workout_plan_7d: t('credits.featureWorkoutPlan7d'),
  recap: t('credits.featureRecap'),
  wellbeing: t('credits.featureWellbeing'),
  goal_plan: t('credits.featureGoalPlan'),
  insight: t('credits.featureInsight'),
  estimate: t('credits.featureEstimate'),
};

/** AI credits: balance, what things cost, credit packs, Pulse Pro, and restore. */
export default function CreditsScreen() {
  const insets = useSafeAreaInsets();
  const account = useStore((s) => s.account);
  const [offers, setOffers] = useState<CreditOffer[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    actions.refreshAccount();
    loadOffers()
      .then(setOffers)
      .catch((e) => {
        setLoadError((e as Error).message);
        setOffers([]);
      });
  }, []);

  const purchase = async (o: CreditOffer) => {
    tap();
    setBusy(o.id);
    try {
      if (await buy(o)) {
        // The server adds the credits when Apple confirms; give the webhook a moment.
        for (const wait of [1500, 3000, 6000]) {
          await new Promise((r) => setTimeout(r, wait));
          await actions.refreshAccount();
        }
        Alert.alert(t('credits.thanksTitle'), t('credits.thanksBody'));
      }
    } catch (e) {
      Alert.alert(t('credits.purchaseFailed'), (e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const packs = (offers ?? []).filter((o) => o.kind === 'pack');
  const pro = (offers ?? []).find((o) => o.kind === 'subscription');

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Backdrop />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <T size={13} color={C.textDim} weight="600">
              {t('credits.subtitle')}
            </T>
            <Comic size={36}>{t('credits.title')}</Comic>
          </View>
          <GlassButton icon="close" onPress={() => router.back()} />
        </View>

        <Card style={{ gap: 6, alignItems: 'center' }} accent={C.yellow + 'AA'}>
          <T size={11} rounded color={C.textDim}>
            {t('credits.balance')}
          </T>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <TokenCoin size={34} />
            <Comic size={48} color={C.yellow}>
              {account.credits != null ? account.credits.toLocaleString() : '—'}
            </Comic>
          </View>
          {account.subscription?.active && (
            <T size={12} rounded color={C.lime}>
              {t('credits.proActive')}
              {account.subscription.expiresAt ? t('credits.proRenews', { date: new Date(account.subscription.expiresAt).toLocaleDateString(locale) }) : ''}
            </T>
          )}
        </Card>

        {account.userId && <FreeCredits />}

        {!account.userId ? (
          <Card style={{ gap: 10 }}>
            <T size={14} color={C.text}>
              {t('credits.signInPitch')}
            </T>
            <ArcadeButton label={t('credits.goToAccount')} size="md" onPress={() => router.replace('/profile')} />
          </Card>
        ) : !purchasesConfigured ? (
          <Card>
            <T size={13} color={C.textDim}>
              {t('credits.notSetUp')}
            </T>
          </Card>
        ) : offers == null ? (
          <ActivityIndicator color={C.yellow} style={{ marginVertical: Space.lg }} />
        ) : (
          <>
            {pro && (
              <>
                <SectionTitle>Pulse Pro</SectionTitle>
                <Card style={{ gap: 10 }} accent={C.lime + 'AA'}>
                  <View style={styles.row}>
                    <T size={28}>⭐</T>
                    <View style={{ flex: 1 }}>
                      <T size={16} rounded color={C.text}>
                        {pro.title || 'Pulse Pro'}
                      </T>
                      <T size={12} color={C.textDim}>
                        {pro.description || t('credits.proDescription')}
                      </T>
                    </View>
                    <T size={16} rounded color={C.lime}>
                      {t('credits.perMonth', { price: pro.price })}
                    </T>
                  </View>
                  <ArcadeButton
                    label={account.subscription?.active ? t('credits.subscribed') : busy === pro.id ? t('credits.working') : t('credits.subscribe')}
                    size="md"
                    colors={['#B8FF4A', '#5BE01E']}
                    textColor="#fff"
                    disabled={!!busy || !!account.subscription?.active}
                    onPress={() => purchase(pro)}
                  />
                  <T size={10} color={C.textMute} style={{ lineHeight: 14 }}>
                    {t('credits.disclosure', { price: pro.price })}
                  </T>
                </Card>
              </>
            )}

            <SectionTitle>{t('credits.packsTitle')}</SectionTitle>
            <View style={{ gap: 8 }}>
              {packs.map((o) => (
                <Card key={o.id} style={{ gap: 8 }}>
                  <View style={styles.row}>
                    <TokenCoin size={26} />
                    <View style={{ flex: 1 }}>
                      <T size={16} rounded color={C.text}>
                        {o.title}
                      </T>
                      <T size={12} color={C.textDim}>
                        {t('credits.packNote')}
                      </T>
                    </View>
                    <Pressable onPress={() => purchase(o)} disabled={!!busy} style={[styles.buy, !!busy && { opacity: 0.5 }]}>
                      {busy === o.id ? (
                        <ActivityIndicator color={C.ink} />
                      ) : (
                        <T size={14} rounded color={C.ink}>
                          {o.price}
                        </T>
                      )}
                    </Pressable>
                  </View>
                </Card>
              ))}
              {packs.length === 0 && !pro && (
                <T size={13} color={C.textDim}>
                  {t('credits.noProducts')}
                  {loadError ? `\n\n${loadError}` : ''}
                </T>
              )}
            </View>

            <Pressable
              onPress={async () => {
                tap();
                setBusy('restore');
                try {
                  await restore();
                  await actions.refreshAccount();
                  Alert.alert(t('credits.restoredTitle'), t('credits.restoredBody'));
                } catch (e) {
                  Alert.alert(t('credits.restoreFailed'), (e as Error).message);
                } finally {
                  setBusy(null);
                }
              }}
              style={styles.link}>
              <Icon name="retry" size={14} color={C.cyan} />
              <T size={13} rounded color={C.cyan}>
                {t('credits.restore')}
              </T>
            </Pressable>
          </>
        )}

        <SectionTitle>{t('credits.costsTitle')}</SectionTitle>
        <Card style={{ gap: 8 }}>
          {Object.entries(account.costs)
            .sort((a, b) => b[1] - a[1])
            .map(([f, n]) => (
              <View key={f} style={styles.between}>
                <T size={13} color={C.text}>
                  {FEATURE_LABELS[f] ?? f}
                </T>
                <T size={13} rounded color={n ? C.yellow : C.lime}>
                  {n ? t('credits.cost', { count: n }) : t('credits.free')}
                </T>
              </View>
            ))}
          {Object.keys(account.costs).length === 0 && (
            <T size={13} color={C.textDim}>
              {t('credits.pricesOffline')}
            </T>
          )}
        </Card>

        <View style={styles.legal}>
          <Pressable onPress={() => Linking.openURL(LEGAL.terms)}>
            <T size={12} color={C.textMute} style={{ textDecorationLine: 'underline' }}>
              {t('credits.terms')}
            </T>
          </Pressable>
          <Pressable onPress={() => Linking.openURL(LEGAL.privacy)}>
            <T size={12} color={C.textMute} style={{ textDecorationLine: 'underline' }}>
              {t('credits.privacy')}
            </T>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: Space.md, paddingTop: Space.lg, gap: Space.sm, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: Space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  buy: { minWidth: 86, alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, backgroundColor: C.yellow, borderWidth: 2, borderColor: C.ink, borderBottomWidth: 4 },
  link: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12 },
  legal: { flexDirection: 'row', justifyContent: 'center', gap: 20, marginTop: Space.md },
});
