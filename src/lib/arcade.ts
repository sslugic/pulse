import type { IconName } from '@/components/icon';
import { C } from '@/constants/theme';
import { t } from './i18n';

import { personaPrice } from './personas';

// Stress Arcade: one-minute chill games and scored Brain Gym challenges, bought once with tokens.
// Winning a challenge pays tokens and a chest, so playing well unlocks the rest of the arcade.

export type ChillId = 'breathe' | 'fidget' | 'bubbles' | 'shredder' | 'memory' | 'spray';
export type BrainId = 'echo' | 'grid' | 'clash' | 'math' | 'code';
export type GameId = ChillId | BrainId;

export interface GameDef {
  id: GameId;
  title: string;
  blurb: string;
  /** One-line how-to shown at the top of the game while it runs. */
  howTo: string;
  price: number; // tokens, paid once
  icon: IconName;
  color: string;
  /** chill: a calm one-minute toy. brain: a scored challenge you can win. */
  kind: 'chill' | 'brain';
  /** Brain games: score that counts as a win, and the score for a gold chest. */
  win?: number;
  great?: number;
  /** What the score counts, e.g. "LEVEL" or "POINTS". */
  unit?: string;
}

export const GAMES: GameDef[] = [
  { id: 'breathe', title: t('arcade.gameBreatheTitle'), blurb: t('arcade.gameBreatheBlurb'), howTo: t('arcade.gameBreatheHowTo'), price: 0, icon: 'leaf', color: C.cyan, kind: 'chill' },
  { id: 'fidget', title: t('arcade.gameFidgetTitle'), blurb: t('arcade.gameFidgetBlurb'), howTo: t('arcade.gameFidgetHowTo'), price: 15, icon: 'grid', color: C.yellow, kind: 'chill' },
  { id: 'bubbles', title: t('arcade.gameBubblesTitle'), blurb: t('arcade.gameBubblesBlurb'), howTo: t('arcade.gameBubblesHowTo'), price: 20, icon: 'drop', color: C.pink, kind: 'chill' },
  { id: 'shredder', title: t('arcade.gameShredderTitle'), blurb: t('arcade.gameShredderBlurb'), howTo: t('arcade.gameShredderHowTo'), price: 25, icon: 'shred', color: C.orange, kind: 'chill' },
  { id: 'memory', title: t('arcade.gameMemoryTitle'), blurb: t('arcade.gameMemoryBlurb'), howTo: t('arcade.gameMemoryHowTo'), price: 30, icon: 'cards', color: C.violet, kind: 'chill' },
  { id: 'spray', title: t('arcade.gameSprayTitle'), blurb: t('arcade.gameSprayBlurb'), howTo: t('arcade.gameSprayHowTo'), price: 40, icon: 'wand', color: C.lime, kind: 'chill' },
  {
    id: 'echo',
    title: t('arcade.gameEchoTitle'),
    blurb: t('arcade.gameEchoBlurb'),
    howTo: t('arcade.gameEchoHowTo'),
    price: 0,
    icon: 'waves',
    color: C.cyan,
    kind: 'brain',
    win: 7,
    great: 10,
    unit: t('arcade.unitSteps'),
  },
  {
    id: 'grid',
    title: t('arcade.gameGridTitle'),
    blurb: t('arcade.gameGridBlurb'),
    howTo: t('arcade.gameGridHowTo'),
    price: 20,
    icon: 'grid',
    color: C.lime,
    kind: 'brain',
    win: 6,
    great: 9,
    unit: t('arcade.unitLevel'),
  },
  {
    id: 'clash',
    title: t('arcade.gameClashTitle'),
    blurb: t('arcade.gameClashBlurb'),
    howTo: t('arcade.gameClashHowTo'),
    price: 30,
    icon: 'sparkles',
    color: C.pink,
    kind: 'brain',
    win: 20,
    great: 30,
    unit: t('arcade.unitPoints'),
  },
  {
    id: 'math',
    title: t('arcade.gameMathTitle'),
    blurb: t('arcade.gameMathBlurb'),
    howTo: t('arcade.gameMathHowTo'),
    price: 35,
    icon: 'brain',
    color: C.yellow,
    kind: 'brain',
    win: 20,
    great: 32,
    unit: t('arcade.unitPoints'),
  },
  {
    id: 'code',
    title: t('arcade.gameCodeTitle'),
    blurb: t('arcade.gameCodeBlurb'),
    howTo: t('arcade.gameCodeHowTo'),
    price: 45,
    icon: 'key',
    color: C.orange,
    kind: 'brain',
    win: 7,
    great: 9,
    unit: t('arcade.unitDigits'),
  },
];

export const GAME_SECONDS = 60;
/** Claim id for the once-a-day XP from finishing a game. */
export const ARCADE_CLAIM = 'arcade';
export const ARCADE_XP = 15;

export const gameById = (id: string) => GAMES.find((g) => g.id === id);

/** Owned when free, bought, or won from a chest (`gift:<id>`, which costs nothing). */
export const isUnlocked = (id: GameId, unlocked: string[]) => (gameById(id)?.price ?? 0) === 0 || unlocked.includes(id) || unlocked.includes(`gift:${id}`);

/** Streak freezes are bought with tokens; each purchase is logged in `unlocked` as freeze:<time>. */
export const FREEZE_PRICE = 20;
export const MAX_FREEZES = 2;

// ---------- Shop: power-ups and chests bought with tokens ----------

export type ChestTier = 'wood' | 'silver' | 'gold';

export const SHOP = {
  doubler: { price: 25, wins: 3 },
  chestSilver: { price: 30 },
  chestGold: { price: 60 },
} as const;

/** Each purchase is logged in `unlocked` as `<kind>:<time>` so the token balance can subtract it. */
const shopPrice = (id: string) =>
  id.startsWith('freeze:')
    ? FREEZE_PRICE
    : id.startsWith('doubler:')
      ? SHOP.doubler.price
      : id.startsWith('chest-silver:')
        ? SHOP.chestSilver.price
        : id.startsWith('chest-gold:')
          ? SHOP.chestGold.price
          : 0;

const priceOf = (id: string) => gameById(id)?.price ?? personaPrice(id) ?? shopPrice(id);
export const spentTokens = (unlocked: string[]) => unlocked.reduce((n, id) => n + priceOf(id), 0);
