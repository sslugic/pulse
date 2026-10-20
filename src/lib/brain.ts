import { GAMES, MAX_FREEZES, isUnlocked, type BrainId, type ChestTier, type GameDef } from './arcade';
import { AVATARS, avatarGiftId, isRewardAvatar, type AvatarDef } from './avatars';
import { t } from './i18n';
import type { Claim, GameState } from './quests';

// Brain Gym rewards: wins pay tokens and XP and drop a chest, a little like opening chests in Duolingo.
// Payouts are capped per day so the arcade tops up quests rather than replacing them.

export const WIN_TOKENS = 10;
export const WIN_XP = 10;
export const BEST_BONUS = 5;
/** Wins per day that pay tokens and drop a chest. Later wins still count for best scores. */
export const PAID_WINS_PER_DAY = 5;
export const CHESTS_PER_DAY = 3;

export interface Chest {
  id: string;
  tier: ChestTier;
  /** Where it came from: a win, the daily chest, or the shop. */
  from: string;
  at: number;
}

export type Loot = { kind: 'tokens'; amount: number } | { kind: 'xp'; amount: number } | { kind: 'freeze' } | { kind: 'doubler'; wins: number } | { kind: 'game'; game: GameDef } | { kind: 'avatar'; avatar: AvatarDef };

export const CHEST_LOOK: Record<ChestTier, { name: string; body: string; trim: string; glow: string }> = {
  wood: {
    name: t('arcade.chestWood'),
    body: '#8A5A2B',
    trim: '#C9A227',
    glow: '#FFB347',
  },
  silver: {
    name: t('arcade.chestSilver'),
    body: '#7C8A96',
    trim: '#E8F2FF',
    glow: '#9CC8FF',
  },
  gold: {
    name: t('arcade.chestGold'),
    body: '#C99A1A',
    trim: '#FFF1C2',
    glow: '#FFD84A',
  },
};

export const brainGames = () => GAMES.filter((g) => g.kind === 'brain');

export const winsToday = (claims: Claim[], day: string) => claims.filter((c) => c.day === day && c.questId.startsWith('brain:')).length;

/** Chests dropped by wins today (each drop is logged as a zero-value `chest-drop:` claim). */
export const chestsEarnedToday = (claims: Claim[], day: string) => claims.filter((c) => c.day === day && c.questId.startsWith('chest-drop:')).length;

/** The daily chest: free once a day after finishing any arcade game. */
export const dailyChestId = (day: string) => `daily:${day}`;

/** Stars for a score: 1 for finishing, 2 for a win, 3 for a great run. */
export function stars(g: GameDef, score: number) {
  if (g.great != null && score >= g.great) return 3;
  if (g.win != null && score >= g.win) return 2;
  return score > 0 ? 1 : 0;
}

/** Rolls what's inside a chest. Better chests pay more and are likelier to hold the rare drops. */
export function rollLoot(tier: ChestTier, game: GameState, rand: () => number = Math.random): Loot[] {
  const range = { wood: [5, 15], silver: [15, 30], gold: [30, 60] }[tier];
  const loot: Loot[] = [
    {
      kind: 'tokens',
      amount: Math.round(range[0] + rand() * (range[1] - range[0])),
    },
  ];
  const xp = { wood: 15, silver: 30, gold: 60 }[tier];
  if (rand() < 0.6) loot.push({ kind: 'xp', amount: xp });
  const odds = {
    wood: { freeze: 0.12, doubler: 0.1, game: 0, avatar: 0 },
    silver: { freeze: 0.25, doubler: 0.2, game: 0.08, avatar: 0.1 },
    gold: { freeze: 0.4, doubler: 0.3, game: 0.25, avatar: 0.3 },
  }[tier];
  if ((game.freezes ?? 0) < MAX_FREEZES && rand() < odds.freeze) loot.push({ kind: 'freeze' });
  if (rand() < odds.doubler) loot.push({ kind: 'doubler', wins: 3 });
  const locked = GAMES.filter((g) => !isUnlocked(g.id, game.unlocked));
  if (locked.length && rand() < odds.game)
    loot.push({
      kind: 'game',
      game: locked[Math.floor(rand() * locked.length)],
    });
  // Reward avatars only come from chests.
  const avatars = AVATARS.filter((a) => isRewardAvatar(a) && !game.unlocked.includes(avatarGiftId(a.id)));
  if (avatars.length && rand() < odds.avatar) loot.push({ kind: 'avatar', avatar: avatars[Math.floor(rand() * avatars.length)] });
  return loot;
}

/** The chest a finished run earns, if any: gold for a great score, silver for a win. */
export const chestFor = (g: GameDef, score: number): ChestTier | null => (stars(g, score) === 3 ? 'gold' : stars(g, score) === 2 ? 'silver' : null);

export interface RunResult {
  game: BrainId;
  score: number;
  won: boolean;
  newBest: boolean;
  tokens: number;
  xp: number;
  chest: ChestTier | null;
  /** Id of the dropped chest, so the result screen can open it. */
  chestId?: string;
  doubled: boolean;
  /** True when today's paid wins are used up, so the run paid nothing. */
  capped: boolean;
}
