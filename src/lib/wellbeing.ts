import { dayKey, lastNDays, summarize, targets } from './nutrition';
import type { Entry, Profile } from './types';

export const MOODS = [
  { v: 1, emoji: '😫', label: 'Awful' },
  { v: 2, emoji: '😕', label: 'Low' },
  { v: 3, emoji: '😐', label: 'Okay' },
  { v: 4, emoji: '🙂', label: 'Good' },
  { v: 5, emoji: '😄', label: 'Great' },
] as const;

export const moodEmoji = (m?: number) => (m ? MOODS[Math.min(4, Math.max(0, Math.round(m) - 1))].emoji : '—');

export type StressLevel = 'low' | 'moderate' | 'high' | 'very high';

export interface StressPart {
  key: 'mind' | 'sleep' | 'mood' | 'energy' | 'load';
  label: string;
  value: number; // 0 (no strain) .. 100 (max strain)
  weight: number;
}

export interface DayWellbeing {
  key: string;
  sleepHours?: number;
  sleepQuality?: number;
  mood?: number;
  energy?: number;
  mentalStress?: number; // 1..10
  tags: string[];
  notes: Entry[];
  parts: StressPart[];
  /** 0..100, higher = more strain. Undefined when nothing was logged. */
  stress?: number;
  level?: StressLevel;
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : undefined);
const clamp = (n: number) => Math.max(0, Math.min(100, n));

export function levelOf(score: number): StressLevel {
  return score < 30 ? 'low' : score < 55 ? 'moderate' : score < 75 ? 'high' : 'very high';
}

/**
 * Daily strain score. Each signal maps to 0-100 and is weighted; missing signals drop out and the
 * remaining weights renormalize, so one quick mood tap still gives a (rough) score.
 */
export function dayWellbeing(entries: Entry[], key: string): DayWellbeing {
  const day = entries.filter((e) => dayKey(e.createdAt) === key);
  const notes = day.filter((e) => e.kind === 'journal');
  // Newest first, so the latest sleep report wins.
  const sleepEntry = notes.find((e) => e.sleepHours != null);
  const mood = avg(notes.flatMap((e) => (e.mood ? [e.mood] : [])));
  const energy = avg(notes.flatMap((e) => (e.energy ? [e.energy] : [])));
  const mentalStress = avg(notes.flatMap((e) => (e.stress ? [e.stress] : [])));
  const tags = [...new Set(notes.flatMap((e) => e.tags ?? []))];
  const load = summarize(entries, key);

  const parts: StressPart[] = [];
  if (mentalStress != null) parts.push({ key: 'mind', label: 'Life stress', value: clamp(((mentalStress - 1) / 9) * 100), weight: 0.35 });
  if (sleepEntry?.sleepHours != null) {
    const hrs = clamp(((7.5 - sleepEntry.sleepHours) / 3.5) * 100);
    const q = sleepEntry.sleepQuality != null ? ((5 - sleepEntry.sleepQuality) / 4) * 100 : hrs;
    parts.push({ key: 'sleep', label: 'Sleep debt', value: clamp(hrs * 0.7 + q * 0.3), weight: 0.3 });
  }
  if (mood != null) parts.push({ key: 'mood', label: 'Low mood', value: ((5 - mood) / 4) * 100, weight: 0.15 });
  if (energy != null) parts.push({ key: 'energy', label: 'Fatigue', value: ((5 - energy) / 4) * 100, weight: 0.1 });
  if (parts.length && (load.activeMin > 0 || load.burned > 0)) {
    parts.push({ key: 'load', label: 'Training load', value: clamp(Math.max(load.activeMin / 120, load.burned / 900) * 100), weight: 0.1 });
  }

  const w = parts.reduce((a, p) => a + p.weight, 0);
  const stress = parts.length ? Math.round(parts.reduce((a, p) => a + p.value * p.weight, 0) / w) : undefined;
  return {
    key,
    sleepHours: sleepEntry?.sleepHours,
    sleepQuality: sleepEntry?.sleepQuality,
    mood,
    energy,
    mentalStress,
    tags,
    notes,
    parts,
    stress,
    level: stress != null ? levelOf(stress) : undefined,
  };
}

export const LEVEL_COLOR: Record<StressLevel, string> = {
  low: '#C6FF3D',
  moderate: '#3DE7FF',
  high: '#FF9F43',
  'very high': '#FF5C5C',
};

/** What today's strain means for fat loss, in plain words. */
export function impactFor(level: StressLevel, goal: Profile['goal']): { title: string; body: string } {
  const losing = goal === 'lose' || goal === 'recomp';
  switch (level) {
    case 'low':
      return {
        title: 'Primed for progress',
        body: losing ? 'Low strain and good recovery: a great day to hit your deficit and train hard.' : 'Recovery looks good. Push your training today.',
      };
    case 'moderate':
      return {
        title: 'Manageable',
        body: 'Some strain, nothing alarming. Keep protein high and get to bed on time to stay on track.',
      };
    case 'high':
      return {
        title: 'Stress is working against you',
        body: losing
          ? 'High stress raises cortisol, which drives cravings and water retention. The scale may stall even if fat loss continues. Keep the deficit moderate and favour a lighter session.'
          : 'High strain blunts recovery. Favour a lighter session and prioritise sleep tonight.',
      };
    default:
      return {
        title: 'Recovery day',
        body: losing
          ? 'Very high strain. Eat at maintenance today, walk instead of lifting heavy, and protect your sleep. One calm day protects the whole week’s progress.'
          : 'Very high strain. Take a rest day and focus on sleep and food quality.',
      };
  }
}

export interface Pattern {
  text: string;
  tone: 'good' | 'warn' | 'info';
}

/** Simple, honest correlations from the user's own history (needs a few days of data each side). */
export function patterns(entries: Entry[], profile: Profile, days = 30): Pattern[] {
  const keys = lastNDays(days);
  const rows = keys.map((k) => ({ k, w: dayWellbeing(entries, k), n: summarize(entries, k) }));
  const out: Pattern[] = [];
  const kcal = (xs: typeof rows) => avg(xs.filter((r) => r.n.eaten > 0).map((r) => r.n.eaten));

  const shortSleep = rows.filter((r) => r.w.sleepHours != null && r.w.sleepHours < 6.5);
  const goodSleep = rows.filter((r) => r.w.sleepHours != null && r.w.sleepHours >= 7);
  const a = kcal(shortSleep), b = kcal(goodSleep);
  if (a != null && b != null && shortSleep.length >= 2 && goodSleep.length >= 2 && Math.abs(a - b) >= 100) {
    out.push({
      text: `After short nights (<6.5h) you eat ${Math.round(Math.abs(a - b))} kcal ${a > b ? 'more' : 'less'} than after good sleep.`,
      tone: a > b ? 'warn' : 'info',
    });
  }

  const tense = rows.filter((r) => r.w.stress != null && r.w.stress >= 55);
  const calm = rows.filter((r) => r.w.stress != null && r.w.stress < 35);
  const c = kcal(tense), d = kcal(calm);
  if (c != null && d != null && tense.length >= 2 && calm.length >= 2 && Math.abs(c - d) >= 100) {
    out.push({
      text: `On high-stress days you eat ${Math.round(Math.abs(c - d))} kcal ${c > d ? 'more' : 'less'} than on calm days.`,
      tone: c > d ? 'warn' : 'info',
    });
  }

  const trained = rows.filter((r) => r.n.workouts > 0 && r.w.mood != null);
  const rested = rows.filter((r) => r.n.workouts === 0 && r.w.mood != null);
  const m1 = avg(trained.map((r) => r.w.mood!)), m2 = avg(rested.map((r) => r.w.mood!));
  if (m1 != null && m2 != null && trained.length >= 2 && rested.length >= 2 && Math.abs(m1 - m2) >= 0.4) {
    out.push({
      text: `Your mood is ${m1 > m2 ? 'better' : 'lower'} on days you work out (${moodEmoji(m1)} vs ${moodEmoji(m2)}).`,
      tone: m1 > m2 ? 'good' : 'info',
    });
  }

  const target = targets(profile).calories;
  const onTrack = rows.filter((r) => r.n.eaten > 0 && Math.abs(r.n.eaten - r.n.burned - target) <= target * 0.1);
  const sleptWell = onTrack.filter((r) => r.w.sleepHours != null && r.w.sleepHours >= 7).length;
  const withSleep = onTrack.filter((r) => r.w.sleepHours != null).length;
  if (withSleep >= 3) {
    out.push({ text: `${Math.round((sleptWell / withSleep) * 100)}% of your on-target days followed 7h+ of sleep.`, tone: 'info' });
  }

  const tagCount = new Map<string, number>();
  rows.forEach((r) => r.w.tags.forEach((t) => tagCount.set(t.toLowerCase(), (tagCount.get(t.toLowerCase()) ?? 0) + 1)));
  const top = [...tagCount.entries()].sort((x, y) => y[1] - x[1])[0];
  if (top && top[1] >= 3) out.push({ text: `“${top[0]}” came up on ${top[1]} days this month.`, tone: 'info' });

  return out;
}

/** Compact multi-day summary for the AI. */
export function wellbeingDigest(entries: Entry[], days = 14) {
  return lastNDays(days)
    .map((k) => {
      const w = dayWellbeing(entries, k);
      const n = summarize(entries, k);
      if (w.stress == null && n.eaten === 0 && n.workouts === 0) return null;
      return `${k}: stress ${w.stress ?? '?'}/100, sleep ${w.sleepHours ?? '?'}h, mood ${w.mood?.toFixed(1) ?? '?'}/5, eaten ${n.eaten} kcal, burned ${n.burned} kcal, workouts ${n.workouts}${w.tags.length ? `, notes: ${w.tags.join('; ')}` : ''}`;
    })
    .filter(Boolean)
    .join('\n');
}
