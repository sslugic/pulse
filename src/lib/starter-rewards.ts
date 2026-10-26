import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

import { currentSession, onSessionChange, supabase } from './cloud';
import { dayKey } from './nutrition';
import { actions, getState } from './store';
import type { Entry } from './types';

// Starter rewards: extra credits for a new player's first steps, so the Coach lasts their first week.
// The server pays each one once per account (supabase/migrations/20261025000000_starter_rewards.sql).
// A step done before signing in is remembered and paid as soon as there's an account. Each payout is
// announced with a pop-up (CreditsAnnouncement) that points at the next step.

export type StarterKind = 'profile' | 'tour' | 'first_day';
export const STARTER_ORDER: StarterKind[] = ['profile', 'tour', 'first_day'];
export const STARTER_CREDITS: Record<StarterKind, number> = { profile: 20, tour: 20, first_day: 30 };

const EARNED_KEY = 'pulse:starter-earned';
// Steps are earned on this phone; payouts are per account, so another account here still gets paid.
const paidKey = (userId: string) => `pulse:starter-paid:${userId}`;

/** A full first day: at least three things logged, one of them a meal. */
export function isFullDay(entries: Entry[], day: string) {
  const todays = entries.filter((e) => !e.passive && dayKey(e.createdAt) === day);
  return todays.length >= 3 && todays.some((e) => e.kind === 'meal');
}

// ---------- Announcements ----------

export interface Announcement {
  kind: StarterKind;
  credits: number;
}
let queue: Announcement[] = [];
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function useAnnouncement() {
  return useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => queue[0] ?? null,
  );
}
export function dismissAnnouncement() {
  queue = queue.slice(1);
  emit();
}

// ---------- Earning and paying ----------

// Steps already earned, kept in memory too so the pop-up can point at the next one.
let earnedNow = new Set<StarterKind>();

/** The next starter step still to do, for the pop-up's hint. */
export const nextStarter = () => STARTER_ORDER.find((k) => !earnedNow.has(k)) ?? null;

async function readSet(key: string) {
  const raw = await AsyncStorage.getItem(key).catch(() => null);
  return new Set<StarterKind>(raw ? JSON.parse(raw) : []);
}
const writeSet = (key: string, set: Set<StarterKind>) => AsyncStorage.setItem(key, JSON.stringify([...set])).catch(() => {});

/** Marks a starter step done and pays it out if signed in (otherwise at the next sign-in). */
export async function earnStarter(kind: StarterKind) {
  const earned = await readSet(EARNED_KEY);
  earnedNow = new Set([...earned, kind]);
  if (!earned.has(kind)) {
    earned.add(kind);
    await writeSet(EARNED_KEY, earned);
  }
  return payStarter();
}

let paying: Promise<void> | null = null;
/** Claims every earned step not paid yet, in order, and queues an announcement for each payout. */
export function payStarter() {
  if (!paying) paying = pay().finally(() => (paying = null));
  return paying;
}

async function pay() {
  const userId = currentSession()?.user.id;
  if (!supabase || !userId) return;
  const [earned, paid] = await Promise.all([readSet(EARNED_KEY), readSet(paidKey(userId))]);
  let changed = false;
  for (const kind of STARTER_ORDER) {
    if (!earned.has(kind) || paid.has(kind)) continue;
    const { data, error } = await supabase.rpc('claim_starter_reward', { p_kind: kind });
    // Network trouble: try again later. An account too old for starter rewards stops asking.
    if (error && !/starter_too_late|bad_kind/.test(error.message)) continue;
    paid.add(kind);
    changed = true;
    const granted = (data as { granted: number }[] | null)?.[0]?.granted ?? 0;
    if (granted > 0) {
      queue = [...queue, { kind, credits: granted }];
      emit();
    }
  }
  if (changed) {
    await writeSet(paidKey(userId), paid);
    actions.refreshAccount().catch(() => {});
  }
}

/** Checks the log for the first full day. Cheap; called after logging. */
export function checkFirstDay() {
  const { entries, onboarded } = getState();
  if (earnedNow.has('first_day')) return;
  if (onboarded && isFullDay(entries, dayKey(Date.now()))) earnStarter('first_day').catch(() => {});
}

readSet(EARNED_KEY).then((s) => (earnedNow = new Set([...earnedNow, ...s])));

onSessionChange((s) => {
  if (s) payStarter().catch(() => {});
});
