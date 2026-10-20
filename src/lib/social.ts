import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { useSyncExternalStore } from 'react';
import { AppState, Platform } from 'react-native';

import type { IconName } from '@/components/icon';
import { C } from '@/constants/theme';

import type { ChestTier } from './arcade';
import { currentSession, onSessionChange, supabase } from './cloud';
import { language, t } from './i18n';
import { LEGAL } from './legal';
import { dayKey, loggedDays, macroTargets, streak, summarize } from './nutrition';
import { PERFECT_DAY, questsFor, questXp } from './quests';
import { crewRank, weekStart, weeklyXp } from './rank';
import { playSfx } from './sound';
import { actions, getState } from './store';
import type { Entry, Targets } from './types';

// Pulse Squad: friends, a weekly friends board, crews with a shared streak, challenges and nudges.
// Everything here needs a Pulse account. The server keeps only what friends see (name, colour,
// rank, streak, XP and which days someone logged); XP and progress are computed on the device.

// ---------- Types ----------

export const SQUAD_COLORS = ['orange', 'pink', 'lime', 'cyan', 'violet', 'yellow', 'blue'] as const;
export type SquadColor = (typeof SQUAD_COLORS)[number];
export const colorOf = (c: string | undefined) => (C as Record<string, string>)[c ?? ''] ?? C.orange;

export interface Player {
  userId: string;
  name: string;
  color: string;
  xp: number;
  level: number;
  streak: number;
  /** Last day they logged anything, in their own calendar. */
  lastDay?: string;
}

export interface MyCard extends Player {
  inviteCode: string;
}

export interface BoardRow extends Player {
  weeklyXp: number;
  me: boolean;
  friend: boolean;
}

export interface CrewMember {
  userId: string;
  /** Null when either of you blocked the other. */
  name: string | null;
  color: string;
  level: number;
  streak: number;
  weeklyXp: number;
  loggedToday: boolean;
  hidden: boolean;
}

export interface CrewView {
  id: string;
  name: string;
  inviteCode: string;
  streak: number;
  members: CrewMember[];
}

export type ChallengeTemplate =
  | 'logging' | 'protein' | 'meals' | 'water' | 'workouts'
  | 'calories' | 'sleep' | 'journal' | 'breakfast' | 'weighin' | 'active' | 'burn' | 'quests' | 'perfect';

export interface Challenge {
  id: string;
  template: ChallengeTemplate;
  target: number;
  starts: string;
  ends: string;
  createdBy: string;
  opponent: string | null;
  declined: boolean;
  /** Hard mode: a tougher goal for a better chest. */
  hard: boolean;
  progress: Record<string, { progress: number; completedAt: string | null }>;
}

export interface Nudge {
  id: number;
  sender: string;
  senderName: string;
  day: string;
  at: string;
  seen: boolean;
}

interface SquadState {
  /** The first load for this account has finished. */
  loaded: boolean;
  loading: boolean;
  me: MyCard | null;
  friends: Set<string>;
  board: BoardRow[];
  lastWeek: { week: string; rows: BoardRow[] };
  crews: CrewView[];
  challenges: Challenge[];
  nudges: Nudge[];
  /** Friends nudged today (sender's calendar), so the button can show "nudged". */
  nudgedToday: Set<string>;
  error?: string;
}

const empty = (): SquadState => ({
  loaded: false,
  loading: false,
  me: null,
  friends: new Set(),
  board: [],
  lastWeek: { week: '', rows: [] },
  crews: [],
  challenges: [],
  nudges: [],
  nudgedToday: new Set(),
});

let squad = empty();
const listeners = new Set<() => void>();
const set = (patch: Partial<SquadState>) => {
  squad = { ...squad, ...patch };
  listeners.forEach((l) => l());
};

export function useSquad<T>(select: (s: SquadState) => T): T {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => select(squad),
  );
}
export const getSquad = () => squad;

// ---------- Errors ----------

const KNOWN = new Set([
  'rules_not_accepted', 'bad_name', 'code_not_found', 'own_code', 'too_many_friends', 'no_profile', 'too_many_crews',
  'crew_full', 'not_friends', 'too_many_challenges', 'already_nudged', 'rate_limited',
]);

export class SquadError extends Error {
  constructor(public code: string) {
    super(KNOWN.has(code) ? t(`squad.err_${code}`) : t('squad.errGeneric'));
  }
}

async function rpc<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  if (!supabase || !currentSession()) throw new SquadError('unauthorized');
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new SquadError(error.message);
  return data as T;
}

const me = () => currentSession()?.user.id;
const todayKey = () => dayKey(new Date());
const lastMonday = () => {
  const d = new Date(weekStart() + 'T12:00');
  d.setDate(d.getDate() - 7);
  return dayKey(d);
};

// ---------- Loading ----------

type ProfileRow = { user_id: string; name: string; color: string; xp: number; level: number; streak: number; last_day: string | null; invite_code?: string };
const toPlayer = (p: ProfileRow): Player => ({ userId: p.user_id, name: p.name, color: p.color, xp: p.xp, level: p.level, streak: p.streak, lastDay: p.last_day ?? undefined });

/** Reloads everything Squad shows. Safe to call often; overlapping calls are merged. */
let inflight: Promise<void> | null = null;
export function refreshSquad(): Promise<void> {
  if (inflight) return inflight;
  inflight = load().finally(() => (inflight = null));
  return inflight;
}

async function load() {
  const uid = me();
  if (!supabase || !uid) {
    squad = empty();
    listeners.forEach((l) => l());
    return;
  }
  set({ loading: true, error: undefined });
  try {
    const db = supabase;
    const week = weekStart();
    const prev = lastMonday();
    const [profiles, friendships, scores, crews, challenges, progress, nudges] = await Promise.all([
      db.from('social_profiles').select('user_id, name, color, xp, level, streak, last_day, invite_code'),
      db.from('friendships').select('user_a, user_b'),
      db.from('weekly_scores').select('user_id, week, xp').in('week', [week, prev]),
      db.from('crews').select('id, name, invite_code'),
      db.from('challenges').select('*').gte('ends', dayKey(Date.now() - 21 * 864e5)),
      db.from('challenge_progress').select('challenge_id, user_id, progress, completed_at'),
      db.from('nudges').select('id, sender, recipient, day, created_at, seen_at').gte('created_at', new Date(Date.now() - 7 * 864e5).toISOString()).order('created_at', { ascending: false }),
    ]);
    const firstError = [profiles, friendships, scores, crews, challenges, progress, nudges].find((r) => r.error)?.error;
    if (firstError) throw firstError;

    const rows = (profiles.data ?? []) as ProfileRow[];
    const mine = rows.find((p) => p.user_id === uid);
    const friendIds = new Set((friendships.data ?? []).map((f: { user_a: string; user_b: string }) => (f.user_a === uid ? f.user_b : f.user_a)));
    const players = new Map(rows.map((p) => [p.user_id, toPlayer(p)]));

    const boardFor = (w: string): BoardRow[] => {
      const xp = new Map((scores.data ?? []).filter((s: { week: string }) => s.week === w).map((s: { user_id: string; xp: number }) => [s.user_id, s.xp]));
      return [...players.values()]
        .filter((p) => p.userId === uid || friendIds.has(p.userId))
        .map((p) => ({ ...p, weeklyXp: xp.get(p.userId) ?? 0, me: p.userId === uid, friend: friendIds.has(p.userId) }))
        .sort((a, b) => b.weeklyXp - a.weeklyXp || b.xp - a.xp);
    };

    const crewViews = await Promise.all(
      (crews.data ?? []).map(async (c: { id: string; name: string; invite_code: string }) => {
        const { data, error } = await db.rpc('crew_overview', { p_crew: c.id, p_today: todayKey() });
        if (error) throw error;
        const members = (data ?? []) as {
          user_id: string; name: string | null; color: string; level: number; streak: number; weekly_xp: number; logged_today: boolean; hidden: boolean; crew_streak: number;
        }[];
        return {
          id: c.id,
          name: c.name,
          inviteCode: c.invite_code,
          streak: members[0]?.crew_streak ?? 0,
          members: members.map((m) => ({ userId: m.user_id, name: m.name, color: m.color, level: m.level, streak: m.streak, weeklyXp: m.weekly_xp, loggedToday: m.logged_today, hidden: m.hidden })),
        };
      }),
    );

    const progressBy = new Map<string, Challenge['progress']>();
    for (const p of (progress.data ?? []) as { challenge_id: string; user_id: string; progress: number; completed_at: string | null }[]) {
      const m = progressBy.get(p.challenge_id) ?? {};
      m[p.user_id] = { progress: p.progress, completedAt: p.completed_at };
      progressBy.set(p.challenge_id, m);
    }
    const challengeList: Challenge[] = ((challenges.data ?? []) as {
      id: string; template: ChallengeTemplate; target: number; starts: string; ends: string; created_by: string; opponent: string | null; declined_at: string | null; hard?: boolean;
    }[]).map((c) => ({
      id: c.id,
      template: c.template,
      target: c.target,
      starts: c.starts,
      ends: c.ends,
      createdBy: c.created_by,
      opponent: c.opponent,
      declined: !!c.declined_at,
      hard: !!c.hard,
      progress: progressBy.get(c.id) ?? {},
    }));

    const nudgeRows = (nudges.data ?? []) as { id: number; sender: string; recipient: string; day: string; created_at: string; seen_at: string | null }[];
    set({
      loaded: true,
      me: mine ? { ...toPlayer(mine), inviteCode: mine.invite_code ?? '' } : null,
      friends: friendIds,
      board: boardFor(week),
      lastWeek: { week: prev, rows: boardFor(prev) },
      crews: crewViews,
      challenges: challengeList.sort((a, b) => b.starts.localeCompare(a.starts)),
      nudges: nudgeRows
        .filter((n) => n.recipient === uid)
        .map((n) => ({ id: n.id, sender: n.sender, senderName: players.get(n.sender)?.name ?? t('squad.someone'), day: n.day, at: n.created_at, seen: !!n.seen_at })),
      nudgedToday: new Set(nudgeRows.filter((n) => n.sender === uid && n.day === todayKey()).map((n) => n.recipient)),
    });
    if (mine) {
      registerPush().catch(() => {});
      reportChallengeProgress().catch(() => {});
    }
  } catch (e) {
    console.warn('[squad] load failed', e);
    set({ error: t('squad.errLoad') });
  } finally {
    set({ loading: false });
  }
}

/** Display name for a player id, from friends, crewmates or the board. */
export function nameOf(userId: string | null | undefined) {
  if (!userId) return '';
  const row = squad.board.find((r) => r.userId === userId);
  if (row) return row.name;
  for (const c of squad.crews) {
    const m = c.members.find((x) => x.userId === userId);
    if (m) return m.name ?? t('squad.hiddenPlayer');
  }
  return t('squad.someone');
}

// ---------- My card and stats ----------

export async function joinSquad(name: string, color: SquadColor) {
  await rpc('save_social_profile', { p_name: name, p_color: color, p_accept_rules: true });
  await syncStats();
  await refreshSquad();
}

export async function updateCard(name: string, color: SquadColor) {
  await rpc('save_social_profile', { p_name: name, p_color: color });
  await refreshSquad();
}

/** Sends this device's numbers (the ones HQ shows) so friends see them. */
export async function syncStats() {
  if (!supabase || !me()) return;
  const { entries, game } = getState();
  const frozen = game.frozenDays ?? [];
  const rank = crewRank(entries, questXp(game.claims), frozen);
  const days = [...loggedDays(entries)].filter((k) => k >= dayKey(Date.now() - 45 * 864e5)).sort();
  await rpc('sync_social_stats', {
    p_xp: rank.xp,
    p_level: rank.level,
    p_streak: streak(entries, frozen),
    p_week: weekStart(),
    p_weekly_xp: weeklyXp(entries, game.claims, weekStart()),
    p_days: days,
  });
}

let syncTimer: ReturnType<typeof setTimeout> | undefined;
/** Debounced stats sync, for after logging. */
export function scheduleSync() {
  if (!squad.me) return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    syncStats()
      .then(() => reportChallengeProgress())
      .catch((e) => console.warn('[squad] sync failed', e));
  }, 4000);
}

// ---------- Friends ----------

const SITE = LEGAL.support.endsWith('/') ? LEGAL.support : `${LEGAL.support}/`;
export const friendLink = (code: string) => `${SITE}invite.html?f=${code}`;
export const crewLink = (code: string) => `${SITE}invite.html?c=${code}`;
export const APP_STORE_URL = 'https://apps.apple.com/app/id6824666479';

export async function addFriend(code: string) {
  const p = await rpc<ProfileRow>('add_friend', { p_code: code });
  await refreshSquad();
  return p.name;
}

export async function removeFriend(userId: string) {
  await rpc('remove_friend', { p_other: userId });
  await refreshSquad();
}

export async function blockPlayer(userId: string) {
  await rpc('block_user', { p_other: userId });
  await refreshSquad();
}

export async function unblockPlayer(userId: string) {
  await rpc('unblock_user', { p_other: userId });
}

export const listBlocked = () => rpc<{ user_id: string; name: string }[]>('my_blocks');

export type ReportReason = 'name' | 'harassment' | 'cheating' | 'other';
export async function reportPlayer(userId: string, reason: ReportReason, details?: string, crewId?: string) {
  await rpc('report_user', { p_other: userId, p_reason: reason, p_details: details ?? null, p_crew: crewId ?? null });
}

/** Whether a friend hasn't logged today, so a nudge makes sense. */
export const needsNudge = (p: { lastDay?: string; loggedToday?: boolean }) => (p.loggedToday !== undefined ? !p.loggedToday : p.lastDay !== todayKey());

export async function nudge(userId: string) {
  if (!supabase || !me()) throw new SquadError('unauthorized');
  const { data, error } = await supabase.functions.invoke('nudge', { body: { to: userId, day: todayKey() } });
  if (error) {
    const status = (error as { context?: { status?: number } }).context?.status;
    throw new SquadError(status === 409 ? 'already_nudged' : status === 403 ? 'not_friends' : 'nudge_failed');
  }
  set({ nudgedToday: new Set([...squad.nudgedToday, userId]) });
  playSfx('nudge');
  return data as { delivered: number };
}

export async function markNudgesSeen() {
  if (!squad.nudges.some((n) => !n.seen)) return;
  await rpc('mark_nudges_seen').catch(() => {});
  set({ nudges: squad.nudges.map((n) => ({ ...n, seen: true })) });
}

// ---------- Crews ----------

export async function createCrew(name: string) {
  const c = await rpc<{ id: string }>('create_crew', { p_name: name, p_today: todayKey() });
  await syncStats().catch(() => {});
  await refreshSquad();
  return c.id;
}

export async function joinCrew(code: string) {
  const c = await rpc<{ id: string; name: string }>('join_crew', { p_code: code, p_today: todayKey() });
  await syncStats().catch(() => {});
  await refreshSquad();
  return c;
}

export async function leaveCrew(id: string) {
  await rpc('leave_crew', { p_crew: id });
  await refreshSquad();
}

// ---------- Challenges ----------

export const CHALLENGE_DAYS = [3, 7, 14] as const;
export type ChallengeDays = (typeof CHALLENGE_DAYS)[number];

export type ChallengeGroup = 'habits' | 'nutrition' | 'training' | 'arcade';

/**
 * Challenge types. `perWeek` is the goal for 7 days, scaled to the length. `per: 'day'` goals count
 * days that hit the bar (capped at the number of days); the rest add up (minutes, kcal, workouts).
 */
export const CHALLENGES: Record<ChallengeTemplate, { icon: IconName; color: string; perWeek: number; per: 'day' | 'total'; group: ChallengeGroup }> = {
  logging: { icon: 'flame', color: C.yellow, perWeek: 7, per: 'day', group: 'habits' },
  journal: { icon: 'journal', color: C.violet, perWeek: 5, per: 'day', group: 'habits' },
  sleep: { icon: 'moon', color: C.blue, perWeek: 5, per: 'day', group: 'habits' },
  breakfast: { icon: 'sun', color: C.orange, perWeek: 5, per: 'day', group: 'habits' },
  weighin: { icon: 'scale', color: C.cyan, perWeek: 3, per: 'total', group: 'habits' },
  protein: { icon: 'bolt', color: C.protein, perWeek: 5, per: 'day', group: 'nutrition' },
  calories: { icon: 'target', color: C.lime, perWeek: 5, per: 'day', group: 'nutrition' },
  meals: { icon: 'fork', color: C.orange, perWeek: 6, per: 'day', group: 'nutrition' },
  water: { icon: 'drop', color: C.water, perWeek: 5, per: 'day', group: 'nutrition' },
  workouts: { icon: 'dumbbell', color: C.lime, perWeek: 3, per: 'total', group: 'training' },
  active: { icon: 'figure', color: C.pink, perWeek: 150, per: 'total', group: 'training' },
  burn: { icon: 'flame', color: C.orange, perWeek: 1500, per: 'total', group: 'training' },
  quests: { icon: 'trophy', color: C.yellow, perWeek: 12, per: 'total', group: 'arcade' },
  perfect: { icon: 'sparkles', color: C.violet, perWeek: 2, per: 'day', group: 'arcade' },
};

export const CHALLENGE_GROUPS: ChallengeGroup[] = ['habits', 'nutrition', 'training', 'arcade'];

/** Hard mode asks for 40% more (day goals still can't exceed the number of days). */
export const HARD_FACTOR = 1.4;

/** The goal for a challenge of `days` days: the weekly goal scaled to the length, at least 1. */
export function challengeTarget(template: ChallengeTemplate, days: number, hard = false) {
  const def = CHALLENGES[template];
  const raw = (def.perWeek * days * (hard ? HARD_FACTOR : 1)) / 7;
  const round = def.perWeek >= 100 ? 10 : 1;
  const n = Math.max(1, Math.round(raw / round) * round);
  return def.per === 'day' ? Math.min(days, n) : n;
}

/** How far the player is in a challenge, counted from this device's logs and claims. */
export function challengeProgress(
  template: ChallengeTemplate,
  starts: string,
  ends: string,
  entries: Entry[],
  targets: Targets,
  claims: { day: string; questId: string }[] = [],
) {
  let n = 0;
  const d = new Date(starts + 'T12:00');
  const last = ends < todayKey() ? ends : todayKey();
  for (; dayKey(d) <= last; d.setDate(d.getDate() + 1)) {
    const k = dayKey(d);
    const s = summarize(entries, k);
    const day = entries.filter((e) => !e.passive && dayKey(e.createdAt) === k);
    switch (template) {
      case 'workouts': n += s.workouts; break;
      case 'active': n += s.activeMin; break;
      case 'burn': n += Math.round(day.reduce((m, e) => m + (e.kind === 'exercise' ? (e.caloriesBurned ?? 0) : 0), 0)); break;
      case 'weighin': n += day.filter((e) => e.kind === 'weight').length; break;
      case 'protein': n += s.protein >= targets.protein * 0.9 ? 1 : 0; break;
      case 'meals': n += s.meals >= 2 ? 1 : 0; break;
      case 'water': n += s.water >= targets.waterMl ? 1 : 0; break;
      case 'calories': n += s.eaten > 0 && Math.abs(s.eaten - s.burned - targets.calories) <= targets.calories * 0.12 ? 1 : 0; break;
      case 'sleep': n += day.some((e) => (e.sleepHours ?? 0) >= 7) ? 1 : 0; break;
      case 'journal': n += day.some((e) => e.kind === 'journal' && !e.healthId) ? 1 : 0; break;
      case 'breakfast': n += day.some((e) => e.kind === 'meal' && new Date(e.createdAt).getHours() < 10) ? 1 : 0; break;
      case 'quests': {
        const ids = new Set(questsFor(k).map((q) => q.id));
        n += claims.filter((c) => c.day === k && ids.has(c.questId)).length;
        break;
      }
      case 'perfect': n += claims.some((c) => c.day === k && c.questId === PERFECT_DAY) ? 1 : 0; break;
      default: n += day.length ? 1 : 0;
    }
  }
  return n;
}

export async function createChallenge(template: ChallengeTemplate, days: ChallengeDays, opponent: string | null, hard = false) {
  await rpc('create_challenge', {
    p_template: template,
    p_target: challengeTarget(template, days, hard),
    p_starts: todayKey(),
    p_days: days,
    p_opponent: opponent,
    // Left out unless set, so a server without hard mode still takes ordinary challenges.
    ...(hard ? { p_hard: true } : {}),
  });
  await reportChallengeProgress().catch(() => {});
  await refreshSquad();
}

export async function declineChallenge(id: string) {
  await rpc('decline_challenge', { p_id: id });
  await refreshSquad();
}

/** Sends this device's progress on every running challenge. */
async function reportChallengeProgress() {
  const uid = me();
  if (!uid) return;
  const { entries, profile, game } = getState();
  const targets = macroTargets(profile);
  const today = todayKey();
  for (const c of squad.challenges) {
    if (c.declined || c.starts > today || c.ends < dayKey(Date.now() - 864e5)) continue;
    const value = Math.min(c.target, challengeProgress(c.template, c.starts, c.ends, entries, targets, game.claims));
    if (value > (c.progress[uid]?.progress ?? 0)) {
      await rpc('report_challenge_progress', { p_id: c.id, p_progress: value });
      c.progress[uid] = { progress: value, completedAt: value >= c.target ? new Date().toISOString() : null };
    }
  }
  set({ challenges: [...squad.challenges] });
}

export type Outcome = 'running' | 'won' | 'lost' | 'tied' | 'done' | 'missed' | 'off';

/**
 * Where a challenge stands for the player. A duel ends as soon as someone reaches the goal (first
 * one wins) or when its last day is over (most progress wins). A solo challenge is done when the
 * goal is reached, and missed if the days run out first.
 */
export function outcome(c: Challenge, uid = me()): Outcome {
  if (c.declined) return 'off';
  const today = todayKey();
  const mine = c.progress[uid ?? ''];
  if (!c.opponent) {
    if (mine?.completedAt) return 'done';
    return today > c.ends ? 'missed' : 'running';
  }
  const otherId = c.createdBy === uid ? c.opponent : c.createdBy;
  const theirs = c.progress[otherId];
  if (mine?.completedAt || theirs?.completedAt) {
    if (mine?.completedAt && theirs?.completedAt) return mine.completedAt === theirs.completedAt ? 'tied' : mine.completedAt < theirs.completedAt ? 'won' : 'lost';
    return mine?.completedAt ? 'won' : 'lost';
  }
  if (today <= c.ends) return 'running';
  const a = mine?.progress ?? 0;
  const b = theirs?.progress ?? 0;
  return a === b ? 'tied' : a > b ? 'won' : 'lost';
}

/** The chest a finished challenge pays, if any. Hard mode bumps a finished solo or a tie to gold. */
export const challengeChest = (o: Outcome, hard = false): ChestTier | null =>
  o === 'won' ? 'gold' : o === 'tied' || o === 'done' ? (hard ? 'gold' : 'silver') : null;
export const challengeClaimId = (id: string) => `challenge:${id}`;

export function claimChallenge(c: Challenge) {
  const tier = challengeChest(outcome(c), c.hard);
  return tier ? actions.grantChest(tier, challengeClaimId(c.id), 'challenge') : null;
}

// ---------- Weekly board ----------

export const LEAGUE_CHESTS: ChestTier[] = ['gold', 'silver', 'wood'];
export const leagueClaimId = (week: string) => `league:${week}`;

/** Last week's place (1-based) and chest, when the player finished top 3 among at least two players. */
export function lastWeekPrize() {
  const rows = squad.lastWeek.rows.filter((r) => r.weeklyXp > 0);
  const place = rows.findIndex((r) => r.me) + 1;
  if (rows.length < 2 || place < 1 || place > 3) return null;
  return { place, tier: LEAGUE_CHESTS[place - 1], week: squad.lastWeek.week, claimed: getState().game.claims.some((c) => c.questId === leagueClaimId(squad.lastWeek.week)) };
}

export function claimLeague() {
  const prize = lastWeekPrize();
  return prize && !prize.claimed ? actions.grantChest(prize.tier, leagueClaimId(prize.week), 'league') : null;
}

/** Days left in this week's board, including today. */
export const daysLeftInWeek = () => 7 - ((new Date().getDay() + 6) % 7);

// ---------- Push ----------

/** Registers this iPhone for nudge notifications (when the player allowed notifications). */
async function registerPush() {
  if (Platform.OS !== 'ios' || !Device.isDevice) return;
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') return;
  const token = await Notifications.getDevicePushTokenAsync();
  await rpc('register_push_token', { p_token: String(token.data), p_sandbox: __DEV__, p_lang: language });
}

/** Asks for notification permission (for nudges) and registers the device. */
export async function enablePush() {
  if (Platform.OS === 'web') return false;
  const { status } = await Notifications.requestPermissionsAsync();
  if (status === 'granted') await registerPush().catch(() => {});
  return status === 'granted';
}

// ---------- Keeping in step ----------

onSessionChange((s) => {
  if (!s) {
    squad = empty();
    listeners.forEach((l) => l());
  } else refreshSquad();
});
AppState.addEventListener('change', (s) => {
  if (s === 'active' && squad.me) {
    syncStats()
      .catch(() => {})
      .finally(() => refreshSquad());
  }
});
