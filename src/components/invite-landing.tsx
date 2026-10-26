import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { C } from '@/constants/theme';
import { t } from '@/lib/i18n';
import { addFriend, holdInvite, joinCrew, refreshSquad, useSquad } from '@/lib/social';
import { useStore } from '@/lib/store';

import { T } from './ui';
import { ArcadeButton, Backdrop, Comic } from './underground';

// Where an invite link lands: pulse://add/CODE or pulse://join/CODE, or the same invite opened from
// pulseretro.fit/invite.html (see +native-intent). Signed in with a Squad card, it adds the friend or
// joins the crew right away; otherwise it keeps the invite and applies it as soon as there's a card.

export function InviteLanding({ kind, code }: { kind: 'friend' | 'crew'; code: string }) {
  const userId = useStore((s) => s.account.userId);
  const loaded = useSquad((s) => s.loaded);
  // Whether there's a card, not the card itself: the card is a new object after every refresh.
  const me = useSquad((s) => !!s.me);
  const applied = useRef<string | null>(null);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  // Not signed in, or no Squad card yet: say what to do first.
  const setup = !userId ? t('squad.inviteSignInFirst', { code }) : loaded && !me ? t('squad.inviteJoinFirst', { code }) : null;

  useEffect(() => {
    if (setup) holdInvite({ kind, code });
  }, [setup, kind, code]);

  useEffect(() => {
    if (!userId) return;
    if (!loaded) {
      refreshSquad();
      return;
    }
    if (!me) return;
    // Once per invite: adding the friend refreshes the Squad, which would otherwise run this again.
    const key = `${kind}:${code}`;
    if (applied.current === key) return;
    applied.current = key;
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
