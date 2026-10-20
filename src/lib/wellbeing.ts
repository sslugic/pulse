import { t } from './i18n';
import { dayKey, lastNDays, summarize, targets } from './nutrition';
import type { Entry, Profile } from './types';

export const MOODS = [
  { v: 1, emoji: '😫', label: t('wellbeing.moodAwful') },
  { v: 2, emoji: '😕', label: t('wellbeing.moodLow') },
  { v: 3, emoji: '😐', label: t('wellbeing.moodOkay') },
  { v: 4, emoji: '🙂', label: t('wellbeing.moodGood') },
  { v: 5, emoji: '😄', label: t('wellbeing.moodGreat') },
] as const;

export const moodEmoji = (m?: number) => (m ? MOODS[Math.min(4, Math.max(0, Math.round(m) - 1))].emoji : '—');

export type StressLevel = 'low' | 'moderate' | 'high' | 'very high';

/** Display name for a stress level (the level itself stays an English id). */
export const LEVEL_LABEL: Record<StressLevel, string> = {
  low: t('wellbeing.levelLow'),
  moderate: t('wellbeing.levelModerate'),
  high: t('wellbeing.levelHigh'),
  'very high': t('wellbeing.levelVeryHigh'),
};

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
  if (mentalStress != null) parts.push({ key: 'mind', label: t('wellbeing.partMind'), value: clamp(((mentalStress - 1) / 9) * 100), weight: 0.35 });
  if (sleepEntry?.sleepHours != null) {
    const hrs = clamp(((7.5 - sleepEntry.sleepHours) / 3.5) * 100);
    const q = sleepEntry.sleepQuality != null ? ((5 - sleepEntry.sleepQuality) / 4) * 100 : hrs;
    parts.push({ key: 'sleep', label: t('wellbeing.partSleep'), value: clamp(hrs * 0.7 + q * 0.3), weight: 0.3 });
  }
  if (mood != null) parts.push({ key: 'mood', label: t('wellbeing.partMood'), value: ((5 - mood) / 4) * 100, weight: 0.15 });
  if (energy != null) parts.push({ key: 'energy', label: t('wellbeing.partEnergy'), value: ((5 - energy) / 4) * 100, weight: 0.1 });
  if (parts.length && (load.activeMin > 0 || load.burned > 0)) {
    parts.push({ key: 'load', label: t('wellbeing.partLoad'), value: clamp(Math.max(load.activeMin / 120, load.burned / 900) * 100), weight: 0.1 });
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
        title: t('wellbeing.impactLowTitle'),
        body: losing ? t('wellbeing.impactLowLosing') : t('wellbeing.impactLowBody'),
      };
    case 'moderate':
      return {
        title: t('wellbeing.impactModerateTitle'),
        body: t('wellbeing.impactModerateBody'),
      };
    case 'high':
      return {
        title: t('wellbeing.impactHighTitle'),
        body: losing ? t('wellbeing.impactHighLosing') : t('wellbeing.impactHighBody'),
      };
    default:
      return {
        title: t('wellbeing.impactVeryHighTitle'),
        body: losing ? t('wellbeing.impactVeryHighLosing') : t('wellbeing.impactVeryHighBody'),
      };
  }
}

export interface Pattern {
  text: string;
  tone: 'good' | 'warn' | 'info';
  /** Which correlation this is, so callers can pick one without matching on (translated) text. */
  kind: 'sleep' | 'stress' | 'mood' | 'onTarget' | 'tag';
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
      text: t(a > b ? 'wellbeing.patternSleepMore' : 'wellbeing.patternSleepLess', { n: Math.round(Math.abs(a - b)) }),
      tone: a > b ? 'warn' : 'info',
      kind: 'sleep',
    });
  }

  const tense = rows.filter((r) => r.w.stress != null && r.w.stress >= 55);
  const calm = rows.filter((r) => r.w.stress != null && r.w.stress < 35);
  const c = kcal(tense), d = kcal(calm);
  if (c != null && d != null && tense.length >= 2 && calm.length >= 2 && Math.abs(c - d) >= 100) {
    out.push({
      text: t(c > d ? 'wellbeing.patternStressMore' : 'wellbeing.patternStressLess', { n: Math.round(Math.abs(c - d)) }),
      tone: c > d ? 'warn' : 'info',
      kind: 'stress',
    });
  }

  const trained = rows.filter((r) => r.n.workouts > 0 && r.w.mood != null);
  const rested = rows.filter((r) => r.n.workouts === 0 && r.w.mood != null);
  const m1 = avg(trained.map((r) => r.w.mood!)), m2 = avg(rested.map((r) => r.w.mood!));
  if (m1 != null && m2 != null && trained.length >= 2 && rested.length >= 2 && Math.abs(m1 - m2) >= 0.4) {
    out.push({
      text: t(m1 > m2 ? 'wellbeing.patternMoodBetter' : 'wellbeing.patternMoodLower', { a: moodEmoji(m1), b: moodEmoji(m2) }),
      tone: m1 > m2 ? 'good' : 'info',
      kind: 'mood',
    });
  }

  const target = targets(profile).calories;
  const onTrack = rows.filter((r) => r.n.eaten > 0 && Math.abs(r.n.eaten - r.n.burned - target) <= target * 0.1);
  const sleptWell = onTrack.filter((r) => r.w.sleepHours != null && r.w.sleepHours >= 7).length;
  const withSleep = onTrack.filter((r) => r.w.sleepHours != null).length;
  if (withSleep >= 3) {
    out.push({ text: t('wellbeing.patternOnTarget', { pct: Math.round((sleptWell / withSleep) * 100) }), tone: 'info', kind: 'onTarget' });
  }

  const tagCount = new Map<string, number>();
  rows.forEach((r) => r.w.tags.forEach((tag) => tagCount.set(tag.toLowerCase(), (tagCount.get(tag.toLowerCase()) ?? 0) + 1)));
  const top = [...tagCount.entries()].sort((x, y) => y[1] - x[1])[0];
  if (top && top[1] >= 3) out.push({ text: t('wellbeing.patternTag', { tag: top[0], n: top[1] }), tone: 'info', kind: 'tag' });

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
