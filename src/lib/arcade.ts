import type { IconName } from '@/components/icon';
import { C } from '@/constants/theme';

import { personaPrice } from './personas';

// Stress Arcade: one-minute games bought once with quest tokens.

export type GameId = 'breathe' | 'fidget' | 'bubbles' | 'shredder' | 'memory' | 'spray';

export interface GameDef {
  id: GameId;
  title: string;
  blurb: string;
  price: number; // tokens, paid once
  icon: IconName;
  color: string;
}

export const GAMES: GameDef[] = [
  { id: 'breathe', title: 'BOX BREATH', blurb: 'In, hold, out, hold. Four counts each, one minute.', price: 0, icon: 'leaf', color: C.cyan },
  { id: 'fidget', title: 'FIDGET BOARD', blurb: 'Clicky arcade buttons. Light them up, switch them off.', price: 15, icon: 'grid', color: C.yellow },
  { id: 'bubbles', title: 'BUBBLE POP', blurb: 'Pop the bubbles as they float up. No score to beat.', price: 20, icon: 'drop', color: C.pink },
  { id: 'shredder', title: 'WORRY SHREDDER', blurb: 'Type what’s bugging you, then feed it to the shredder.', price: 25, icon: 'shred', color: C.orange },
  { id: 'memory', title: 'NEON MATCH', blurb: 'Flip the cards and find the pairs. Slow and steady.', price: 30, icon: 'cards', color: C.violet },
  { id: 'spray', title: 'SPRAY WALL', blurb: 'Tag the wall in neon. Scribble it out.', price: 40, icon: 'wand', color: C.lime },
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
