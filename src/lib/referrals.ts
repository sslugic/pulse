import AsyncStorage from '@react-native-async-storage/async-storage';

import { currentSession, onSessionChange, supabase } from './cloud';
import { t } from './i18n';
import { LEGAL } from './legal';
import { questXp } from './quests';
import { crewRank } from './rank';
import { actions, getState } from './store';

// Referrals and trading XP for AI credits. The server holds the rules and the limits
// (supabase/migrations/20261022000000_rewards.sql): both sides of a referral get 25 credits, and
// 1,000 XP buys 10 credits, at most 20 a week, from accounts at least a week old.

export const REFERRAL_CREDITS = 25;
export const XP_PER_TRADE = 1000;
export const CREDITS_PER_TRADE = 10;
export const WEEKLY_TRADE_CAP = 20;

const PENDING_KEY = 'pulse:pending-referral';

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

const SITE = LEGAL.support.endsWith('/') ? LEGAL.support : `${LEGAL.support}/`;
export const referralLink = (code: string) => `${SITE}invite.html?r=${code}`;

export interface ReferralStats {
  code: string;
  referred: number;
  creditsEarned: number;
  /** This account can still enter someone else's code (new and not referred yet). */
  canClaim: boolean;
}

export async function myReferrals(): Promise<ReferralStats> {
  const rows = await rpc<{ code: string; referred: number; credits_earned: number; can_claim: boolean }[]>('my_referrals');
  const r = rows[0];
  return { code: r.code, referred: r.referred, creditsEarned: r.credits_earned, canClaim: r.can_claim };
}

/** Enters a referral code. Returns the new credit balance. */
export async function claimReferral(code: string) {
  const balance = await rpc<number>('claim_referral', { p_code: code.trim() });
  await AsyncStorage.removeItem(PENDING_KEY).catch(() => {});
  await actions.refreshAccount();
  return balance;
}

/**
 * Keeps a code from a referral link until the player has an account. Claimed right away when signed
 * in, otherwise as soon as they sign in.
 */
export async function rememberReferral(code: string) {
  await AsyncStorage.setItem(PENDING_KEY, code.toUpperCase()).catch(() => {});
  if (currentSession()) return claimPendingReferral();
  return null;
}

export async function claimPendingReferral() {
  const code = await AsyncStorage.getItem(PENDING_KEY).catch(() => null);
  if (!code || !currentSession()) return null;
  try {
    return await claimReferral(code);
  } catch (e) {
    // A code that can never work (own, used, too late) is dropped; others are tried again later.
    if (e instanceof RewardError && e.code !== 'unauthorized') await AsyncStorage.removeItem(PENDING_KEY).catch(() => {});
    throw e;
  }
}

onSessionChange((s) => {
  if (s) claimPendingReferral().catch(() => {});
});

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

export async function xpTradeStatus(): Promise<TradeStatus> {
  const rows = await rpc<{ xp_spent: number; credits_this_week: number; eligible: boolean }[]>('xp_trade_status');
  const r = rows[0];
  return { available: Math.max(0, totalXp() - r.xp_spent), creditsThisWeek: r.credits_this_week, eligible: r.eligible };
}

/** Trades 1,000 XP for 10 credits. Returns the new balance. */
export async function tradeXp() {
  const balance = await rpc<number>('redeem_xp', { p_total_xp: totalXp() });
  await actions.refreshAccount();
  return balance;
}
