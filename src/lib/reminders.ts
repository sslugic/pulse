import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { t } from './i18n';
import { dayKey, streak } from './nutrition';
import type { Entry } from './types';

// An evening reminder every day for the next week. A day that's already logged gets a check-in instead
// of a streak warning. They're rescheduled whenever something is logged or the app opens, so the
// wording stays current, and a week away still gets nudged.

const ID = 'pulse-streak-reminder';
const DAYS = 7;
const idFor = (i: number) => `${ID}-${i}`;

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldPlaySound: false, shouldSetBadge: false, shouldShowBanner: true, shouldShowList: true }),
});

export async function enableReminders() {
  if (Platform.OS === 'web') return false;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export async function cancelReminders() {
  if (Platform.OS === 'web') return;
  // The bare ID is from builds that scheduled a single reminder.
  await Promise.all([ID, ...Array.from({ length: DAYS }, (_, i) => idFor(i))].map((id) => Notifications.cancelScheduledNotificationAsync(id).catch(() => {})));
}

/** Schedules the evening reminders at `hour`:00 for the next week, starting today unless it's past. */
export async function scheduleReminder(entries: Entry[], hour: number, frozen: string[] = []) {
  if (Platform.OS === 'web') return;
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') return;
  await cancelReminders();

  const now = new Date();
  const first = new Date(now);
  first.setHours(hour, 0, 0, 0);
  if (first <= now) first.setDate(first.getDate() + 1);
  const loggedToday = entries.some((e) => !e.passive && dayKey(e.createdAt) === dayKey(now));

  // The first evening without a log is the one protecting the current streak; after a missed day
  // the streak is gone, so later evenings invite them back instead.
  const run = streak(entries, frozen);
  let streakAtStake = run > 0;
  for (let i = 0; i < DAYS; i++) {
    const when = new Date(first);
    when.setDate(first.getDate() + i);
    let title: string;
    let body: string;
    if (loggedToday && dayKey(when.getTime()) === dayKey(now)) {
      title = t('crew.reminderCheckInTitle');
      body = t('crew.reminderCheckInBody');
    } else if (streakAtStake) {
      title = t('crew.reminderStreakTitle', { count: run });
      body = t('crew.reminderStreakBody');
      streakAtStake = false;
    } else {
      title = t('crew.reminderMissTitle');
      body = t('crew.reminderMissBody');
    }
    await Notifications.scheduleNotificationAsync({
      identifier: idFor(i),
      content: { title, body },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: when },
    });
  }
}
