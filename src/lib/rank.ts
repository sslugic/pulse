import { dayKey, streak } from './nutrition';
import type { Entry } from './types';

// Arcade-style progression: logging earns XP, streaks multiply it, quests add on top.
export const RANKS = [
  { name: 'Rookie', xp: 0 },
  { name: 'Street Crew', xp: 150 },
  { name: 'Block Boss', xp: 450 },
  { name: 'Subway King', xp: 1000 },
  { name: 'Legend', xp: 2000 },
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
    return { letter, on: logged.has(dayKey(d)), today: dayKey(d) === dayKey(now) };
  });
}
