import { dayKey, streak } from './nutrition';
import type { Entry } from './types';

// Arcade-style progression: logging earns XP, streaks multiply it, quests add on top.
// 15 ranks on a gentle curve: a few days to the first, roughly a year of steady logging
// (about 100 XP a day) to the last. `scene` is the backdrop wall each rank unlocks.
export const RANKS = [
  { name: 'Rookie', xp: 0, scene: 0, blurb: 'Fresh off the train. Log anything to start earning XP.' },
  { name: 'Tagger', xp: 150, scene: 1, blurb: 'First marks on the wall. You’ve started showing up.' },
  { name: 'Street Crew', xp: 400, scene: 2, blurb: 'You’ve got a routine going. A few solid days of logging.' },
  { name: 'Corner Captain', xp: 800, scene: 3, blurb: 'A full week in. People on the block know your name.' },
  { name: 'Block Boss', xp: 1400, scene: 4, blurb: 'Quests are part of your day now.' },
  { name: 'Skyline Runner', xp: 2200, scene: 5, blurb: 'Weeks of streaks. You see the whole city from up here.' },
  { name: 'Subway Rider', xp: 3300, scene: 6, blurb: 'A month of habits that stick.' },
  { name: 'Subway King', xp: 4700, scene: 7, blurb: 'You run these tunnels. Consistency is your thing.' },
  { name: 'Yard Bomber', xp: 6500, scene: 8, blurb: 'Two months in. Your name is painted on trains.' },
  { name: 'Legend', xp: 8800, scene: 9, blurb: 'People ask how you do it.' },
  { name: 'Neon Ace', xp: 11700, scene: 10, blurb: 'Half a year of showing up. You light up the room.' },
  { name: 'Underground Icon', xp: 15300, scene: 11, blurb: 'Tracking is second nature.' },
  { name: 'City Myth', xp: 19800, scene: 12, blurb: 'Stories get told about your streaks.' },
  { name: 'Hall of Famer', xp: 25500, scene: 13, blurb: 'Your name is on the wall for good.' },
  { name: 'Pulse Immortal', xp: 32000, scene: 14, blurb: 'A year of work. The top of the board.' },
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
  { label: 'Finish a planned workout', xp: '+25' },
  { label: 'Eat a planned meal', xp: '+5' },
  { label: 'Season challenge', xp: '+50' },
  { label: 'Streak freezes keep your streak bonus alive', xp: '🧊' },
] as const;

const ENTRY_XP: Record<Entry['kind'], number> = { meal: 10, exercise: 15, journal: 15, weight: 10, water: 3 };
// Water is a one-tap button, so its XP is capped per day.
const WATER_XP_PER_DAY = 15;

/** XP from logging alone: per-entry XP plus a bonus for each day logged and the current streak. */
export function logXp(entries: Entry[], frozen: string[] = []) {
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
  return xp + days * 20 + streak(entries, frozen) * 25;
}

export function crewRank(entries: Entry[], bonusXp = 0, frozen: string[] = []) {
  const xp = logXp(entries, frozen) + bonusXp;
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
