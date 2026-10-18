import { dayKey, streak } from './nutrition';
import type { Entry } from './types';

// Arcade-style progression: logging earns XP, streaks multiply it.
export const RANKS = [
  { name: 'Rookie', xp: 0 },
  { name: 'Street Crew', xp: 150 },
  { name: 'Block Boss', xp: 450 },
  { name: 'Subway King', xp: 1000 },
  { name: 'Legend', xp: 2000 },
] as const;

export function crewRank(entries: Entry[]) {
  const days = new Set(entries.map((e) => dayKey(e.createdAt))).size;
  const run = streak(entries);
  const xp = entries.length * 10 + days * 20 + run * 25;
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
