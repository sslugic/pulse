import { Alert, StyleSheet, View } from 'react-native';

import { C } from '@/constants/theme';
import { t } from '@/lib/i18n';
import { addFriend, colorOf, joinCrew, type Challenge, type ChallengeTemplate } from '@/lib/social';

import { T, tap } from './ui';

// Small pieces shared by the Squad tab, the crew screen and the invite links.

/** Shows a Squad error, ignoring a cancelled Apple sign-in. */
export function squadFail(e: unknown) {
  const err = e as { code?: string; message?: string };
  if (err.code !== 'ERR_REQUEST_CANCELED') Alert.alert(t('squad.errorTitle'), err.message ?? t('squad.errGeneric'));
}

/** A player's initial on their colour; grey when hidden by a block. */
export function Avatar({ name, color, size = 34, dim }: { name: string | null; color: string; size?: number; dim?: boolean }) {
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: dim ? C.surfaceHi : colorOf(color) }]}>
      <T size={size * 0.48} rounded color={C.ink}>
        {(name ?? '?').slice(0, 1).toUpperCase()}
      </T>
    </View>
  );
}

/** "Hit your protein 5 of 7 days" and the like. */
export const challengeTitle = (template: ChallengeTemplate, target: number, days: number) => t(`squad.tpl_${template}`, { count: target, days });

/** How many days a challenge runs. */
export const challengeLength = (c: Pick<Challenge, 'starts' | 'ends'>) =>
  Math.round((new Date(c.ends + 'T12:00').getTime() - new Date(c.starts + 'T12:00').getTime()) / 864e5) + 1;

/** Uses an invite code: a friend's if it is one, otherwise a crew's. Returns what it joined. */
export async function redeemInviteCode(code: string): Promise<{ kind: 'friend' | 'crew'; name: string }> {
  try {
    return { kind: 'friend', name: await addFriend(code) };
  } catch (e) {
    if ((e as { code?: string }).code !== 'code_not_found') throw e;
    const crew = await joinCrew(code);
    return { kind: 'crew', name: crew.name };
  }
}

/** One box for both kinds of invite code. */
export function enterCode() {
  tap();
  Alert.prompt(t('squad.enterCodeTitle'), t('squad.enterCodeBody'), async (code) => {
    if (!code?.trim()) return;
    try {
      const r = await redeemInviteCode(code);
      if (r.kind === 'friend') Alert.alert(t('squad.friendAddedTitle'), t('squad.friendAddedBody', { name: r.name }));
      else Alert.alert(t('squad.crewJoinedTitle'), t('squad.crewJoinedBody', { name: r.name }));
    } catch (e) {
      squadFail(e);
    }
  });
}

const styles = StyleSheet.create({
  avatar: { alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: C.ink },
});
