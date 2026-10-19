import type { IconName } from '@/components/icon';
import { C } from '@/constants/theme';

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
  { id: 'breathe', title: 'BOX BREATH', blurb: 'In, hold, out, hold. Four counts each, one minute.', howTo: 'Follow the circle: breathe in as it grows, hold, breathe out as it shrinks, hold.', price: 0, icon: 'leaf', color: C.cyan, kind: 'chill' },
  { id: 'fidget', title: 'FIDGET BOARD', blurb: 'Clicky arcade buttons. Light them up, switch them off.', howTo: 'Tap a button to light it, tap again to switch it off. Try lighting all 16, then turn them off one by one. No score, just clicks.', price: 15, icon: 'grid', color: C.yellow, kind: 'chill' },
  { id: 'bubbles', title: 'BUBBLE POP', blurb: 'Pop the bubbles as they float up. No score to beat.', howTo: 'Tap the bubbles to pop them before they float off the top.', price: 20, icon: 'drop', color: C.pink, kind: 'chill' },
  { id: 'shredder', title: 'WORRY SHREDDER', blurb: 'Type what’s bugging you, then feed it to the shredder.', howTo: 'Type what’s on your mind, then tap SHRED IT to tear it up.', price: 25, icon: 'shred', color: C.orange, kind: 'chill' },
  { id: 'memory', title: 'NEON MATCH', blurb: 'Flip the cards and find the pairs. Slow and steady.', howTo: 'Tap two cards to flip them. Find every matching pair.', price: 30, icon: 'cards', color: C.violet, kind: 'chill' },
  { id: 'spray', title: 'SPRAY WALL', blurb: 'Tag the wall in neon. Scribble it out.', howTo: 'Drag your finger to spray paint on the wall. Tap a colour to switch, WIPE to start over.', price: 40, icon: 'wand', color: C.lime, kind: 'chill' },
  {
    id: 'echo',
    title: 'NEON ECHO',
    blurb: 'Watch the pads light up, then repeat the pattern. It gets one step longer every round.',
    howTo: 'Watch the pads flash, then tap them back in the same order. One wrong tap ends the run.',
    price: 0,
    icon: 'waves',
    color: C.cyan,
    kind: 'brain',
    win: 7,
    great: 10,
    unit: 'STEPS',
  },
  {
    id: 'grid',
    title: 'GRID RECALL',
    blurb: 'Tiles flash for a second. Remember where they were and tap them all.',
    howTo: 'Remember which tiles light up, then tap every one. Each level adds a tile. 3 lives.',
    price: 20,
    icon: 'grid',
    color: C.lime,
    kind: 'brain',
    win: 6,
    great: 9,
    unit: 'LEVEL',
  },
  {
    id: 'clash',
    title: 'COLOR CLASH',
    blurb: 'The word says one colour, the ink is another. Tap the ink, fast.',
    howTo: 'Tap the colour of the INK, not the word. 45 seconds. Wrong taps cost a point.',
    price: 30,
    icon: 'sparkles',
    color: C.pink,
    kind: 'brain',
    win: 20,
    great: 30,
    unit: 'POINTS',
  },
  {
    id: 'math',
    title: 'MIND MATH',
    blurb: 'Is the sum right or wrong? Quick mental maths against the clock.',
    howTo: 'Tap RIGHT if the sum is correct, WRONG if it isn’t. 45 seconds. Sums get harder as you go.',
    price: 35,
    icon: 'brain',
    color: C.yellow,
    kind: 'brain',
    win: 20,
    great: 32,
    unit: 'POINTS',
  },
  {
    id: 'code',
    title: 'CODE CRACK',
    blurb: 'A code flashes on screen. Punch it back in from memory. Longer every round.',
    howTo: 'Memorise the digits while they show, then type them on the keypad. 3 lives.',
    price: 45,
    icon: 'key',
    color: C.orange,
    kind: 'brain',
    win: 7,
    great: 9,
    unit: 'DIGITS',
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
