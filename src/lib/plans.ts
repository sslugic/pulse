import type { MealPlan, PlannedMeal, WorkoutDay } from './gemini';
import { dayKey } from './nutrition';
import type { Entry } from './types';

// Meal and workout plans, stored per calendar day. Logged meals and workouts are matched to the
// plan as they come in; when a day is over its result is kept in history and the day is cleared.

export type MealSpan = 'today' | '3days';
export type WorkoutSpan = 'today' | '3days' | '7days';

export interface MealPlanState {
  days: { day: string; meals: PlannedMeal[] }[];
  grocery: MealPlan['grocery'];
  summary: string;
  checked: string[]; // ticked grocery items
  eaten: Record<string, string>; // "day#index" -> entry id that matched it
  auto: boolean; // made automatically for the day, not by the user
  at: number;
}

export interface WorkoutPlanState {
  days: (WorkoutDay & { day: string })[];
  summary: string;
  done: Record<string, string>; // day -> exercise entry id that completed it
  auto: boolean;
  at: number;
}

/** What happened to a finished day's plan, kept after the plan itself is cleared. */
export interface PlanResult {
  mealsPlanned: number;
  mealsEaten: number;
  workout?: 'done' | 'missed' | 'rest';
}

export const mealKey = (day: string, i: number) => `${day}#${i}`;

/** Day keys from today, one per planned day. */
export function nextDays(n: number, from = new Date()) {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(from);
    d.setDate(d.getDate() + i);
    return dayKey(d);
  });
}

export const spanDays = (span: MealSpan | WorkoutSpan) => (span === '7days' ? 7 : span === '3days' ? 3 : 1);

const STOP = new Set(['with', 'and', 'the', 'some', 'side', 'bowl', 'plate', 'cup', 'cups', 'glass', 'fresh', 'grilled', 'baked', 'homemade']);
const words = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 3 && !STOP.has(w))
    .map((w) => w.replace(/s$/, ''));

const slotFor = (t: number) => {
  const h = new Date(t).getHours();
  return h < 11 ? 'breakfast' : h < 15 ? 'lunch' : h < 17 ? 'snack' : 'dinner';
};

/**
 * The planned meal a logged meal most likely fulfils: a shared food word wins; otherwise the same
 * meal slot (by time of day) with calories within 40%. Returns the plan index or -1.
 */
export function matchMeal(entry: Entry, meals: PlannedMeal[], taken: Set<number>): number {
  const kcal = entry.nutrition?.calories ?? 0;
  const ew = new Set(words(`${entry.title} ${(entry.items ?? []).map((i) => i.name).join(' ')}`));
  let best = -1;
  let bestScore = 0;
  meals.forEach((m, i) => {
    if (taken.has(i)) return;
    const overlap = words(`${m.name} ${m.ingredients.join(' ')}`).filter((w) => ew.has(w)).length;
    const sameSlot = m.when.toLowerCase().startsWith(slotFor(entry.createdAt).slice(0, 4));
    const closeKcal = kcal > 0 && Math.abs(kcal - m.calories) <= m.calories * 0.4;
    const score = overlap * 2 + (sameSlot ? 1 : 0) + (closeKcal ? 1 : 0);
    if ((overlap > 0 || (sameSlot && closeKcal)) && score > bestScore) {
      best = i;
      bestScore = score;
    }
  });
  return best;
}

export function resultFor(day: string, meals?: MealPlanState, workouts?: WorkoutPlanState): PlanResult | undefined {
  const md = meals?.days.find((d) => d.day === day);
  const wd = workouts?.days.find((d) => d.day === day);
  if (!md && !wd) return undefined;
  return {
    mealsPlanned: md?.meals.length ?? 0,
    mealsEaten: md ? md.meals.filter((_, i) => meals!.eaten[mealKey(day, i)]).length : 0,
    workout: wd ? (wd.rest ? 'rest' : workouts!.done[day] ? 'done' : 'missed') : undefined,
  };
}
