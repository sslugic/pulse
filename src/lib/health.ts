import {
  CategoryValueSleepAnalysis,
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

import type { Entry } from './types';

// Apple Health, read-only. Workouts, sleep and weigh-ins become Pulse entries (tagged with the
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

const WORKOUT_NAMES: Partial<Record<WorkoutActivityType, [string, string]>> = {
  [WorkoutActivityType.running]: ['Run', '🏃'],
  [WorkoutActivityType.walking]: ['Walk', '🚶'],
  [WorkoutActivityType.cycling]: ['Ride', '🚴'],
  [WorkoutActivityType.swimming]: ['Swim', '🏊'],
  [WorkoutActivityType.traditionalStrengthTraining]: ['Strength training', '🏋️'],
  [WorkoutActivityType.functionalStrengthTraining]: ['Functional training', '🏋️'],
  [WorkoutActivityType.highIntensityIntervalTraining]: ['HIIT', '🔥'],
  [WorkoutActivityType.yoga]: ['Yoga', '🧘'],
  [WorkoutActivityType.hiking]: ['Hike', '🥾'],
  [WorkoutActivityType.rowing]: ['Row', '🚣'],
  [WorkoutActivityType.elliptical]: ['Elliptical', '🏃'],
  [WorkoutActivityType.coreTraining]: ['Core training', '💪'],
  [WorkoutActivityType.dance]: ['Dance', '💃'],
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
    const [title, emoji] = WORKOUT_NAMES[j.workoutActivityType] ?? ['Workout', '💪'];
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
      note: 'From Apple Health',
      healthId: j.uuid,
    });
  }

  const weights = await queryQuantitySamples('HKQuantityTypeIdentifierBodyMass', { limit: 0, unit: 'kg', filter: { date } });
  for (const s of weights) {
    if (known.has(s.uuid)) continue;
    out.push({ kind: 'weight', title: 'Weigh-in', emoji: '⚖️', createdAt: s.startDate.getTime(), weightKg: Math.round(s.quantity * 100) / 100, source: 'quick', note: 'From Apple Health', healthId: s.uuid });
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
    out.push({ kind: 'journal', title: `Slept ${hours}h`, emoji: '😴', createdAt: n.end, sleepHours: hours, source: 'quick', note: 'From Apple Health', healthId: id });
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
