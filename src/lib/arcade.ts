import type { IconName } from '@/components/icon';
import { C } from '@/constants/theme';

// Stress Arcade: one-minute games bought once with quest tokens.

export type GameId = 'breathe' | 'bubbles' | 'spray';

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
  { id: 'bubbles', title: 'BUBBLE POP', blurb: 'Pop the bubbles as they float up. No score to beat.', price: 20, icon: 'drop', color: C.pink },
  { id: 'spray', title: 'SPRAY WALL', blurb: 'Tag the wall in neon. Scribble it out.', price: 40, icon: 'wand', color: C.lime },
];

export const GAME_SECONDS = 60;
/** Claim id for the once-a-day XP from finishing a game. */
export const ARCADE_CLAIM = 'arcade';
export const ARCADE_XP = 15;

export const gameById = (id: string) => GAMES.find((g) => g.id === id);

export const isUnlocked = (id: GameId, unlocked: string[]) => (gameById(id)?.price ?? 0) === 0 || unlocked.includes(id);

export const spentTokens = (unlocked: string[]) => unlocked.reduce((n, id) => n + (gameById(id)?.price ?? 0), 0);
