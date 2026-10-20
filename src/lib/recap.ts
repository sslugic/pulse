import { t } from '@/lib/i18n';
import { dayKey, lastNDays, loggedDays, summarize, targets as currentTargets } from './nutrition';
import type { Claim } from './quests';
import { sceneFor, type SceneElement } from './scene';
import type { Entry, Profile } from './types';
import { dayWellbeing } from './wellbeing';

/** Numbers for the weekly comic recap, all from local data (no AI needed). */
export interface WeekStats {
  from: string; // dayKey
  to: string;
  daysLogged: number;
  meals: number;
  avgEaten: number;
  proteinDays: number; // days at >= 90% of the protein target
  workouts: number;
  activeMin: number;
  burned: number;
  waterDays: number; // days at the water target
  avgSleep?: number;
  avgMood?: number;
  questsCleared: number;
  perfectDays: number;
  tokensEarned: number;
  xpFromQuests: number;
  weightChangeKg?: number;
  /** The most memorable journal moment: best mood, else the latest with a story. */
  bestMoment?: { summary: string; scene: SceneElement[]; mood?: number; day: string };
  /** Short digest of the week for the AI captions. */
  digest: string;
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : undefined);

export function weekStats(entries: Entry[], profile: Profile, claims: Claim[], end = new Date()): WeekStats {
  const keys = lastNDays(7, end);
  const set = new Set(keys);
  const t = currentTargets(profile);
  const days = keys.map((k) => summarize(entries, k));
  const minds = keys.map((k) => dayWellbeing(entries, k));
  const week = entries.filter((e) => set.has(dayKey(e.createdAt)));
  const weekClaims = claims.filter((c) => set.has(c.day));
  const weights = week.filter((e) => e.kind === 'weight' && e.weightKg).sort((a, b) => a.createdAt - b.createdAt);

  const moments = week.filter((e) => e.kind === 'journal' && (e.summary || e.photo));
  const best = moments.slice().sort((a, b) => (b.mood ?? 0) - (a.mood ?? 0) || b.createdAt - a.createdAt)[0];

  const logged = days.filter((d) => d.eaten > 0);
  const s: WeekStats = {
    from: keys[0],
    to: keys[keys.length - 1],
    daysLogged: loggedDays(week).size,
    meals: days.reduce((n, d) => n + d.meals, 0),
    avgEaten: Math.round(avg(logged.map((d) => d.eaten)) ?? 0),
    proteinDays: days.filter((d) => d.protein >= t.protein * 0.9).length,
    workouts: days.reduce((n, d) => n + d.workouts, 0),
    activeMin: days.reduce((n, d) => n + d.activeMin, 0),
    burned: Math.round(days.reduce((n, d) => n + d.burned, 0)),
    waterDays: days.filter((d) => d.water >= t.waterMl).length,
    avgSleep: avg(minds.flatMap((m) => (m.sleepHours != null ? [m.sleepHours] : []))),
    avgMood: avg(minds.flatMap((m) => (m.mood != null ? [m.mood] : []))),
    questsCleared: weekClaims.filter((c) => c.questId !== 'perfect-day' && c.questId !== 'arcade' && !c.questId.startsWith('season:') && !c.questId.startsWith('plan-')).length,
    perfectDays: weekClaims.filter((c) => c.questId === 'perfect-day').length,
    tokensEarned: weekClaims.reduce((n, c) => n + c.tokens, 0),
    xpFromQuests: weekClaims.reduce((n, c) => n + c.xp, 0),
    weightChangeKg: weights.length >= 2 ? weights[weights.length - 1].weightKg! - weights[0].weightKg! : undefined,
    bestMoment: best ? { summary: best.summary || best.title, scene: sceneFor(best), mood: best.mood, day: dayKey(best.createdAt) } : undefined,
    digest: '',
  };
  s.digest = [
    `Days logged: ${s.daysLogged}/7`,
    `Meals: ${s.meals}, avg ${s.avgEaten} kcal on logged days (target ${t.calories})`,
    `Protein target hit on ${s.proteinDays} days`,
    `Workouts: ${s.workouts}, ${s.activeMin} active min, ${s.burned} kcal burned`,
    `Water target hit on ${s.waterDays} days`,
    s.avgSleep != null ? `Avg sleep ${s.avgSleep.toFixed(1)} h` : 'No sleep logged',
    s.avgMood != null ? `Avg mood ${s.avgMood.toFixed(1)}/5` : 'No mood logged',
    `Quests cleared: ${s.questsCleared}, perfect days: ${s.perfectDays}`,
    s.weightChangeKg != null ? `Weight change ${s.weightChangeKg > 0 ? '+' : ''}${s.weightChangeKg.toFixed(1)} kg` : 'No weight trend',
    best ? `Best moment: ${best.summary || best.title}` : 'No journal moments',
    ...moments.slice(0, 6).map((m) => `- ${new Date(m.createdAt).toLocaleDateString([], { weekday: 'short' })}: ${m.summary || m.title}`),
  ].join('\n');
  return s;
}

/** Captions written from the numbers alone, used when there's no API key or the AI call fails. */
export function fallbackCaptions(s: WeekStats) {
  return {
    title: s.daysLogged >= 5 ? t('recap.titleShowedUp') : s.daysLogged >= 3 ? t('recap.titleMomentum') : t('recap.titleComeback'),
    training: s.workouts ? t('recap.trainingCaption', { count: s.workouts, min: s.activeMin }) : t('recap.trainingNone'),
    fuel: s.meals ? t('recap.fuelCaption', { meals: s.meals, count: s.proteinDays }) : t('recap.fuelNone'),
    mind: s.avgSleep != null ? t('recap.mindCaption', { h: s.avgSleep.toFixed(1) }) : t('recap.mindNone'),
    verdict: s.daysLogged >= 5 ? t('recap.verdictStrong') : t('recap.verdictKeepGoing'),
  };
}

export type RecapCaptions = ReturnType<typeof fallbackCaptions>;
