import { t } from './i18n';
import { dayKey, loggedDays, summarize, targets as currentTargets, type DaySummary } from './nutrition';
import type { Entry, Profile } from './types';
import { dayWellbeing, moodEmoji, patterns, type Pattern } from './wellbeing';

// Long-range stats for the Stats tab: averages against targets, mind and sleep, and a short list of
// what to improve. Everything is computed on the phone from the player's own logs (no AI credits).

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : undefined);
const round = (n: number | undefined, step = 1) => (n == null ? undefined : Math.round(n / step) * step);

export interface Overview {
  days: DaySummary[];
  /** Days with anything logged by the player (Health's passive activity doesn't count). */
  daysLogged: number;
  /** Days with at least one meal; nutrition averages are over these. */
  mealDays: number;
  onTargetDays: number;
  avgEaten: number;
  avgNet: number;
  avgBurned: number;
  avgProtein: number;
  avgCarbs: number;
  avgFat: number;
  avgWater: number;
  workoutsPerWeek: number;
  avgMood?: number;
  avgSleep?: number;
  /** 1..10 self-reported stress. */
  avgStress?: number;
  /** Days per rounded mood, index 0 = mood 1 (awful) .. 4 = mood 5 (great). */
  moodDays: number[];
  weightChangeKg?: number;
  insights: Insight[];
}

export interface Insight {
  text: string;
  tone: 'good' | 'warn' | 'info';
}

/** Stats for the given day keys (oldest first). */
export function overview(entries: Entry[], profile: Profile, keys: string[]): Overview {
  const goal = currentTargets(profile);
  const set = new Set(keys);
  const inRange = entries.filter((e) => set.has(dayKey(e.createdAt)));
  const days = keys.map((k) => summarize(entries, k));
  const minds = keys.map((k) => dayWellbeing(entries, k));
  const meals = days.filter((d) => d.eaten > 0);
  const nutr = (f: (d: DaySummary) => number) => Math.round(avg(meals.map(f)) ?? 0);

  const weights = inRange.filter((e) => e.kind === 'weight' && e.weightKg).sort((a, b) => a.createdAt - b.createdAt);
  const moodDays = [0, 0, 0, 0, 0];
  for (const m of minds) if (m.mood != null) moodDays[Math.min(4, Math.max(0, Math.round(m.mood) - 1))]++;

  const o: Overview = {
    days,
    daysLogged: loggedDays(inRange).size,
    mealDays: meals.length,
    onTargetDays: meals.filter((d) => Math.abs(d.eaten - d.burned - goal.calories) <= goal.calories * 0.1).length,
    avgEaten: nutr((d) => d.eaten),
    avgNet: nutr((d) => d.eaten - d.burned),
    avgBurned: Math.round(avg(days.map((d) => d.burned)) ?? 0),
    avgProtein: nutr((d) => d.protein),
    avgCarbs: nutr((d) => d.carbs),
    avgFat: nutr((d) => d.fat),
    avgWater: Math.round(avg(days.filter((d) => d.water > 0).map((d) => d.water)) ?? 0),
    workoutsPerWeek: Math.round((days.reduce((n, d) => n + d.workouts, 0) / Math.max(1, keys.length)) * 7 * 10) / 10,
    avgMood: round(avg(minds.flatMap((m) => (m.mood != null ? [m.mood] : []))), 0.1),
    avgSleep: round(avg(minds.flatMap((m) => (m.sleepHours != null ? [m.sleepHours] : []))), 0.1),
    avgStress: round(avg(minds.flatMap((m) => (m.mentalStress != null ? [m.mentalStress] : []))), 0.1),
    moodDays,
    weightChangeKg: weights.length >= 2 ? round(weights[weights.length - 1].weightKg! - weights[0].weightKg!, 0.1) : undefined,
    insights: [],
  };
  o.insights = insights(o, profile, entries, keys.length);
  return o;
}

/** What to work on first (warnings), then what's going well, then patterns in their own data. At most six. */
function insights(o: Overview, profile: Profile, entries: Entry[], span: number): Insight[] {
  const goal = currentTargets(profile);
  const warn: Insight[] = [];
  const good: Insight[] = [];
  const add = (ok: boolean, okText: string, badText: string) => (ok ? good : warn).push({ text: ok ? okText : badText, tone: ok ? 'good' : 'warn' });

  if (o.daysLogged < 3) return [{ text: t('stats.tipNeedData'), tone: 'info' }];

  const consistency = o.daysLogged / span;
  if (consistency < 0.6 || consistency >= 0.85) {
    add(consistency >= 0.85, t('stats.tipLoggingGood', { n: o.daysLogged, total: span }), t('stats.tipLoggingLow', { n: o.daysLogged, total: span }));
  }

  if (o.mealDays >= 3) {
    const short = goal.protein - o.avgProtein;
    if (short > goal.protein * 0.1 || o.avgProtein >= goal.protein) {
      add(o.avgProtein >= goal.protein, t('stats.tipProteinGood', { g: o.avgProtein }), t('stats.tipProteinLow', { g: o.avgProtein, short: Math.round(short), target: goal.protein }));
    }
    const over = o.avgNet - goal.calories;
    const off = Math.abs(over) > goal.calories * 0.1;
    if (profile.goal === 'lose' || profile.goal === 'recomp') {
      if (over > goal.calories * 0.1) warn.push({ text: t('stats.tipCaloriesOverLose', { n: Math.round(over) }), tone: 'warn' });
      else if (!off) good.push({ text: t('stats.tipCaloriesOnTrack'), tone: 'good' });
    } else if (profile.goal === 'gain') {
      if (over < -goal.calories * 0.1) warn.push({ text: t('stats.tipCaloriesUnderGain', { n: Math.round(-over) }), tone: 'warn' });
      else if (!off) good.push({ text: t('stats.tipCaloriesOnTrack'), tone: 'good' });
    } else if (off) {
      warn.push({ text: t(over > 0 ? 'stats.tipCaloriesOverMaintain' : 'stats.tipCaloriesUnderMaintain', { n: Math.round(Math.abs(over)) }), tone: 'warn' });
    } else {
      good.push({ text: t('stats.tipCaloriesOnTrack'), tone: 'good' });
    }
  }

  if (o.avgWater > 0 && o.avgWater < goal.waterMl * 0.75) warn.push({ text: t('stats.tipWaterLow', { pct: Math.round((o.avgWater / goal.waterMl) * 100) }), tone: 'warn' });

  if (span >= 7) {
    add(o.workoutsPerWeek >= 3, t('stats.tipWorkoutsGood', { n: o.workoutsPerWeek }), t('stats.tipWorkoutsLow', { n: o.workoutsPerWeek }));
  }

  if (o.avgSleep != null) {
    if (o.avgSleep < 7) warn.push({ text: t('stats.tipSleepLow', { h: o.avgSleep }), tone: 'warn' });
    else good.push({ text: t('stats.tipSleepGood', { h: o.avgSleep }), tone: 'good' });
  }
  if (o.avgStress != null && o.avgStress >= 6.5) warn.push({ text: t('stats.tipStressHigh', { n: o.avgStress }), tone: 'warn' });
  if (o.avgMood != null && o.avgMood >= 4) good.push({ text: t('stats.tipMoodGood', { emoji: moodEmoji(o.avgMood) }), tone: 'good' });

  if (o.weightChangeKg != null && Math.abs(o.weightChangeKg) >= 0.3) {
    const towardGoal = (profile.goal === 'lose' && o.weightChangeKg < 0) || (profile.goal === 'gain' && o.weightChangeKg > 0);
    const away = (profile.goal === 'lose' && o.weightChangeKg > 0) || (profile.goal === 'gain' && o.weightChangeKg < 0);
    const kg = Math.abs(o.weightChangeKg);
    const amount = profile.units === 'imperial' ? `${Math.round(kg * 2.2046 * 10) / 10} lb` : `${kg} kg`;
    if (towardGoal) good.push({ text: t('stats.tipWeightGood', { amount }), tone: 'good' });
    else if (away) warn.push({ text: t('stats.tipWeightAway', { amount }), tone: 'warn' });
  }

  const own: Pattern[] = span >= 14 ? patterns(entries, profile, Math.min(span, 90)) : [];
  return [...warn, ...good, ...own.map((p) => ({ text: p.text, tone: p.tone }))].slice(0, 6);
}

/** Groups days into at most `max` columns (weeks once a range is long), averaging logged days. */
export function buckets(days: DaySummary[], max = 30) {
  const size = days.length <= max ? 1 : Math.ceil(days.length / max);
  const out: { key: string; eaten: number; burned: number }[] = [];
  for (let i = 0; i < days.length; i += size) {
    const chunk = days.slice(i, i + size);
    const eatDays = chunk.filter((d) => d.eaten > 0);
    out.push({
      key: chunk[0].key,
      eaten: Math.round(avg(eatDays.map((d) => d.eaten)) ?? 0),
      burned: Math.round(avg(chunk.map((d) => d.burned)) ?? 0),
    });
  }
  return { cols: out, size };
}
