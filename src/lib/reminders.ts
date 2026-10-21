import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { t } from './i18n';
import { dayKey, streak } from './nutrition';
import type { Entry } from './types';

// Evening reminders for the next week, skipping today once it's logged. They're rescheduled whenever
// something is logged or the app opens, so a logged day never nags, and a week away still gets nudged.

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

/** Schedules the evening reminders at `hour`:00 for the next week, skipping today if it's already logged or past. */
export async function scheduleReminder(entries: Entry[], hour: number, frozen: string[] = []) {
  if (Platform.OS === 'web') return;
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') return;
  await cancelReminders();

  const now = new Date();
  const first = new Date(now);
  first.setHours(hour, 0, 0, 0);
  const loggedToday = entries.some((e) => !e.passive && dayKey(e.createdAt) === dayKey(now));
  if (loggedToday || first <= now) first.setDate(first.getDate() + 1);

  // The streak they'd be protecting on the first evening; after a missed day it's gone, so later ones invite them back.
  const run = streak(entries, frozen);
  for (let i = 0; i < DAYS; i++) {
    const when = new Date(first);
    when.setDate(first.getDate() + i);
    const keep = run > 0 && i === 0;
    await Notifications.scheduleNotificationAsync({
      identifier: idFor(i),
      content: {
        title: keep ? t('crew.reminderStreakTitle', { count: run }) : t('crew.reminderMissTitle'),
        body: keep ? t('crew.reminderStreakBody') : t('crew.reminderMissBody'),
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: when },
    });
  }
}
