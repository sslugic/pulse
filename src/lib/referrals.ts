import { currentSession, supabase } from './cloud';
import { t } from './i18n';
import { questXp } from './quests';
import { crewRank } from './rank';
import { actions, getState } from './store';

// Trading XP for AI credits. The server holds the rules and the limits
// (supabase/migrations/20261022000000_rewards.sql): 1,000 XP buys 10 credits, at most 20 a week,
// from accounts at least a week old that aren't guests. Referral codes no longer give credits
// (App Review guideline 3.1.1; supabase/migrations/20261103000000_app_review_guests.sql).

export const XP_PER_TRADE = 1000;
export const CREDITS_PER_TRADE = 10;
export const WEEKLY_TRADE_CAP = 20;

const KNOWN = new Set(['referral_too_late', 'referral_used', 'code_not_found', 'own_code', 'xp_too_new', 'xp_weekly_cap', 'xp_not_enough']);

export class RewardError extends Error {
  constructor(public code: string) {
    super(KNOWN.has(code) ? t(`credits.err_${code}`) : t('credits.errGeneric'));
  }
}

async function rpc<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  if (!supabase || !currentSession()) throw new RewardError('unauthorized');
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new RewardError(error.message);
  return data as T;
}

// ---------- XP for credits ----------

/** Lifetime XP, the same number the rank screen shows. */
export function totalXp() {
  const { entries, game } = getState();
  return crewRank(entries, questXp(game.claims), game.frozenDays).xp;
}

export interface TradeStatus {
  /** XP not traded yet. */
  available: number;
  creditsThisWeek: number;
  eligible: boolean;
}

/** XP the player can spend on unlocks right now: lifetime XP minus what was traded or spent. */
export async function spendableXp() {
  const local = totalXp() - (getState().game.xpSpent ?? 0);
  if (!supabase || !currentSession()) return Math.max(0, local);
  const { data, error } = await supabase.rpc('xp_trade_status');
  // A server without XP trading yet has nothing traded.
  const traded = error ? 0 : ((data as { xp_spent: number }[])[0]?.xp_spent ?? 0);
  return Math.max(0, local - traded);
}

export async function xpTradeStatus(): Promise<TradeStatus> {
  const rows = await rpc<{ xp_spent: number; credits_this_week: number; eligible: boolean }[]>('xp_trade_status');
  const r = rows[0];
  return { available: Math.max(0, totalXp() - (getState().game.xpSpent ?? 0) - r.xp_spent), creditsThisWeek: r.credits_this_week, eligible: r.eligible };
}

/** Trades 1,000 XP for 10 credits. Returns the new balance. */
export async function tradeXp() {
  // XP spent on unlocks in the app is taken off first, so the same XP can't be spent twice.
  const balance = await rpc<number>('redeem_xp', { p_total_xp: totalXp() - (getState().game.xpSpent ?? 0) });
  await actions.refreshAccount();
  return balance;
}
