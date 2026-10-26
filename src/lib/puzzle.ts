import type { Claim } from './quests';
import { WALLS, type WallDef } from './walls';

// The Arcade puzzle: a 100-piece picture (10 x 10) built one piece at a time. Pieces come from
// opening the app each day, logging a full day, streak milestones, chests and Gang Wars wins, so a
// puzzle takes a few weeks. Each placed piece goes into its own spot; a finished puzzle pays a
// reward and the next picture starts. The pictures are the illustrated walls.

export const PUZZLE_COLS = 10;
export const PUZZLE_ROWS = 10;
export const PUZZLE_PIECES = PUZZLE_COLS * PUZZLE_ROWS;

/** Pieces for each source. */
export const PIECES_DAILY = 1;
export const PIECES_FULL_DAY = 1;
export const PIECES_STREAK = 3;
export const PIECES_GANG_WIN = 2;
/** Tokens for the first Gang Wars win of the day. */
export const GANG_WIN_TOKENS = 25;
export const PUZZLE_STREAKS = [7, 14, 30, 60, 100, 180, 365];

/** Reward for finishing a picture. */
export const PUZZLE_DONE_XP = 150;
export const PUZZLE_DONE_TOKENS = 60;

export interface PuzzleState {
  /** Which picture (0-based, cycles through the walls). */
  n: number;
  /** Pieces earned for this picture and not placed yet (piece ids 0..99). */
  got: number[];
  /** Pieces in their spot. */
  placed: number[];
  /** Pieces earned after every piece of this picture was handed out; they go to the next one. */
  spare?: number;
}

export const EMPTY_PUZZLE: PuzzleState = { n: 0, got: [], placed: [] };

/** The picture for puzzle number n. */
export const puzzleImage = (n: number): WallDef => WALLS[n % WALLS.length];

/** Claim ids that keep each source to once (a day, or ever for streaks). */
export const puzzleClaim = {
  daily: (day: string) => `puzzle:daily:${day}`,
  fullDay: (day: string) => `puzzle:day:${day}`,
  streak: (days: number) => `puzzle:streak:${days}`,
  gang: (day: string) => `puzzle:gang:${day}`,
  done: (n: number) => `puzzle:done:${n}`,
};

export const hasClaim = (claims: Claim[], id: string) => claims.some((c) => c.questId === id);

/** Hands out `count` random pieces this picture doesn't have yet; the rest are kept as spares. */
export function earnPieces(p: PuzzleState, count: number, rand: () => number = Math.random): { next: PuzzleState; earned: number } {
  const owned = new Set([...p.got, ...p.placed]);
  const free = Array.from({ length: PUZZLE_PIECES }, (_, i) => i).filter((i) => !owned.has(i));
  const got = [...p.got];
  let earned = 0;
  for (; earned < count && free.length; earned++) got.push(free.splice(Math.floor(rand() * free.length), 1)[0]);
  return { next: { ...p, got, spare: (p.spare ?? 0) + (count - earned) }, earned: count };
}

/** Puts a piece in a spot. Only its own spot takes it. */
export function placePiece(p: PuzzleState, piece: number, spot: number): PuzzleState | null {
  if (piece !== spot || !p.got.includes(piece)) return null;
  return { ...p, got: p.got.filter((x) => x !== piece), placed: [...p.placed, piece] };
}

export const isPuzzleDone = (p: PuzzleState) => p.placed.length >= PUZZLE_PIECES;

/** The next picture, with any spare pieces already handed out. */
export function nextPuzzle(p: PuzzleState, rand: () => number = Math.random): PuzzleState {
  const fresh: PuzzleState = { n: p.n + 1, got: [], placed: [] };
  return p.spare ? earnPieces(fresh, p.spare, rand).next : fresh;
}
