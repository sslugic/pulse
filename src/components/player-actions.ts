import { router } from 'expo-router';
import { ActionSheetIOS, Alert, Platform } from 'react-native';

import { tap } from '@/lib/haptics';
import { t } from '@/lib/i18n';
import { blockPlayer, getSquad, needsNudge, nudge, removeFriend, reportPlayer, type ReportReason } from '@/lib/social';

// The menu behind a friend or crewmate: nudge, challenge, unfriend, report and block. Report and
// block are on every player, as App Store guideline 1.2 asks for apps with user content.

function sheet(title: string | undefined, options: { label: string; destructive?: boolean; run: () => void }[]) {
  const labels = [...options.map((o) => o.label), t('squad.cancel')];
  const destructive = options.flatMap((o, i) => (o.destructive ? [i] : []));
  if (Platform.OS === 'ios') {
    ActionSheetIOS.showActionSheetWithOptions(
      { title, options: labels, cancelButtonIndex: labels.length - 1, destructiveButtonIndex: destructive, userInterfaceStyle: 'dark' },
      (i) => options[i]?.run(),
    );
  } else {
    Alert.alert(title ?? '', undefined, [...options.map((o) => ({ text: o.label, style: o.destructive ? ('destructive' as const) : undefined, onPress: o.run })), { text: t('squad.cancel'), style: 'cancel' }]);
  }
}

const fail = (e: unknown) => Alert.alert(t('squad.errorTitle'), (e as Error).message);

export function openPlayerActions(p: { userId: string; name: string; lastDay?: string; loggedToday?: boolean; crewId?: string }) {
  tap();
  const squad = getSquad();
  const friend = squad.friends.has(p.userId);
  const options: { label: string; destructive?: boolean; run: () => void }[] = [];
  if (needsNudge(p) && !squad.nudgedToday.has(p.userId)) {
    options.push({ label: t('squad.nudge'), run: () => sendNudge(p.userId, p.name) });
  }
  if (friend) {
    options.push({ label: t('squad.challenge'), run: () => router.push({ pathname: '/challenge-new', params: { opponent: p.userId } }) });
    options.push({
      label: t('squad.removeFriend'),
      destructive: true,
      run: () =>
        Alert.alert(t('squad.removeFriendTitle', { name: p.name }), t('squad.removeFriendBody'), [
          { text: t('squad.cancel'), style: 'cancel' },
          { text: t('squad.remove'), style: 'destructive', onPress: () => removeFriend(p.userId).catch(fail) },
        ]),
    });
  }
  options.push({ label: t('squad.report'), destructive: true, run: () => openReport(p.userId, p.name, p.crewId) });
  options.push({ label: t('squad.block'), destructive: true, run: () => confirmBlock(p.userId, p.name) });
  sheet(p.name, options);
}

export async function sendNudge(userId: string, name: string) {
  tap();
  try {
    await nudge(userId);
    Alert.alert(t('squad.nudgedTitle'), t('squad.nudgedBody', { name }));
  } catch (e) {
    fail(e);
  }
}

function openReport(userId: string, name: string, crewId?: string) {
  const reasons: ReportReason[] = ['name', 'harassment', 'cheating', 'other'];
  sheet(t('squad.reportTitle', { name }), reasons.map((r) => ({
    label: t(`squad.reason_${r}`),
    run: () =>
      reportPlayer(userId, r, undefined, crewId)
        .then(() =>
          Alert.alert(t('squad.reportedTitle'), t('squad.reportedBody'), [
            { text: t('squad.alsoBlock'), style: 'destructive', onPress: () => confirmBlock(userId, name) },
            { text: t('squad.ok') },
          ]),
        )
        .catch(fail),
  })));
}

function confirmBlock(userId: string, name: string) {
  Alert.alert(t('squad.blockTitle', { name }), t('squad.blockBody'), [
    { text: t('squad.cancel'), style: 'cancel' },
    { text: t('squad.block'), style: 'destructive', onPress: () => blockPlayer(userId).catch(fail) },
  ]);
}
