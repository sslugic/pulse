import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { dayKey, streak } from './nutrition';
import type { Entry } from './types';

// One local reminder at a time: the evening of the next day that hasn't been logged yet.
// It's rescheduled whenever something is logged or the app opens, so a logged day never nags.

const ID = 'pulse-streak-reminder';

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
  await Notifications.cancelScheduledNotificationAsync(ID).catch(() => {});
}

/** Schedules the next evening reminder at `hour`:00, skipping today if it's already logged or past. */
export async function scheduleReminder(entries: Entry[], hour: number, frozen: string[] = []) {
  if (Platform.OS === 'web') return;
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') return;
  await cancelReminders();

  const now = new Date();
  const when = new Date(now);
  when.setHours(hour, 0, 0, 0);
  const loggedToday = entries.some((e) => !e.passive && dayKey(e.createdAt) === dayKey(now));
  if (loggedToday || when <= now) when.setDate(when.getDate() + 1);

  // The streak they'd be protecting on that evening.
  const run = streak(entries, frozen);
  const title = run > 0 ? `🔥 Don’t break your ${run}-day streak` : '👋 Your crew misses you';
  const body = run > 0 ? 'Log one thing before midnight: a meal, some water or how you feel.' : 'Log anything today to start a new streak and earn XP.';

  await Notifications.scheduleNotificationAsync({
    identifier: ID,
    content: { title, body },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: when },
  });
}
