import {
  CategoryValueSleepAnalysis,
  getRequestStatusForAuthorization,
  isHealthDataAvailable,
  queryCategorySamples,
  queryQuantitySamples,
  queryStatisticsForQuantity,
  queryWorkoutSamples,
  requestAuthorization,
  WorkoutActivityType,
} from '@kingstinct/react-native-healthkit';
import { useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';

import { t } from './i18n';
import { dayKey } from './nutrition';
import type { Entry } from './types';

// Apple Health, read-only. Titles are stored in the app's language at import time. Workouts, sleep and weigh-ins become Pulse entries (tagged with the
// HealthKit uuid so a sync never duplicates them); steps are shown live on HQ.

export const healthAvailable = () => Platform.OS === 'ios' && isHealthDataAvailable();

const READ = [
  'HKWorkoutTypeIdentifier',
  'HKQuantityTypeIdentifierStepCount',
  'HKQuantityTypeIdentifierBodyMass',
  'HKQuantityTypeIdentifierActiveEnergyBurned',
  'HKCategoryTypeIdentifierSleepAnalysis',
] as const;

export async function connectHealth() {
  if (!healthAvailable()) return false;
  return requestAuthorization({ toRead: READ });
}

/**
 * Asks again only if iOS says there's something to ask (a data type added since the user last
 * answered, or access that was reset). iOS never says whether reading was denied, so this is all we can check.
 */
export async function ensureHealthAccess() {
  // 1 = AuthorizationRequestStatus.shouldRequest
  if ((await getRequestStatusForAuthorization({ toRead: READ })) === 1) await requestAuthorization({ toRead: READ });
}

// [log.* title key, emoji]
const WORKOUT_NAMES: Partial<Record<WorkoutActivityType, [string, string]>> = {
  [WorkoutActivityType.running]: ['workoutRun', '🏃'],
  [WorkoutActivityType.walking]: ['workoutWalk', '🚶'],
  [WorkoutActivityType.cycling]: ['workoutRide', '🚴'],
  [WorkoutActivityType.swimming]: ['workoutSwim', '🏊'],
  [WorkoutActivityType.traditionalStrengthTraining]: ['workoutStrength', '🏋️'],
  [WorkoutActivityType.functionalStrengthTraining]: ['workoutFunctional', '🏋️'],
  [WorkoutActivityType.highIntensityIntervalTraining]: ['workoutHiit', '🔥'],
  [WorkoutActivityType.yoga]: ['workoutYoga', '🧘'],
  [WorkoutActivityType.hiking]: ['workoutHike', '🥾'],
  [WorkoutActivityType.rowing]: ['workoutRow', '🚣'],
  [WorkoutActivityType.elliptical]: ['workoutElliptical', '🏃'],
  [WorkoutActivityType.coreTraining]: ['workoutCore', '💪'],
  [WorkoutActivityType.dance]: ['workoutDance', '💃'],
};

export type HealthEntry = Omit<Entry, 'id'>;

/** New entries from Health since `since`, skipping anything already imported (by uuid). */
export async function pullHealth(since: Date, known: Set<string>): Promise<HealthEntry[]> {
  const out: HealthEntry[] = [];
  const date = { startDate: since, endDate: new Date() };

  const workouts = await queryWorkoutSamples({ limit: 0, filter: { date } });
  for (const w of workouts) {
    const j = w.toJSON();
    w.dispose();
    if (known.has(j.uuid)) continue;
    const [titleKey, emoji] = WORKOUT_NAMES[j.workoutActivityType] ?? ['workout', '💪'];
    const title = t(`log.${titleKey}`);
    const minutes = Math.round((j.endDate.getTime() - j.startDate.getTime()) / 60000);
    const kcal = j.totalEnergyBurned?.quantity;
    out.push({
      kind: 'exercise',
      title,
      emoji,
      createdAt: j.startDate.getTime(),
      durationMin: minutes,
      caloriesBurned: kcal != null ? Math.round(kcal) : Math.round(minutes * 6),
      intensity: minutes && kcal && kcal / minutes > 9 ? 'high' : 'moderate',
      source: 'quick',
      note: t('log.fromHealth'),
      healthId: j.uuid,
    });
  }

  const weights = await queryQuantitySamples('HKQuantityTypeIdentifierBodyMass', { limit: 0, unit: 'kg', filter: { date } });
  for (const s of weights) {
    if (known.has(s.uuid)) continue;
    out.push({ kind: 'weight', title: t('log.weighIn'), emoji: '⚖️', createdAt: s.startDate.getTime(), weightKg: Math.round(s.quantity * 100) / 100, source: 'quick', note: t('log.fromHealth'), healthId: s.uuid });
  }

  // Sleep: one journal entry per night, summing the asleep stages that ended that morning.
  const sleep = await queryCategorySamples('HKCategoryTypeIdentifierSleepAnalysis', { limit: 0, filter: { date: { startDate: new Date(since.getTime() - 12 * 3600_000), endDate: new Date() } } });
  const nights = new Map<string, { ms: number; end: number; ids: string[] }>();
  for (const s of sleep) {
    if (s.value === CategoryValueSleepAnalysis.inBed || s.value === CategoryValueSleepAnalysis.awake) continue;
    const end = s.endDate;
    const key = `${end.getFullYear()}-${end.getMonth()}-${end.getDate()}`;
    const n = nights.get(key) ?? { ms: 0, end: 0, ids: [] };
    n.ms += end.getTime() - s.startDate.getTime();
    n.end = Math.max(n.end, end.getTime());
    n.ids.push(s.uuid);
    nights.set(key, n);
  }
  for (const [key, n] of nights) {
    const id = `sleep:${key}`;
    if (known.has(id) || n.ms < 2 * 3600_000) continue;
    const hours = Math.round((n.ms / 3600_000) * 2) / 2;
    out.push({ kind: 'journal', title: t('log.sleptHours', { h: hours }), emoji: '😴', createdAt: n.end, sleepHours: hours, source: 'quick', note: t('log.fromHealth'), healthId: id });
  }
  return out;
}

/**
 * Active energy (kcal) Health recorded on each day from `since` to today. This includes walks and
 * other movement the iPhone or Watch tracked without a workout being started.
 */
export async function activeEnergyByDay(since: Date): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  const start = new Date(since);
  start.setHours(0, 0, 0, 0);
  for (const d = start; d.getTime() <= Date.now(); d.setDate(d.getDate() + 1)) {
    const from = new Date(d);
    const to = new Date(d);
    to.setDate(to.getDate() + 1);
    const r = await queryStatisticsForQuantity('HKQuantityTypeIdentifierActiveEnergyBurned', ['cumulativeSum'], {
      filter: { date: { startDate: from, endDate: to.getTime() > Date.now() ? new Date() : to } },
      unit: 'kcal',
    });
    out.set(dayKey(from), Math.round(r.sumQuantity?.quantity ?? 0));
  }
  return out;
}

/** Today's step count from Health, or null if unavailable. */
export async function stepsToday(): Promise<number | null> {
  if (!healthAvailable()) return null;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const r = await queryStatisticsForQuantity('HKQuantityTypeIdentifierStepCount', ['cumulativeSum'], { filter: { date: { startDate: start, endDate: new Date() } }, unit: 'count' });
  return r.sumQuantity ? Math.round(r.sumQuantity.quantity) : 0;
}

/** Live step count for HQ: refreshed on mount, when the app comes back to the foreground, and every 2 minutes. */
export function useSteps(enabled: boolean) {
  const [steps, setSteps] = useState<number | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    const load = () =>
      stepsToday()
        .then((n) => alive && setSteps(n))
        .catch(() => {});
    load();
    const sub = AppState.addEventListener('change', (s) => s === 'active' && load());
    const timer = setInterval(load, 120_000);
    return () => {
      alive = false;
      sub.remove();
      clearInterval(timer);
    };
  }, [enabled]);
  return enabled ? steps : null;
}
