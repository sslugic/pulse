import type { IconName } from '@/components/icon';
import { C } from '@/constants/theme';

import { spentTokens, type BrainId } from './arcade';
import { t } from './i18n';
import type { Chest } from './brain';
import { dayKey, summarize, type DaySummary } from './nutrition';
import type { Entry, Targets } from './types';

// Three daily quests (easy, medium, hard), the same for the whole day.
// Completing one unlocks a claim; claims pay XP and arcade tokens.

export type Tier = 1 | 2 | 3;

export interface Claim {
  day: string; // dayKey
  questId: string; // a quest id, or PERFECT_DAY
  xp: number;
  tokens: number;
  at: number;
}

interface Ctx {
  sum: DaySummary;
  entries: Entry[]; // that day's entries
  targets: Targets;
}

interface QuestDef {
  id: string;
  tier: Tier;
  title: string;
  blurb: (targets: Targets) => string;
  icon: IconName;
  color: string;
  progress: (c: Ctx) => [value: number, goal: number];
  /** Progress is millilitres of water. */
  water?: boolean;
}

export const REWARDS: Record<Tier, { xp: number; tokens: number }> = {
  1: { xp: 20, tokens: 5 },
  2: { xp: 40, tokens: 10 },
  3: { xp: 60, tokens: 20 },
};
export const PERFECT_DAY = 'perfect-day';
export const PERFECT_REWARD = { xp: 30, tokens: 15 };

const count = (c: Ctx, f: (e: Entry) => boolean) => c.entries.filter(f).length;

const QUESTS: QuestDef[] = [
  // Easy
  { id: 'half-tank', tier: 1, title: t('quests.halfTank'), blurb: () => t('quests.halfTankBlurb'), icon: 'drop', color: C.water, water: true, progress: (c) => [c.sum.water, Math.round(c.targets.waterMl / 2)] },
  { id: 'mind-check', tier: 1, title: t('quests.mindCheck'), blurb: () => t('quests.mindCheckBlurb'), icon: 'brain', color: C.violet, progress: (c) => [count(c, (e) => e.kind === 'journal'), 1] },
  { id: 'two-plates', tier: 1, title: t('quests.twoPlates'), blurb: () => t('quests.twoPlatesBlurb'), icon: 'fork', color: C.orange, progress: (c) => [c.sum.meals, 2] },
  { id: 'snapshot', tier: 1, title: t('quests.snapshot'), blurb: () => t('quests.snapshotBlurb'), icon: 'camera', color: C.yellow, progress: (c) => [count(c, (e) => e.source === 'photo'), 1] },
  { id: 'mic-check', tier: 1, title: t('quests.micCheck'), blurb: () => t('quests.micCheckBlurb'), icon: 'mic', color: C.pink, progress: (c) => [count(c, (e) => e.source === 'voice'), 1] },
  // Medium
  { id: 'full-tank', tier: 2, title: t('quests.fullTank'), blurb: () => t('quests.fullTankBlurb'), icon: 'drop', color: C.water, water: true, progress: (c) => [c.sum.water, c.targets.waterMl] },
  { id: 'protein-run', tier: 2, title: t('quests.proteinRun'), blurb: (tg) => t('quests.proteinRunBlurb', { g: Math.round(tg.protein * 0.8) }), icon: 'bolt', color: C.protein, progress: (c) => [c.sum.protein, Math.round(c.targets.protein * 0.8)] },
  { id: 'get-moving', tier: 2, title: t('quests.getMoving'), blurb: () => t('quests.getMovingBlurb'), icon: 'figure', color: C.lime, progress: (c) => [c.sum.activeMin, 20] },
  { id: 'three-square', tier: 2, title: t('quests.threeSquare'), blurb: () => t('quests.threeSquareBlurb'), icon: 'fork', color: C.orange, progress: (c) => [c.sum.meals, 3] },
  // Hard
  { id: 'max-protein', tier: 3, title: t('quests.maxProtein'), blurb: (tg) => t('quests.maxProteinBlurb', { g: tg.protein }), icon: 'bolt', color: C.protein, progress: (c) => [c.sum.protein, c.targets.protein] },
  { id: 'furnace', tier: 3, title: t('quests.furnace'), blurb: () => t('quests.furnaceBlurb'), icon: 'flame', color: C.orange, progress: (c) => [c.sum.burned, 300] },
  { id: 'iron-hour', tier: 3, title: t('quests.ironHour'), blurb: () => t('quests.ironHourBlurb'), icon: 'dumbbell', color: C.cyan, progress: (c) => [c.sum.activeMin, 45] },
  {
    id: 'full-run',
    tier: 3,
    title: t('quests.fullRun'),
    blurb: () => t('quests.fullRunBlurb'),
    icon: 'sparkles',
    color: C.yellow,
    progress: (c) => [Number(c.sum.meals >= 3) + Number(c.sum.workouts >= 1) + Number(count(c, (e) => e.kind === 'journal') >= 1), 3],
  },
];

// Small seeded PRNG so a day always rolls the same quests.
function rng(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

export function questsFor(day: string): QuestDef[] {
  const r = rng(`pulse:${day}`);
  return ([1, 2, 3] as Tier[]).map((tier) => {
    const pool = QUESTS.filter((q) => q.tier === tier);
    return pool[Math.floor(r() * pool.length)];
  });
}

export interface QuestState {
  id: string;
  tier: Tier;
  title: string;
  blurb: string;
  icon: IconName;
  color: string;
  water: boolean;
  value: number;
  goal: number;
  done: boolean;
  claimed: boolean;
  xp: number;
  tokens: number;
}

export function dailyQuests(entries: Entry[], targets: Targets, day: string, claims: Claim[]): QuestState[] {
  const ctx: Ctx = { sum: summarize(entries, day), entries: entries.filter((e) => dayKey(e.createdAt) === day), targets };
  return questsFor(day).map((q) => {
    const [value, goal] = q.progress(ctx);
    return {
      id: q.id,
      tier: q.tier,
      title: q.title,
      blurb: q.blurb(targets),
      icon: q.icon,
      color: q.color,
      water: !!q.water,
      value: Math.round(value),
      goal,
      done: value >= goal,
      claimed: claims.some((c) => c.day === day && c.questId === q.id),
      ...REWARDS[q.tier],
    };
  });
}

export interface GameState {
  claims: Claim[];
  /** Arcade games bought with tokens. */
  unlocked: string[];
  /** Rank wall the player picked (1-based level); unset follows their current rank. */
  wall?: number;
  /** Streak freezes owned (max 2). */
  freezes?: number;
  /** Days a freeze covered, so the streak survives them. */
  frozenDays?: string[];
  /** Unopened arcade chests. */
  chests?: Chest[];
  /** Brain Gym wins left that pay double tokens. */
  doubler?: number;
  /** Best score per Brain Gym game. */
  bests?: Partial<Record<BrainId, number>>;
  /** Last day any arcade game was finished; unlocks that day's free chest. */
  playedDay?: string;
  /** XP spent on unlocks (jukebox tracks). Doesn't lower the rank; it comes out of spendable XP. */
  xpSpent?: number;
}

// Clamped so a later price change can never leave a negative balance.
export const tokenBalance = (g: GameState) => Math.max(0, g.claims.reduce((n, c) => n + c.tokens, 0) - spentTokens(g.unlocked));
export const questXp = (claims: Claim[]) => claims.reduce((n, c) => n + c.xp, 0);
