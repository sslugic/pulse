import { locale, t } from './i18n';
import { dayKey, loggedDays, streak } from './nutrition';
import type { Entry } from './types';

// Arcade-style progression: logging earns XP, streaks multiply it, quests add on top.
// 15 ranks on a gentle curve: a few days to the first, roughly a year of steady logging
// (about 100 XP a day) to the last. `scene` is the backdrop wall each rank unlocks.
export const RANKS = [
  { name: t('ranks.rankRookie'), xp: 0, scene: 0, blurb: t('ranks.rankRookieBlurb') },
  { name: t('ranks.rankTagger'), xp: 150, scene: 1, blurb: t('ranks.rankTaggerBlurb') },
  { name: t('ranks.rankStreetCrew'), xp: 400, scene: 2, blurb: t('ranks.rankStreetCrewBlurb') },
  { name: t('ranks.rankCornerCaptain'), xp: 800, scene: 3, blurb: t('ranks.rankCornerCaptainBlurb') },
  { name: t('ranks.rankBlockBoss'), xp: 1400, scene: 4, blurb: t('ranks.rankBlockBossBlurb') },
  { name: t('ranks.rankSkylineRunner'), xp: 2200, scene: 5, blurb: t('ranks.rankSkylineRunnerBlurb') },
  { name: t('ranks.rankSubwayRider'), xp: 3300, scene: 6, blurb: t('ranks.rankSubwayRiderBlurb') },
  { name: t('ranks.rankSubwayKing'), xp: 4700, scene: 7, blurb: t('ranks.rankSubwayKingBlurb') },
  { name: t('ranks.rankYardBomber'), xp: 6500, scene: 8, blurb: t('ranks.rankYardBomberBlurb') },
  { name: t('ranks.rankLegend'), xp: 8800, scene: 9, blurb: t('ranks.rankLegendBlurb') },
  { name: t('ranks.rankNeonAce'), xp: 11700, scene: 10, blurb: t('ranks.rankNeonAceBlurb') },
  { name: t('ranks.rankUndergroundIcon'), xp: 15300, scene: 11, blurb: t('ranks.rankUndergroundIconBlurb') },
  { name: t('ranks.rankCityMyth'), xp: 19800, scene: 12, blurb: t('ranks.rankCityMythBlurb') },
  { name: t('ranks.rankHallOfFamer'), xp: 25500, scene: 13, blurb: t('ranks.rankHallOfFamerBlurb') },
  { name: t('ranks.rankPulseImmortal'), xp: 32000, scene: 14, blurb: t('ranks.rankPulseImmortalBlurb') },
] as const;

/** How XP is earned, for the rank ladder screen. */
export const XP_SOURCES = [
  { label: t('ranks.xpMeal'), xp: '+10' },
  { label: t('ranks.xpWorkout'), xp: '+15' },
  { label: t('ranks.xpJournal'), xp: '+15' },
  { label: t('ranks.xpWeighIn'), xp: '+10' },
  { label: t('ranks.xpWater'), xp: '+3' },
  { label: t('ranks.xpAnyLog'), xp: '+20' },
  { label: t('ranks.xpStreakDay'), xp: '+25' },
  { label: t('ranks.xpQuests'), xp: t('ranks.xpQuestsRange') },
  { label: t('ranks.xpPerfectDay'), xp: '+30' },
  { label: t('ranks.xpArcade'), xp: '+15' },
  { label: t('ranks.xpPlannedWorkout'), xp: '+25' },
  { label: t('ranks.xpPlannedMeal'), xp: '+5' },
  { label: t('ranks.xpSeason'), xp: '+50' },
  { label: t('ranks.xpFreeze'), xp: '🧊' },
] as const;

const ENTRY_XP: Record<Entry['kind'], number> = { meal: 10, exercise: 15, journal: 15, weight: 10, water: 3 };
// Water is a one-tap button, so its XP is capped per day.
const WATER_XP_PER_DAY = 15;

/** XP from logging alone: per-entry XP plus a bonus for each day logged and the current streak. */
export function logXp(entries: Entry[], frozen: string[] = []) {
  const water = new Map<string, number>();
  let xp = 0;
  for (const e of entries) {
    if (e.passive) continue;
    if (e.kind === 'water') {
      const k = dayKey(e.createdAt);
      const add = Math.min(ENTRY_XP.water, WATER_XP_PER_DAY - (water.get(k) ?? 0));
      water.set(k, (water.get(k) ?? 0) + add);
      xp += add;
    } else xp += ENTRY_XP[e.kind];
  }
  const days = loggedDays(entries).size;
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
  const logged = loggedDays(entries);
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const letter = d.toLocaleDateString(locale, { weekday: 'narrow' });
    return { letter, key: dayKey(d), on: logged.has(dayKey(d)), today: dayKey(d) === dayKey(now) };
  });
}
