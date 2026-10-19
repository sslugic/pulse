import { dayKey, streak } from './nutrition';
import type { Entry } from './types';

// Arcade-style progression: logging earns XP, streaks multiply it, quests add on top.
export const RANKS = [
  { name: 'Rookie', xp: 0, blurb: 'Fresh off the train. Log anything to start earning XP.' },
  { name: 'Street Crew', xp: 150, blurb: 'You’ve got a routine going. A few solid days of logging.' },
  { name: 'Block Boss', xp: 450, blurb: 'Consistent all week. Quests are part of your day.' },
  { name: 'Subway King', xp: 1000, blurb: 'Weeks of streaks. The habits are sticking.' },
  { name: 'Legend', xp: 2000, blurb: 'A month or more of showing up. People ask how you do it.' },
  { name: 'Underground Icon', xp: 3500, blurb: 'Months in. Tracking is second nature.' },
  { name: 'Hall of Fame', xp: 6000, blurb: 'The top of the board. Your name is on the wall.' },
] as const;

/** How XP is earned, for the rank ladder screen. */
export const XP_SOURCES = [
  { label: 'Log a meal', xp: '+10' },
  { label: 'Log a workout', xp: '+15' },
  { label: 'Journal check-in', xp: '+15' },
  { label: 'Weigh-in', xp: '+10' },
  { label: 'Water (up to 15 a day)', xp: '+3' },
  { label: 'Each day you log anything', xp: '+20' },
  { label: 'Each day of your current streak', xp: '+25' },
  { label: 'Daily quests', xp: '+20 to +60' },
  { label: 'Perfect day (all 3 quests)', xp: '+30' },
  { label: 'Arcade minute (once a day)', xp: '+15' },
] as const;

const ENTRY_XP: Record<Entry['kind'], number> = { meal: 10, exercise: 15, journal: 15, weight: 10, water: 3 };
// Water is a one-tap button, so its XP is capped per day.
const WATER_XP_PER_DAY = 15;

/** XP from logging alone: per-entry XP plus a bonus for each day logged and the current streak. */
export function logXp(entries: Entry[]) {
  const water = new Map<string, number>();
  let xp = 0;
  for (const e of entries) {
    if (e.kind === 'water') {
      const k = dayKey(e.createdAt);
      const add = Math.min(ENTRY_XP.water, WATER_XP_PER_DAY - (water.get(k) ?? 0));
      water.set(k, (water.get(k) ?? 0) + add);
      xp += add;
    } else xp += ENTRY_XP[e.kind];
  }
  const days = new Set(entries.map((e) => dayKey(e.createdAt))).size;
  return xp + days * 20 + streak(entries) * 25;
}

export function crewRank(entries: Entry[], bonusXp = 0) {
  const xp = logXp(entries) + bonusXp;
  let i = 0;
  while (i < RANKS.length - 1 && xp >= RANKS[i + 1].xp) i++;
  const cur = RANKS[i];
  const next = RANKS[i + 1];
  const progress = next ? (xp - cur.xp) / (next.xp - cur.xp) : 1;
  return { xp, rank: cur.name, next: next?.name, toNext: next ? next.xp - xp : 0, progress, level: i + 1 };
}

/** Which of the last 7 days (Mon-first, this week) have any log. */
export function weekDots(entries: Entry[], now = new Date()) {
  const logged = new Set(entries.map((e) => dayKey(e.createdAt)));
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  return ['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((letter, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return { letter, key: dayKey(d), on: logged.has(dayKey(d)), today: dayKey(d) === dayKey(now) };
  });
}
