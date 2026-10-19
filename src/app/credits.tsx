import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassButton, Icon } from '@/components/icon';
import { TokenCoin } from '@/components/quests-card';
import { Card, SectionTitle, T, tap } from '@/components/ui';
import { ArcadeButton, Backdrop, Comic } from '@/components/underground';
import { C, MaxContentWidth, Space } from '@/constants/theme';
import { LEGAL } from '@/lib/legal';
import { buy, loadOffers, purchasesConfigured, restore, type CreditOffer } from '@/lib/purchases';
import { actions, useStore } from '@/lib/store';

const FEATURE_LABELS: Record<string, string> = {
  coach: 'Coach reply (text)',
  coach_media: 'Coach reply (voice note or photo)',
  voice: 'Reply read aloud',
  meal_plan: 'Meal plan',
  workout_plan: 'Workout plan',
  recap: 'Weekly recap',
  wellbeing: 'Stress and sleep analysis',
  goal_plan: 'Nutrition targets from a goal',
  insight: 'Daily insight on HQ',
  estimate: 'Fixing a meal with missing calories',
};

/** AI credits: balance, what things cost, credit packs, Pulse Pro, and restore. */
export default function CreditsScreen() {
  const insets = useSafeAreaInsets();
  const account = useStore((s) => s.account);
  const [offers, setOffers] = useState<CreditOffer[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    actions.refreshAccount();
    loadOffers()
      .then(setOffers)
      .catch(() => setOffers([]));
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
        Alert.alert('Thanks!', 'Your credits have been added.');
      }
    } catch (e) {
      Alert.alert('Purchase failed', (e as Error).message);
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
              Powers the Coach, plans and recaps
            </T>
            <Comic size={36}>AI CREDITS</Comic>
          </View>
          <GlassButton icon="close" onPress={() => router.back()} />
        </View>

        <Card style={{ gap: 6, alignItems: 'center' }} accent={C.yellow + 'AA'}>
          <T size={11} rounded color={C.textDim}>
            YOUR BALANCE
          </T>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <TokenCoin size={34} />
            <Comic size={48} color={C.yellow}>
              {account.credits != null ? account.credits.toLocaleString() : '—'}
            </Comic>
          </View>
          {account.subscription?.active && (
            <T size={12} rounded color={C.lime}>
              PULSE PRO ACTIVE{account.subscription.expiresAt ? ` · RENEWS ${new Date(account.subscription.expiresAt).toLocaleDateString()}` : ''}
            </T>
          )}
        </Card>

        {!account.userId ? (
          <Card style={{ gap: 10 }}>
            <T size={14} color={C.text}>
              Sign in to get 50 free credits and buy more.
            </T>
            <ArcadeButton label="GO TO ACCOUNT" size="md" onPress={() => router.replace('/profile')} />
          </Card>
        ) : !purchasesConfigured ? (
          <Card>
            <T size={13} color={C.textDim}>
              In-app purchases aren’t set up in this build yet.
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
                        {pro.description || '1,000 AI credits every month'}
                      </T>
                    </View>
                    <T size={16} rounded color={C.lime}>
                      {pro.price}/mo
                    </T>
                  </View>
                  <ArcadeButton
                    label={account.subscription?.active ? 'SUBSCRIBED' : busy === pro.id ? 'WORKING…' : `SUBSCRIBE · ${pro.price}/MONTH`}
                    size="md"
                    colors={['#B8FF4A', '#5BE01E']}
                    textColor={C.ink}
                    disabled={!!busy || !!account.subscription?.active}
                    onPress={() => purchase(pro)}
                  />
                  <T size={10} color={C.textMute} style={{ lineHeight: 14 }}>
                    {pro.price} per month, billed to your Apple ID. Renews automatically unless cancelled at least 24 hours before the end of the period. Manage or
                    cancel in your App Store account settings. Unused monthly credits roll over while you stay subscribed.
                  </T>
                </Card>
              </>
            )}

            <SectionTitle>Credit packs</SectionTitle>
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
                        One-time purchase · never expires
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
                  No products available right now. Try again later.
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
                  Alert.alert('Restored', 'Your purchases are up to date.');
                } catch (e) {
                  Alert.alert('Restore failed', (e as Error).message);
                } finally {
                  setBusy(null);
                }
              }}
              style={styles.link}>
              <Icon name="retry" size={14} color={C.cyan} />
              <T size={13} rounded color={C.cyan}>
                RESTORE PURCHASES
              </T>
            </Pressable>
          </>
        )}

        <SectionTitle>What things cost</SectionTitle>
        <Card style={{ gap: 8 }}>
          {Object.entries(account.costs)
            .sort((a, b) => b[1] - a[1])
            .map(([f, n]) => (
              <View key={f} style={styles.between}>
                <T size={13} color={C.text}>
                  {FEATURE_LABELS[f] ?? f}
                </T>
                <T size={13} rounded color={n ? C.yellow : C.lime}>
                  {n ? `${n} credit${n === 1 ? '' : 's'}` : 'FREE'}
                </T>
              </View>
            ))}
          {Object.keys(account.costs).length === 0 && (
            <T size={13} color={C.textDim}>
              Prices load when you’re online.
            </T>
          )}
        </Card>

        <View style={styles.legal}>
          <Pressable onPress={() => Linking.openURL(LEGAL.terms)}>
            <T size={12} color={C.textMute} style={{ textDecorationLine: 'underline' }}>
              Terms of Use (EULA)
            </T>
          </Pressable>
          <Pressable onPress={() => Linking.openURL(LEGAL.privacy)}>
            <T size={12} color={C.textMute} style={{ textDecorationLine: 'underline' }}>
              Privacy Policy
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
