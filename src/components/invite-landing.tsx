import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { C } from '@/constants/theme';
import { t } from '@/lib/i18n';
import { addFriend, joinCrew, refreshSquad, useSquad } from '@/lib/social';
import { useStore } from '@/lib/store';

import { T } from './ui';
import { ArcadeButton, Backdrop, Comic } from './underground';

// Where an invite link lands (pulse://add/CODE for a friend, pulse://join/CODE for a crew). Signed in
// with a Squad card, it adds the friend or joins the crew right away; otherwise it explains what to
// do first and keeps the code for the Squad tab's "Enter code" box.

export function InviteLanding({ kind, code }: { kind: 'friend' | 'crew'; code: string }) {
  const userId = useStore((s) => s.account.userId);
  const loaded = useSquad((s) => s.loaded);
  const me = useSquad((s) => s.me);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  // Not signed in, or no Squad card yet: say what to do first.
  const setup = !userId ? t('squad.inviteSignInFirst', { code }) : loaded && !me ? t('squad.inviteJoinFirst', { code }) : null;

  useEffect(() => {
    if (!userId) return;
    if (!loaded) {
      refreshSquad();
      return;
    }
    if (!me) return;
    let cancelled = false;
    (kind === 'friend' ? addFriend(code).then((name) => t('squad.friendAddedBody', { name })) : joinCrew(code).then((c) => t('squad.crewJoinedBody', { name: c.name })))
      .then((text) => !cancelled && setResult({ ok: true, text }))
      .catch((e) => !cancelled && setResult({ ok: false, text: (e as Error).message }));
    return () => {
      cancelled = true;
    };
  }, [userId, loaded, me, kind, code]);

  const text = setup ?? result?.text;
  return (
    <View style={styles.wrap}>
      <Backdrop tags={['SQUAD', code]} />
      <Comic size={36} style={{ textAlign: 'center' }}>
        {kind === 'friend' ? t('squad.inviteFriendTitle') : t('squad.inviteCrewTitle')}
      </Comic>
      {text ? (
        <T size={15} color={result && !result.ok ? C.danger : C.text} style={{ textAlign: 'center', lineHeight: 21 }}>
          {text}
        </T>
      ) : (
        <ActivityIndicator color={C.lime} />
      )}
      <ArcadeButton label={t('squad.openSquad')} size="md" onPress={() => router.replace('/(tabs)/squad')} style={{ alignSelf: 'stretch' }} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', gap: 24, padding: 24 },
});
