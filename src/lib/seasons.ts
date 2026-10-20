import type { IconName } from '@/components/icon';
import { C } from '@/constants/theme';

import { dayKey, loggedDays, summarize, targets as currentTargets } from './nutrition';
import type { Claim } from './quests';
import type { Entry, Profile } from './types';

// Monthly seasons: a theme, five month-long challenges, and a badge for clearing them all.
// Rewards are stored as quest claims (questId "season:<month>:<id>"), so XP and tokens flow
// through the same ledger as daily quests.

const THEMES = [
  { name: 'FRESH START', emoji: '❄️', color: C.cyan },
  { name: 'HEART RATE', emoji: '❤️', color: C.pink },
  { name: 'SPRING SPRINT', emoji: '🌱', color: C.lime },
  { name: 'RAIN OR SHINE', emoji: '🌧️', color: C.blue },
  { name: 'BLOOM MODE', emoji: '🌸', color: C.pink },
  { name: 'SUMMER SHRED', emoji: '☀️', color: C.yellow },
  { name: 'HEATWAVE', emoji: '🔥', color: C.orange },
  { name: 'BEACH BOOTCAMP', emoji: '🏖️', color: C.cyan },
  { name: 'BACK TO THE GRIND', emoji: '📚', color: C.violet },
  { name: 'NEON NIGHTS', emoji: '🎃', color: C.orange },
  { name: 'IRON NOVEMBER', emoji: '🏋️', color: C.steelHi },
  { name: 'HOLIDAY HUSTLE', emoji: '🎄', color: C.lime },
] as const;

export const SEASON_REWARD = { xp: 50, tokens: 15 };
export const SEASON_BADGE_REWARD = { xp: 150, tokens: 50 };

export const monthKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

export function seasonTheme(month: string) {
  return THEMES[Number(month.slice(5, 7)) - 1] ?? THEMES[0];
}

export interface SeasonChallenge {
  id: string;
  title: string;
  icon: IconName;
  color: string;
  value: number;
  goal: number;
  done: boolean;
  claimed: boolean;
}

export function season(entries: Entry[], profile: Profile, claims: Claim[], now = new Date()) {
  const month = monthKey(now);
  const theme = seasonTheme(month);
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysLeft = daysInMonth - now.getDate();
  const t = currentTargets(profile);

  const monthEntries = entries.filter((e) => dayKey(e.createdAt).startsWith(month));
  const days = [...loggedDays(monthEntries)];
  const sums = days.map((k) => summarize(entries, k));
  const monthClaims = claims.filter((c) => c.day.startsWith(month));

  // Players who start mid-month get goals scaled to the days they actually have.
  const firstEver = entries.length ? Math.min(...entries.map((e) => e.createdAt)) : now.getTime();
  const startDay = dayKey(firstEver).startsWith(month) ? new Date(firstEver).getDate() : 1;
  const available = daysInMonth - startDay + 1;
  const scale = (n: number) => Math.max(1, Math.round((n * available) / 30));
  const raw: Omit<SeasonChallenge, 'done' | 'claimed'>[] = [
    { id: 'days', title: `Log on ${scale(20)} days`, icon: 'calendar', color: C.orange, value: days.length, goal: scale(20) },
    { id: 'workouts', title: `Finish ${scale(12)} workouts`, icon: 'dumbbell', color: C.lime, value: sums.reduce((n, s) => n + s.workouts, 0), goal: scale(12) },
    { id: 'protein', title: `Hit protein on ${scale(12)} days`, icon: 'bolt', color: C.protein, value: sums.filter((s) => s.protein >= t.protein * 0.9).length, goal: scale(12) },
    { id: 'moments', title: `Journal ${scale(6)} moments`, icon: 'journal', color: C.pink, value: monthEntries.filter((e) => e.kind === 'journal' && (e.summary || e.photo)).length, goal: scale(6) },
    { id: 'perfect', title: `Clear ${scale(4)} perfect day${scale(4) === 1 ? '' : 's'}`, icon: 'star', color: C.yellow, value: monthClaims.filter((c) => c.questId === 'perfect-day').length, goal: scale(4) },
  ];
  const challenges: SeasonChallenge[] = raw.map((c) => ({
    ...c,
    value: Math.min(c.value, c.goal),
    done: c.value >= c.goal,
    claimed: claims.some((x) => x.questId === `season:${month}:${c.id}`),
  }));
  const badge = claims.some((x) => x.questId === `season:${month}:badge`);
  return { month, theme, daysLeft, challenges, badge, cleared: challenges.filter((c) => c.claimed).length };
}

/** Badges from past (and this) season, newest first, for the trophy shelf. */
export function seasonBadges(claims: Claim[]) {
  return claims
    .filter((c) => /^season:\d{4}-\d{2}:badge$/.test(c.questId))
    .map((c) => {
      const month = c.questId.slice(7, 14);
      return { month, ...seasonTheme(month) };
    })
    .sort((a, b) => b.month.localeCompare(a.month));
}
