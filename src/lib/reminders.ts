import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { t } from './i18n';
import { dayKey, macroTargets, streak, summarize } from './nutrition';
import type { Entry, Profile } from './types';

// Local notifications that keep the day on track: meals, water, a workout, rewards, the evening
// check-in and mood. One master switch (reminderHour set = on) plus a switch per kind. Everything is
// rescheduled whenever something is logged or the app opens, so today's nudges skip what's already
// done. Daytime nudges cover today and tomorrow; the evening check-in covers the next week, so a few
// days away still gets a nudge without piling up (iOS keeps at most 64 pending).

export type NotifyKind = 'meals' | 'water' | 'move' | 'rewards' | 'mood';
export const NOTIFY_KINDS: NotifyKind[] = ['meals', 'water', 'move', 'rewards', 'mood'];

const PREFIX = 'pulse-';
const EVENING_DAYS = 7;
const DAYTIME_DAYS = 2;

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldPlaySound: false, shouldSetBadge: false, shouldShowBanner: true, shouldShowList: true }),
});

export async function enableReminders() {
  if (Platform.OS === 'web') return false;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

/** Cancels every Pulse reminder (other notifications, like Squad nudges from the server, are push and unaffected). */
export async function cancelReminders() {
  if (Platform.OS === 'web') return;
  const pending = await Notifications.getAllScheduledNotificationsAsync().catch(() => []);
  await Promise.all(
    pending.filter((n) => n.identifier.startsWith(PREFIX)).map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier).catch(() => {})),
  );
}

export interface ReminderState {
  entries: Entry[];
  profile: Profile;
  /** Evening check-in hour. */
  hour: number;
  frozen?: string[];
  /** Kinds the user switched off. */
  off?: string[];
  chestsWaiting: number;
  /** Played today's arcade (which earns the free daily chest). */
  playedToday: boolean;
}

interface Slot {
  kind: NotifyKind | 'evening';
  /** Minutes after midnight. */
  at: number;
  /** For today only: true when it's already done, so there's nothing to nudge. */
  doneToday: (s: DayFacts) => boolean;
  content: (s: DayFacts, isToday: boolean) => { title: string; body: string };
}

/** Where tapping each kind of reminder takes you: the place to do what it suggests. */
const OPENS: Record<Slot['kind'], string> = {
  meals: '/(tabs)/coach',
  water: '/(tabs)', // the water chips sit at the top of HQ
  move: '/(tabs)/coach',
  rewards: '/(tabs)/arcade',
  mood: '/wellbeing',
  evening: '/(tabs)/coach',
};

interface DayFacts {
  meals: number[]; // minutes after midnight of each meal logged today
  waterMl: number;
  waterTarget: number;
  workouts: number;
  mood: boolean;
  logged: boolean;
  streak: number;
  chests: number;
  played: boolean;
}

const mealIn = (from: number, to: number) => (f: DayFacts) => f.meals.some((m) => m >= from && m < to);
// Behind pace: less than the share of the day's water that should be in by `at` (08:00 to 21:00).
const waterOnPace = (at: number) => (f: DayFacts) => f.waterTarget > 0 && f.waterMl >= f.waterTarget * Math.min(1, (at - 480) / 780);

const SLOTS: Slot[] = [
  { kind: 'meals', at: 8 * 60 + 30, doneToday: mealIn(0, 11 * 60), content: () => ({ title: t('notify.breakfastTitle'), body: t('notify.breakfastBody') }) },
  { kind: 'water', at: 10 * 60 + 30, doneToday: waterOnPace(10 * 60 + 30), content: () => ({ title: t('notify.waterTitle'), body: t('notify.waterBody') }) },
  { kind: 'meals', at: 12 * 60 + 30, doneToday: mealIn(11 * 60, 15 * 60), content: () => ({ title: t('notify.lunchTitle'), body: t('notify.lunchBody') }) },
  {
    kind: 'rewards',
    at: 13 * 60,
    doneToday: (f) => f.chests === 0 && f.played,
    content: (f, isToday) =>
      isToday && f.chests > 0
        ? { title: t('notify.chestTitle', { count: f.chests }), body: t('notify.chestBody') }
        : { title: t('notify.arcadeTitle'), body: t('notify.arcadeBody') },
  },
  { kind: 'meals', at: 15 * 60 + 30, doneToday: mealIn(14 * 60 + 30, 17 * 60), content: () => ({ title: t('notify.snackTitle'), body: t('notify.snackBody') }) },
  { kind: 'water', at: 16 * 60, doneToday: waterOnPace(16 * 60), content: () => ({ title: t('notify.water2Title'), body: t('notify.water2Body') }) },
  { kind: 'move', at: 17 * 60 + 30, doneToday: (f) => f.workouts > 0, content: () => ({ title: t('notify.moveTitle'), body: t('notify.moveBody') }) },
  { kind: 'meals', at: 18 * 60 + 45, doneToday: mealIn(17 * 60, 24 * 60), content: () => ({ title: t('notify.dinnerTitle'), body: t('notify.dinnerBody') }) },
  { kind: 'mood', at: 21 * 60 + 30, doneToday: (f) => f.mood, content: () => ({ title: t('notify.moodTitle'), body: t('notify.moodBody') }) },
];

function facts(s: ReminderState, now: Date): DayFacts {
  const today = dayKey(now);
  const todays = s.entries.filter((e) => !e.passive && dayKey(e.createdAt) === today);
  const sum = summarize(s.entries, today);
  const minutes = (ms: number) => {
    const d = new Date(ms);
    return d.getHours() * 60 + d.getMinutes();
  };
  return {
    meals: todays.filter((e) => e.kind === 'meal').map((e) => minutes(e.createdAt)),
    waterMl: sum.water,
    waterTarget: macroTargets(s.profile).waterMl ?? 0,
    workouts: todays.filter((e) => e.kind === 'exercise').length,
    mood: todays.some((e) => e.kind === 'journal' && e.mood != null),
    logged: todays.length > 0,
    streak: streak(s.entries, s.frozen ?? []),
    chests: s.chestsWaiting,
    played: s.playedToday,
  };
}

/** Schedules every reminder that's switched on, from now on. Replaces whatever was scheduled before. */
export async function scheduleReminder(s: ReminderState) {
  if (Platform.OS === 'web') return;
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') return;
  await cancelReminders();

  const now = new Date();
  const f = facts(s, now);
  const off = new Set(s.off ?? []);
  const at = (day: number, minute: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() + day);
    d.setHours(Math.floor(minute / 60), minute % 60, 0, 0);
    return d;
  };
  const plan: { id: string; when: Date; title: string; body: string; url: string }[] = [];

  for (let day = 0; day < DAYTIME_DAYS; day++) {
    SLOTS.forEach((slot, i) => {
      if (off.has(slot.kind)) return;
      const when = at(day, slot.at);
      if (when <= now) return;
      if (day === 0 && slot.doneToday(f)) return;
      plan.push({ id: `${PREFIX}${slot.kind}-${i}-${day}`, when, url: OPENS[slot.kind], ...slot.content(f, day === 0) });
    });
  }

  // The evening check-in: a streak warning on the first evening without a log, a check-in on a day
  // that's already logged, and an invitation back once the streak would be gone.
  let streakAtStake = f.streak > 0;
  for (let day = 0; day < EVENING_DAYS; day++) {
    const when = at(day, s.hour * 60);
    if (when <= now) continue;
    let title: string;
    let body: string;
    if (day === 0 && f.logged) {
      title = t('crew.reminderCheckInTitle');
      body = t('crew.reminderCheckInBody');
    } else if (streakAtStake) {
      title = t('crew.reminderStreakTitle', { count: f.streak });
      body = t('crew.reminderStreakBody');
      streakAtStake = false;
    } else {
      title = t('crew.reminderMissTitle');
      body = t('crew.reminderMissBody');
    }
    plan.push({ id: `${PREFIX}evening-${day}`, when, title, body, url: OPENS.evening });
  }

  for (const n of plan) {
    await Notifications.scheduleNotificationAsync({
      identifier: n.id,
      content: { title: n.title, body: n.body, data: { url: n.url } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: n.when },
    });
  }
}
