import type { IconName } from '@/components/icon';
import { C } from '@/constants/theme';

import { personaPrice } from './personas';

// Stress Arcade: one-minute games bought once with quest tokens.

export type GameId = 'breathe' | 'fidget' | 'bubbles' | 'shredder' | 'memory' | 'spray';

export interface GameDef {
  id: GameId;
  title: string;
  blurb: string;
  /** One-line how-to shown at the top of the game while it runs. */
  howTo: string;
  price: number; // tokens, paid once
  icon: IconName;
  color: string;
}

export const GAMES: GameDef[] = [
  { id: 'breathe', title: 'BOX BREATH', blurb: 'In, hold, out, hold. Four counts each, one minute.', howTo: 'Follow the circle: breathe in as it grows, hold, breathe out as it shrinks, hold.', price: 0, icon: 'leaf', color: C.cyan },
  { id: 'fidget', title: 'FIDGET BOARD', blurb: 'Clicky arcade buttons. Light them up, switch them off.', howTo: 'Tap a button to light it, tap again to switch it off. Try lighting all 16, then turn them off one by one. No score, just clicks.', price: 15, icon: 'grid', color: C.yellow },
  { id: 'bubbles', title: 'BUBBLE POP', blurb: 'Pop the bubbles as they float up. No score to beat.', howTo: 'Tap the bubbles to pop them before they float off the top.', price: 20, icon: 'drop', color: C.pink },
  { id: 'shredder', title: 'WORRY SHREDDER', blurb: 'Type what’s bugging you, then feed it to the shredder.', howTo: 'Type what’s on your mind, then tap SHRED IT to tear it up.', price: 25, icon: 'shred', color: C.orange },
  { id: 'memory', title: 'NEON MATCH', blurb: 'Flip the cards and find the pairs. Slow and steady.', howTo: 'Tap two cards to flip them. Find every matching pair.', price: 30, icon: 'cards', color: C.violet },
  { id: 'spray', title: 'SPRAY WALL', blurb: 'Tag the wall in neon. Scribble it out.', howTo: 'Drag your finger to spray paint on the wall. Tap a colour to switch, WIPE to start over.', price: 40, icon: 'wand', color: C.lime },
];

export const GAME_SECONDS = 60;
/** Claim id for the once-a-day XP from finishing a game. */
export const ARCADE_CLAIM = 'arcade';
export const ARCADE_XP = 15;

export const gameById = (id: string) => GAMES.find((g) => g.id === id);

export const isUnlocked = (id: GameId, unlocked: string[]) => (gameById(id)?.price ?? 0) === 0 || unlocked.includes(id);

/** Streak freezes are bought with tokens; each purchase is logged in `unlocked` as freeze:<time>. */
export const FREEZE_PRICE = 20;
export const MAX_FREEZES = 2;

const priceOf = (id: string) => gameById(id)?.price ?? personaPrice(id) ?? (id.startsWith('freeze:') ? FREEZE_PRICE : 0);
export const spentTokens = (unlocked: string[]) => unlocked.reduce((n, id) => n + priceOf(id), 0);
