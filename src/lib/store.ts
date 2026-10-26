import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';

import { AiError, aiAvailable, askCoach, onCreditBalance, DEFAULT_MODEL, DEFAULT_VOICE, estimateMeal, makeMealPlan, makeWorkoutPlan, type Media, type PlanResult } from './gemini';
import { matchMeal, mealKey, nextDays, resultFor, spanDays, type MealPlanState, type MealSpan, type PlanResult as PlanDayResult, type WorkoutPlanState, type WorkoutSpan } from './plans';
import { deleteJournalPhoto, pickImage, saveJournalPhoto, saveProgressPhoto } from './media';
import { celebrate } from './haptics';
import { deleteAccount, fetchBalance, fetchCosts, fetchSubscription, loadBackup, onSessionChange, saveBackup, signInWithApple, signOut } from './cloud';
import { linkPurchases, unlinkPurchases } from './purchases';
import { activeEnergyByDay, connectHealth, healthAvailable, pullHealth, ensureHealthAccess } from './health';
import { cancelReminders, enableReminders, scheduleReminder } from './reminders';
import { dayKey, loggedDays, macroTargets, recommendedTargets } from './nutrition';
import { appIconUnlockId } from './app-icons';
import { ARCADE_CLAIM, ARCADE_XP, FREEZE_PRICE, MAX_FREEZES, SHOP, gameById, isUnlocked, type BrainId, type ChestTier, type GameId } from './arcade';
import { BEST_BONUS, CHESTS_PER_DAY, PAID_WINS_PER_DAY, WIN_TOKENS, WIN_XP, chestFor, chestsEarnedToday, dailyChestId, rollLoot, winsToday, type Loot, type RunResult } from './brain';
import { season, SEASON_BADGE_REWARD, SEASON_REWARD } from './seasons';
import { isPersonaUnlocked, personaById, personaUnlockId, starterCoachId, type PersonaId } from './personas';
import { dailyQuests, PERFECT_DAY, PERFECT_REWARD, tokenBalance, type Claim, type GameState } from './quests';
import { t } from './i18n';
import { logXp } from './rank';
import type { ChatMessage, Entry, Profile, Settings, Targets } from './types';
import { avatarById, avatarUnlockId, avatarGiftId, isAvatarUnlocked, type AvatarId } from './avatars';
import { OLD_TRACKS, trackById, trackUnlockId, type TrackId } from './music';
import { notifyRestored } from './overlays';
import { wallUnlockId, type WallId } from './walls';
import { configureSound, playSfx } from './sound';
import { speak, speakStream, stopSpeaking } from './voice';

interface State {
  ready: boolean;
  onboarded: boolean;
  profile: Profile;
  entries: Entry[]; // newest first
  messages: ChatMessage[]; // oldest first
  settings: Settings;
  thinking: boolean;
  game: GameState;
  /** Pulse cloud account (not persisted here; Supabase keeps the session). */
  account: Account;
  /** Private body-progress photos (paths relative to documents), oldest first. */
  photos: { id: string; path: string; at: number; weightKg?: number }[];
  /** Last AI meal plan and which grocery items are ticked; persisted. */
  mealPlan?: MealPlanState;
  workoutPlan?: WorkoutPlanState;
  /** How each finished planned day went, kept after the plan is cleared. */
  planHistory: Record<string, PlanDayResult>;
  /** Latest "+XP" pop-up; not persisted. */
  reward: Reward | null;
  /** Step of the guided app tour that's showing, or null; not persisted. */
  tourStep: number | null;
}

export interface Reward {
  id: string;
  xp: number;
  tokens: number;
  label: string;
  at: number;
}

const DATA_KEY = 'pulse:data:v1';
const KEY_KEY = 'pulse_gemini_api_key';
/** Development builds can call Gemini directly with a key from the gitignored .env.local; Release never does. */
const DEV_GEMINI_KEY = __DEV__ ? (process.env.EXPO_PUBLIC_GEMINI_API_KEY ?? '') : '';

const defaultProfile: Profile = {
  name: '',
  sex: 'male',
  age: 30,
  heightCm: 178,
  weightKg: 78,
  goal: 'maintain',
  activity: 'moderate',
  units: 'metric',
  pace: 'standard',
};

let state: State = {
  ready: false,
  onboarded: false,
  profile: defaultProfile,
  entries: [],
  messages: [],
  settings: { apiKey: DEV_GEMINI_KEY, model: DEFAULT_MODEL, voiceReplies: true, coachVoice: DEFAULT_VOICE },
  thinking: false,
  game: { claims: [], unlocked: [] },
  photos: [],
  planHistory: {},
  account: { costs: {} },
  reward: null,
  tourStep: null,
};

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function set(patch: Partial<State> | ((s: State) => Partial<State>)) {
  state = { ...state, ...(typeof patch === 'function' ? patch(state) : patch) };
  emit();
  schedulePersist();
}

function applySound() {
  const { settings } = state;
  configureSound({ music: settings.music === true, sfx: settings.sfx !== false, track: settings.musicTrack as TrackId | undefined, volume: settings.musicVolume });
}

let persistTimer: ReturnType<typeof setTimeout> | undefined;
function schedulePersist() {
  if (!state.ready) return;
  clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    const { onboarded, profile, entries, messages, settings, game, mealPlan, workoutPlan, planHistory, photos } = state;
    const data = {
      onboarded,
      profile,
      entries,
      // Photos live in the picker cache; keep chat light.
      messages: messages.filter((m) => !m.pending).map(({ retryable, ...m }) => m).slice(-150),
      model: settings.model,
      voiceReplies: settings.voiceReplies,
      coachVoice: settings.coachVoice,
      reminderHour: settings.reminderHour,
      notifyOff: settings.notifyOff,
      health: settings.health,
      autoPlans: settings.autoPlans,
      music: settings.music,
      sfx: settings.sfx,
      musicTrack: settings.musicTrack,
      musicVolume: settings.musicVolume,
      game,
      mealPlan,
      workoutPlan,
      planHistory,
      photos,
    };
    AsyncStorage.setItem(DATA_KEY, JSON.stringify(data)).catch(() => {});
    scheduleBackup(data);
  }, 250);
}

// Signed-in users get their data backed up to Pulse cloud, at most once a minute.
let backupTimer: ReturnType<typeof setTimeout> | undefined;
function scheduleBackup(data: unknown) {
  if (!state.account.userId) return;
  clearTimeout(backupTimer);
  backupTimer = setTimeout(() => {
    saveBackup(data)
      .then(() => set({ account: { ...state.account, backedUpAt: Date.now() } }))
      .catch((e) => console.warn('[backup] failed', e));
  }, 60_000);
}

// Older builds let users paste their own Gemini key into the Keychain. AI now runs only through Pulse
// cloud (the key is a server secret), so any stored key is wiped on launch.
const wipeStoredKey = () => (Platform.OS === 'web' ? AsyncStorage.removeItem(KEY_KEY) : SecureStore.deleteItemAsync(KEY_KEY)).catch(() => {});

export async function hydrate() {
  try {
    wipeStoredKey();
    const raw = await AsyncStorage.getItem(DATA_KEY);
    const data = raw ? JSON.parse(raw) : {};
    state = {
      ...state,
      onboarded: !!data.onboarded,
      profile: migrateProfile(data.profile),
      entries: data.entries ?? [],
      messages: data.messages ?? [],
      settings: {
        apiKey: DEV_GEMINI_KEY,
        model: data.model || DEFAULT_MODEL,
        voiceReplies: data.voiceReplies ?? true,
        // The voice is the coach's own (the separate voice picker is gone, so an old pick is replaced).
        coachVoice: personaById(migrateProfile(data.profile).persona).voice ?? DEFAULT_VOICE,
        reminderHour: data.reminderHour,
        notifyOff: data.notifyOff,
        health: data.health,
        autoPlans: data.autoPlans,
        music: data.music,
        sfx: data.sfx,
        musicTrack: OLD_TRACKS[data.musicTrack] ?? data.musicTrack,
        musicVolume: data.musicVolume,
      },
      // Plans from before per-day dates are dropped.
      mealPlan: data.mealPlan?.days?.[0]?.day ? data.mealPlan : undefined,
      workoutPlan: data.workoutPlan,
      planHistory: data.planHistory ?? {},
      photos: data.photos ?? [],
      game: {
        claims: data.game?.claims ?? [],
        // Tracks bought with XP in the first jukebox carry over to the 80s tracks that replaced them.
        unlocked: ((data.game?.unlocked ?? []) as string[]).map((u) => (u.startsWith('music:') && OLD_TRACKS[u.slice(6)] ? `music:${OLD_TRACKS[u.slice(6)]}` : u)),
        wall: data.game?.wall,
        freezes: data.game?.freezes ?? 0,
        frozenDays: data.game?.frozenDays ?? [],
        chests: data.game?.chests ?? [],
        doubler: data.game?.doubler ?? 0,
        bests: data.game?.bests ?? {},
        playedDay: data.game?.playedDay,
        // XP already spent on tracks and avatars; without it a restart would refund them.
        xpSpent: data.game?.xpSpent,
      },
    };
  } catch {
    // corrupt storage: start fresh rather than crash
  }
  state = { ...state, ready: true };
  applySound();
  emit();
}

// Older saves had calorieOverride/waterGoalMl and no pace.
function migrateProfile(raw: (Partial<Profile> & { calorieOverride?: number; waterGoalMl?: number }) | undefined): Profile {
  const { calorieOverride, waterGoalMl, ...rest } = raw ?? {};
  const p: Profile = { ...defaultProfile, ...rest };
  if (calorieOverride && p.custom?.calories == null) p.custom = { ...p.custom, calories: calorieOverride };
  return p;
}

// Safety net: models sometimes leave sleep hours only in the prose.
// Fields that belong to each kind; anything else the model sends (e.g. weightKg on a coffee) is dropped.
const KIND_FIELDS: Record<Entry['kind'], (keyof Entry)[]> = {
  meal: ['nutrition', 'items'],
  exercise: ['caloriesBurned', 'durationMin', 'intensity'],
  water: ['waterMl'],
  weight: ['weightKg'],
  journal: ['mood', 'energy', 'stress', 'sleepHours', 'sleepQuality', 'tags', 'summary', 'photo', 'scene'],
};
const KIND_SPECIFIC = new Set(Object.values(KIND_FIELDS).flat());

/** Keeps only the fields that make sense for the entry's kind, and fills meal nutrition from items if it's missing. */
function cleanEntry<T extends Partial<Entry>>(e: T): T {
  const kind = e.kind as Entry['kind'] | undefined;
  if (!kind) return e;
  const out = { ...e };
  for (const k of KIND_SPECIFIC) if (!KIND_FIELDS[kind].includes(k)) delete (out as Partial<Entry>)[k];
  if (kind === 'meal' && !hasNutrition(out) && out.items?.length) {
    const calories = out.items.reduce((n, i) => n + (i.calories || 0), 0);
    if (calories > 0) out.nutrition = { calories, protein: 0, carbs: 0, fat: 0 };
  }
  return out;
}

const hasNutrition = (e: Partial<Entry>) => !!e.nutrition && e.nutrition.calories > 0;

// Safety net: models sometimes put the burn in `nutrition` (dropped for exercise) or only in the reply,
// which logged workouts as 0 kcal. Recover it from there, else estimate it with METs like the prompt asks.
const MET = { low: 3.5, moderate: 6, high: 9 } as const;
const BURN_IN_TEXT = /burn\w*\D{0,25}?(\d{2,4})\s*(?:k?cal|calories)|(\d{2,4})\s*(?:k?cal|calories)\s*burn/i;

function fillExercise<T extends Partial<Entry>>(e: T, reply: string, onlyWorkout: boolean, weightKg: number): T {
  if (e.kind !== 'exercise' || (e.caloriesBurned ?? 0) > 0) return e;
  const fromNutrition = e.nutrition?.calories;
  const m = (e.note ?? '').match(BURN_IN_TEXT) ?? (onlyWorkout ? reply.match(BURN_IN_TEXT) : null);
  const fromText = m ? Number(m[1] ?? m[2]) : burnForDuration(reply, e.durationMin);
  const minutes = e.durationMin ?? 0;
  const estimate = minutes > 0 ? (MET[e.intensity ?? 'moderate'] * weightKg * minutes) / 60 : 0;
  const kcal = fromNutrition && fromNutrition > 0 ? fromNutrition : fromText > 0 ? fromText : estimate;
  if (!(kcal > 0)) console.warn('[coach] exercise logged without calories', e.title);
  return kcal > 0 ? { ...e, caloriesBurned: Math.round(kcal) } : e;
}

/**
 * With several workouts in one reply ("10 minutes on the elliptical for 94 calories and 25 minutes of
 * lifting for 212"), finds the calories said in the same clause as this workout's duration. Totals are skipped.
 */
function burnForDuration(reply: string, minutes?: number) {
  if (!minutes) return NaN;
  const clauses = reply.split(/[.;,]\s|\band\b/i);
  const dur = new RegExp(`\\b${Math.round(minutes)}\\s*-?\\s*min`, 'i');
  const hits = clauses.flatMap((c) => {
    if (!dur.test(c) || /total/i.test(c)) return [];
    const k = c.match(/(\d{2,4})\s*(?:k?cal|calories)/i);
    return k ? [Number(k[1])] : [];
  });
  return hits.length === 1 ? hits[0] : NaN;
}

function fillJournal<T extends Partial<Entry>>(e: T): T {
  if (e.kind !== 'journal' || e.sleepHours != null) return e;
  const text = `${e.summary ?? ''} ${(e.tags ?? []).join(' ')}`.toLowerCase().replace(/(\d+)\s+and\s+a\s+half/g, '$1.5');
  const m = text.match(/(\d+(?:\.\d+)?)\s*(?:h\b|hrs?\b|hours?\b)/);
  const n = m ? Number(m[1]) : NaN;
  return n > 0 && n <= 14 && /sleep|slept|night/.test(text) ? { ...e, sleepHours: n } : e;
}

/**
 * When a Coach entry happened. A named day ("yesterday") moves the entry back whole days, keeping the
 * replaced entry's time of day if there is one; a plain correction keeps the replaced entry's time.
 */
function entryTime(hoursAgo?: number, daysAgo?: number, replaced?: number) {
  const now = Date.now();
  if (daysAgo != null && daysAgo > 0) {
    const d = new Date(replaced ?? now - Math.max(0, Math.min(hoursAgo ?? 0, 12)) * 3600_000);
    const target = new Date(now);
    target.setDate(target.getDate() - Math.min(Math.round(daysAgo), 14));
    target.setHours(d.getHours(), d.getMinutes(), d.getSeconds(), 0);
    return target.getTime();
  }
  if (daysAgo === 0 && replaced != null && dayKey(replaced) !== dayKey(now)) return now;
  if (replaced != null) return replaced;
  return now - Math.max(0, Math.min(hoursAgo ?? 0, 48)) * 3600_000;
}

type CoachInput = { text?: string; image?: Media & { uri: string }; audio?: Media };
// Failed sends keep their payload in memory so the user can retry with one tap.
const retryInputs = new Map<string, CoachInput>();

export function useStore<T>(select: (s: State) => T): T {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => select(state),
    () => select(state),
  );
}

export const getState = () => state;

/** AI features can run: signed in to Pulse cloud (credits) or a personal Gemini key is set. */
export const canUseAI = () => !!state.account.userId || (__DEV__ && !!state.settings.apiKey);
export const useAiReady = () => useStore((s) => !!s.account.userId || (__DEV__ && !!s.settings.apiKey));

/** Newest weigh-in by date (entries are kept newest first). */
const latestWeight = (entries: Entry[]) => entries.find((e) => e.kind === 'weight' && e.weightKg);

let planning = false;

export const PLAN_MEAL_XP = 5;
export const PLAN_WORKOUT_XP = 25;

function markMealEaten(day: string, index: number, entryId: string) {
  const key = mealKey(day, index);
  if (!state.mealPlan || state.mealPlan.eaten[key]) return;
  set((s) => (s.mealPlan ? { mealPlan: { ...s.mealPlan, eaten: { ...s.mealPlan.eaten, [key]: entryId } } } : {}));
  set((s) => ({ game: { ...s.game, claims: [...s.game.claims, { day, questId: `plan-meal:${key}`, xp: PLAN_MEAL_XP, tokens: 0, at: Date.now() }] } }));
}

function markWorkoutDone(day: string, entryId: string) {
  if (!state.workoutPlan || state.workoutPlan.done[day]) return;
  set((s) => (s.workoutPlan ? { workoutPlan: { ...s.workoutPlan, done: { ...s.workoutPlan.done, [day]: entryId } } } : {}));
  set((s) => ({ game: { ...s.game, claims: [...s.game.claims, { day, questId: `plan-workout:${day}`, xp: PLAN_WORKOUT_XP, tokens: 0, at: Date.now() }] } }));
  pushReward(PLAN_WORKOUT_XP, 0, t('rewards.workoutPlanDone'));
  celebrate();
}

/** Ticks a logged meal or workout off today's plan when it matches. */
function matchToPlans(entry: Entry, announce: boolean) {
  const day = dayKey(entry.createdAt);
  if (entry.kind === 'meal' && state.mealPlan) {
    const d = state.mealPlan.days.find((x) => x.day === day);
    if (!d) return;
    const taken = new Set(d.meals.flatMap((_, i) => (state.mealPlan!.eaten[mealKey(day, i)] ? [i] : [])));
    const i = matchMeal(entry, d.meals, taken);
    if (i >= 0) {
      markMealEaten(day, i, entry.id);
      if (announce) pushReward(PLAN_MEAL_XP, 0, t('rewards.planMeal', { meal: d.meals[i].when.toUpperCase() }));
    }
  } else if (entry.kind === 'exercise' && state.workoutPlan) {
    const w = state.workoutPlan.days.find((x) => x.day === day);
    // Any real session (10+ min) on a planned training day counts.
    if (w && !w.rest && (entry.durationMin ?? 0) >= 10) markWorkoutDone(day, entry.id);
  }
}

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

/**
 * One "Everyday activity" entry per day for Health's active energy that isn't already in an
 * imported workout, e.g. a walk the iPhone tracked on its own. It only adds calories burned (no XP,
 * streak or workout), and is updated in place as the day goes on.
 */
async function syncEverydayActivity(since: Date) {
  const byDay = await activeEnergyByDay(new Date(Math.max(since.getTime(), Date.now() - 7 * 86400_000)));
  for (const [day, active] of byDay) {
    const id = `active:${day}`;
    const workouts = state.entries.filter((e) => e.kind === 'exercise' && !e.passive && e.healthId && dayKey(e.createdAt) === day).reduce((n, e) => n + (e.caloriesBurned ?? 0), 0);
    const extra = Math.max(0, active - workouts);
    const existing = state.entries.find((e) => e.healthId === id);
    if (existing) {
      if (existing.caloriesBurned !== extra) actions.updateEntry(existing.id, { caloriesBurned: extra });
    } else if (extra >= 15) {
      // Pinned to the end of that day (or now, for today) so it sits under the day's real logs.
      const end = new Date(day + 'T23:59');
      const entry: Entry = {
        id: uid(),
        kind: 'exercise',
        title: t('rewards.everydayActivity'),
        emoji: '🚶',
        createdAt: Math.min(end.getTime(), Date.now()),
        caloriesBurned: extra,
        durationMin: 0,
        intensity: 'low',
        source: 'quick',
        note: t('rewards.everydayActivityNote'),
        healthId: id,
        passive: true,
      };
      set((s) => ({ entries: [entry, ...s.entries].sort((a, b) => b.createdAt - a.createdAt) }));
    }
  }
}

let healthSyncing: Promise<number | null> | null = null;

/** Imports what's new in Apple Health. Returns how many entries came in, or null if Health couldn't be read. */
async function runHealthSync(): Promise<number | null> {
  const h = state.settings.health!;
  // Look back at least 3 days: a watch or scale often hands Health its data hours later with the
  // original time, which a window starting at the last sync would miss. Ids keep it from duplicating.
  const floor = Date.now() - 3 * 86400_000;
  const since = new Date(h.lastSync ? Math.min(h.lastSync - 6 * 3600_000, floor) : Date.now() - 7 * 86400_000);
  const known = new Set([...state.entries.flatMap((e) => (e.healthId ? [e.healthId] : [])), ...(h.ignored ?? [])]);
  try {
    await ensureHealthAccess();
    const fresh = await pullHealth(since, known);
    fresh.sort((a, b) => a.createdAt - b.createdAt).forEach((e) => actions.addEntry(e));
    await syncEverydayActivity(since);
    set((s) => ({ settings: { ...s.settings, health: { ...s.settings.health, on: true, lastSync: Date.now() } } }));
    return fresh.length;
  } catch (err) {
    console.warn('[health] sync failed', err);
    return null;
  }
}

// Logs that land together (one Coach reply can add several) share one pop-up.
function pushReward(xp: number, tokens: number, label: string, always = false) {
  if (xp <= 0 && tokens <= 0 && !always) return;
  const prev = state.reward;
  const now = Date.now();
  if (prev && now - prev.at < 1500 && prev.label === label) {
    set({ reward: { ...prev, xp: prev.xp + xp, tokens: prev.tokens + tokens, at: now } });
  } else {
    set({ reward: { id: uid(), xp, tokens, label, at: now } });
  }
}

export interface Account {
  userId?: string;
  email?: string;
  credits?: number;
  costs: Record<string, number>;
  subscription?: { active: boolean; expiresAt?: string; willRenew: boolean } | null;
  backedUpAt?: number;
}

// Keep the account in step with the Supabase session and every AI call's new balance.
onSessionChange((s) => {
  const userId = s?.user.id;
  if (userId === state.account.userId) return;
  set({ account: { costs: state.account.costs, userId, email: s?.user.email } });
  if (userId) {
    actions.refreshAccount();
    linkPurchases(userId).catch(() => {});
  } else unlinkPurchases().catch(() => {});
});
onCreditBalance((credits) => set({ account: { ...state.account, credits } }));

export const actions = {
  completeOnboarding(profile: Partial<Profile>, opts: { tour?: boolean } = {}) {
    set((s) => ({ onboarded: true, profile: { ...s.profile, ...profile }, tourStep: opts.tour ? 0 : null }));
  },
  /** Starts (or replays) the guided tour of the app. */
  startTour() {
    set({ tourStep: 0 });
  },
  setTourStep(step: number | null) {
    set({ tourStep: step });
  },
  updateProfile(patch: Partial<Profile>) {
    set((s) => ({ profile: { ...s.profile, ...patch } }));
  },
  setModel(model: string) {
    set((s) => ({ settings: { ...s.settings, model: model.trim() || DEFAULT_MODEL } }));
  },
  setSound(patch: { music?: boolean; sfx?: boolean; musicTrack?: TrackId; musicVolume?: number }) {
    set((s) => ({ settings: { ...s.settings, ...patch } }));
    applySound();
  },
  /** Unlocks a jukebox track early with XP. Returns false if it isn't affordable. */
  unlockTrack(id: TrackId, spendableXp: number) {
    const track = trackById(id);
    if (!track.xp || spendableXp < track.xp || state.game.unlocked.includes(trackUnlockId(id))) return false;
    set((s) => ({ game: { ...s.game, unlocked: [...s.game.unlocked, trackUnlockId(id)], xpSpent: (s.game.xpSpent ?? 0) + track.xp } }));
    celebrate();
    playSfx('fanfare');
    return true;
  },
  /** Unlocks an avatar early with XP. Returns false if it isn't for sale or isn't affordable. */
  unlockAvatar(id: AvatarId, spendableXp: number) {
    const a = avatarById(id);
    if (!a.xp || spendableXp < a.xp || state.game.unlocked.includes(avatarUnlockId(id))) return false;
    set((s) => ({ game: { ...s.game, unlocked: [...s.game.unlocked, avatarUnlockId(id)], xpSpent: (s.game.xpSpent ?? 0) + a.xp } }));
    celebrate();
    playSfx('fanfare');
    return true;
  },
  /** Sets the profile picture, if it's unlocked at this level. */
  chooseAvatar(id: AvatarId, level: number) {
    if (!isAvatarUnlocked(avatarById(id), level, state.game.unlocked)) return false;
    actions.updateProfile({ avatar: id });
    return true;
  },
  setVoiceReplies(voiceReplies: boolean) {
    set((s) => ({ settings: { ...s.settings, voiceReplies } }));
    if (!voiceReplies) stopSpeaking();
  },
  /** Switches coach personality and its voice. Buys it with tokens if needed. */
  choosePersona(id: PersonaId) {
    const p = personaById(id);
    const { game } = state;
    if (!isPersonaUnlocked(id, game.unlocked)) {
      if (tokenBalance(game) < p.price) return false;
      set((s) => ({ game: { ...s.game, unlocked: [...s.game.unlocked, personaUnlockId(id)] } }));
      celebrate();
    }
    actions.updateProfile({ persona: id });
    actions.setCoachVoice(p.voice);
    actions.speakMessage('voice-preview', p.sample);
    return true;
  },
  /** During setup a new player gets one coach free; picking again swaps the free one. */
  pickStarterCoach(id: PersonaId) {
    const p = personaById(id);
    set((s) => ({
      game: {
        ...s.game,
        unlocked: [...s.game.unlocked.filter((u) => !u.startsWith('gift:persona:')), ...(p.price ? [starterCoachId(id)] : [])],
      },
    }));
    actions.updateProfile({ persona: id });
    actions.setCoachVoice(p.voice);
    actions.speakMessage('voice-preview', p.sample);
  },
  /** Turns notifications on with the evening check-in at `hour`, or all off with undefined. Asks for permission first. */
  async setReminder(hour: number | undefined) {
    if (hour == null) {
      set((s) => ({ settings: { ...s.settings, reminderHour: undefined } }));
      await cancelReminders();
      return true;
    }
    if (!(await enableReminders())) return false;
    set((s) => ({ settings: { ...s.settings, reminderHour: hour } }));
    await actions.refreshReminder();
    return true;
  },
  refreshReminder() {
    const { settings, entries, game, profile } = state;
    if (settings.reminderHour == null) return Promise.resolve();
    const today = dayKey(Date.now());
    return scheduleReminder({
      entries,
      profile,
      hour: settings.reminderHour,
      frozen: game.frozenDays,
      off: settings.notifyOff,
      chestsWaiting: game.chests?.length ?? 0,
      playedToday: game.playedDay === today || game.claims.some((c) => c.day === today && c.questId === ARCADE_CLAIM),
    }).catch((err) => console.warn('[reminders] schedule failed', err));
  },
  /** Switches one kind of notification (meals, water, …) on or off. */
  setNotifyKind(kind: string, on: boolean) {
    set((s) => {
      const off = new Set(s.settings.notifyOff ?? []);
      if (on) off.delete(kind);
      else off.add(kind);
      return { settings: { ...s.settings, notifyOff: [...off] } };
    });
    return actions.refreshReminder();
  },
  /** Turns Apple Health sync on (asking permission) and pulls the last 7 days. */
  async connectHealth() {
    if (!(await connectHealth())) return false;
    set((s) => ({ settings: { ...s.settings, health: { ...s.settings.health, on: true } } }));
    await actions.syncHealth();
    return true;
  },
  disconnectHealth() {
    set((s) => ({ settings: { ...s.settings, health: { ...s.settings.health, on: false } } }));
  },
  /** Imports new Health workouts, weigh-ins and sleep since the last sync (first sync: 7 days). Returns how many. */
  /** Imports new Apple Health data; resolves to the number imported, or null if Health couldn't be read. */
  async syncHealth(): Promise<number | null> {
    const h = state.settings.health;
    if (!h?.on || !healthAvailable()) return 0;
    // Launch, HQ and coming back to the app can all ask at once; one sync at a time.
    if (healthSyncing) return healthSyncing;
    healthSyncing = runHealthSync().finally(() => (healthSyncing = null));
    return healthSyncing;
  },
  setCoachVoice(coachVoice: string) {
    set((s) => ({ settings: { ...s.settings, coachVoice } }));
  },
  speakMessage(id: string, text: string) {
    const { apiKey, coachVoice } = state.settings;
    return speak(id, text, { apiKey, voice: coachVoice, style: personaById(state.profile.persona).speech });
  },
  addEntry(e: Omit<Entry, 'id' | 'createdAt'> & { createdAt?: number }, opts: { skipPlanMatch?: boolean } = {}) {
    const entry: Entry = { ...e, id: uid(), createdAt: e.createdAt ?? Date.now() };
    const before = logXp(state.entries);
    set((s) => ({ entries: [entry, ...s.entries].sort((a, b) => b.createdAt - a.createdAt) }));
    pushReward(logXp(state.entries) - before, 0, t('rewards.logged'));
    // Today's logged now, so tonight's reminder becomes a check-in instead of a streak warning.
    actions.refreshReminder();
    // The latest weigh-in keeps the profile weight current so calorie math follows; a back-dated one doesn't.
    if (entry.kind === 'weight' && entry.weightKg && latestWeight(state.entries)?.id === entry.id) actions.updateProfile({ weightKg: entry.weightKg });
    if (!opts.skipPlanMatch) matchToPlans(entry, true);
    return entry;
  },
  removeEntry(id: string) {
    const removed = state.entries.find((e) => e.id === id);
    if (removed?.photo) deleteJournalPhoto(removed.photo);
    // A deleted Health import stays deleted: the next sync would otherwise bring it back.
    const healthId = removed?.healthId;
    if (healthId && state.settings.health) {
      set((s) => ({ settings: { ...s.settings, health: { ...s.settings.health!, ignored: [...(s.settings.health!.ignored ?? []), healthId].slice(-300) } } }));
    }
    set((s) => ({ entries: s.entries.filter((e) => e.id !== id) }));
    // Deleting the latest weigh-in falls back to the one before it.
    if (removed?.kind === 'weight') {
      const prev = latestWeight(state.entries);
      if (prev?.weightKg) actions.updateProfile({ weightKg: prev.weightKg });
    }
  },
  /** Moves an entry by whole days (e.g. a weigh-in logged on the wrong day), keeping its time of day. */
  moveEntryDays(id: string, days: number) {
    const e = state.entries.find((x) => x.id === id);
    if (!e) return;
    const d = new Date(e.createdAt);
    d.setDate(d.getDate() + days);
    if (dayKey(d) > dayKey(Date.now())) return;
    // Moving onto today from a later time of day lands at "now", never in the future.
    const at = Math.min(d.getTime(), Date.now());
    set((s) => ({ entries: s.entries.map((x) => (x.id === id ? { ...x, createdAt: at } : x)).sort((a, b) => b.createdAt - a.createdAt) }));
    const latest = latestWeight(state.entries);
    if (e.kind === 'weight' && latest?.weightKg) actions.updateProfile({ weightKg: latest.weightKg });
  },
  updateEntry(id: string, patch: Partial<Entry>) {
    set((s) => ({ entries: s.entries.map((e) => (e.id === id ? { ...e, ...patch } : e)) }));
  },
  setGoal(goal: Profile['goal'], pace: Profile['pace'] = state.profile.pace, note?: string) {
    // A new goal starts from fresh recommendations.
    actions.updateProfile({ goal, pace, custom: undefined, planNote: note });
  },
  applyPlan(plan: PlanResult) {
    const rec = recommendedTargets({ ...state.profile, goal: plan.goal, pace: plan.pace });
    const custom: Partial<Targets> = {};
    (Object.keys(plan.targets) as (keyof Targets)[]).forEach((k) => {
      if (plan.targets[k] !== rec[k]) custom[k] = plan.targets[k];
    });
    actions.updateProfile({
      goal: plan.goal,
      pace: plan.pace,
      custom: Object.keys(custom).length ? custom : undefined,
      planNote: plan.summary,
    });
  },
  setTarget(key: keyof Targets, value: number | undefined) {
    const custom = { ...state.profile.custom };
    if (value == null) delete custom[key];
    else custom[key] = value;
    actions.updateProfile({ custom: Object.keys(custom).length ? custom : undefined });
  },
  resetTargets() {
    actions.updateProfile({ custom: undefined, planNote: undefined });
  },
  /** Collects a finished quest; clearing all three also pays the perfect-day bonus. */
  claimQuest(day: string, questId: string) {
    const { entries, profile, game } = state;
    const quests = dailyQuests(entries, macroTargets(profile), day, game.claims);
    const q = quests.find((x) => x.id === questId);
    if (!q || !q.done || q.claimed) return;
    const now = Date.now();
    const claims: Claim[] = [{ day, questId, xp: q.xp, tokens: q.tokens, at: now }];
    const perfect = quests.every((x) => x.claimed || x.id === questId);
    if (perfect) claims.push({ day, questId: PERFECT_DAY, ...PERFECT_REWARD, at: now });
    set((s) => ({ game: { ...s.game, claims: [...s.game.claims, ...claims] } }));
    const xp = claims.reduce((n, c) => n + c.xp, 0);
    const tokens = claims.reduce((n, c) => n + c.tokens, 0);
    pushReward(xp, tokens, perfect ? t('rewards.perfectDay') : q.title);
    celebrate();
  },
  /** Buys an arcade game with tokens. Returns false when it can't be afforded. */
  unlockGame(id: GameId) {
    const g = gameById(id);
    const { game } = state;
    if (!g || isUnlocked(id, game.unlocked)) return true;
    if (tokenBalance(game) < g.price) return false;
    set((s) => ({ game: { ...s.game, unlocked: [...s.game.unlocked, id] } }));
    celebrate();
    return true;
  },
  /** A full minute in the arcade pays a little XP, once a day. */
  finishGame(day: string) {
    if (state.game.playedDay !== day) set((s) => ({ game: { ...s.game, playedDay: day } }));
    if (state.game.claims.some((c) => c.day === day && c.questId === ARCADE_CLAIM)) return;
    set((s) => ({ game: { ...s.game, claims: [...s.game.claims, { day, questId: ARCADE_CLAIM, xp: ARCADE_XP, tokens: 0, at: Date.now() }] } }));
    pushReward(ARCADE_XP, 0, t('rewards.chilledOut'));
    celebrate();
  },
  /**
   * Scores a finished Brain Gym run. A win pays tokens and XP (doubled while a Token Doubler is active)
   * and drops a chest, up to the daily caps; a new best score always pays a small bonus.
   */
  finishBrain(id: BrainId, score: number, day: string): RunResult {
    const g = gameById(id)!;
    const { game } = state;
    const now = Date.now();
    const best = game.bests?.[id] ?? 0;
    const newBest = score > best;
    const won = score >= (g.win ?? Infinity);
    const paid = won && winsToday(game.claims, day) < PAID_WINS_PER_DAY;
    const doubled = paid && (game.doubler ?? 0) > 0;
    const tokens = paid ? WIN_TOKENS * (doubled ? 2 : 1) : 0;
    const xp = paid ? WIN_XP : 0;
    const bonus = newBest && best > 0 ? BEST_BONUS : 0;
    const chest = paid && chestsEarnedToday(game.claims, day) < CHESTS_PER_DAY ? chestFor(g, score) : null;
    const claims: Claim[] = [];
    if (paid) claims.push({ day, questId: `brain:${id}:${now}`, xp, tokens, at: now });
    if (bonus) claims.push({ day, questId: `best:${id}:${now}`, xp: 0, tokens: bonus, at: now });
    if (chest) claims.push({ day, questId: `chest-drop:${now}`, xp: 0, tokens: 0, at: now });
    set((s) => ({
      game: {
        ...s.game,
        claims: [...s.game.claims, ...claims],
        bests: newBest ? { ...s.game.bests, [id]: score } : s.game.bests,
        doubler: doubled ? (s.game.doubler ?? 1) - 1 : s.game.doubler,
        chests: chest ? [...(s.game.chests ?? []), { id: `c${now}`, tier: chest, from: id, at: now }] : s.game.chests,
        playedDay: day,
      },
    }));
    if (won || newBest) celebrate();
    return { game: id, score, won, newBest, tokens: tokens + bonus, xp, chest, chestId: chest ? `c${now}` : undefined, doubled, capped: won && !paid };
  },
  /** The free chest for playing any arcade game today. Returns false if it isn't ready or was taken. */
  claimDailyChest(day: string) {
    const { game } = state;
    const id = dailyChestId(day);
    const played = game.playedDay === day || game.claims.some((c) => c.day === day && c.questId === ARCADE_CLAIM);
    if (!played || game.claims.some((c) => c.questId === id)) return false;
    const now = Date.now();
    set((s) => ({
      game: {
        ...s.game,
        claims: [...s.game.claims, { day, questId: id, xp: 0, tokens: 0, at: now }],
        chests: [...(s.game.chests ?? []), { id: `c${now}`, tier: 'wood', from: 'daily', at: now }],
      },
    }));
    return true;
  },
  /** Opens a chest: rolls its loot and applies it. Returns what was inside, or null if there's no such chest. */
  openChest(chestId: string, day: string): Loot[] | null {
    const { game } = state;
    const chest = game.chests?.find((c) => c.id === chestId);
    if (!chest) return null;
    const loot = rollLoot(chest.tier, game);
    const tokens = loot.reduce((n, l) => n + (l.kind === 'tokens' ? l.amount : 0), 0);
    const xp = loot.reduce((n, l) => n + (l.kind === 'xp' ? l.amount : 0), 0);
    const freeze = loot.some((l) => l.kind === 'freeze');
    const doubler = loot.reduce((n, l) => n + (l.kind === 'doubler' ? l.wins : 0), 0);
    const gifts = loot.flatMap((l) =>
      l.kind === 'game' ? [`gift:${l.game.id}`] : l.kind === 'avatar' ? [avatarGiftId(l.avatar.id)] : l.kind === 'track' ? [trackUnlockId(l.track.id)] : l.kind === 'icon' ? [appIconUnlockId(l.icon.id)] : l.kind === 'wall' ? [wallUnlockId(l.wall.id)] : [],
    );
    set((s) => ({
      game: {
        ...s.game,
        chests: (s.game.chests ?? []).filter((c) => c.id !== chestId),
        claims: [...s.game.claims, { day, questId: `chest:${chestId}`, xp, tokens, at: Date.now() }],
        freezes: freeze ? Math.min(MAX_FREEZES, (s.game.freezes ?? 0) + 1) : s.game.freezes,
        doubler: (s.game.doubler ?? 0) + doubler,
        unlocked: [...s.game.unlocked, ...gifts],
      },
    }));
    celebrate();
    playSfx('chest');
    return loot;
  },
  /** Buys a Token Doubler: the next few Brain Gym wins pay double tokens. */
  buyDoubler() {
    const { game } = state;
    if (tokenBalance(game) < SHOP.doubler.price) return false;
    set((s) => ({ game: { ...s.game, doubler: (s.game.doubler ?? 0) + SHOP.doubler.wins, unlocked: [...s.game.unlocked, `doubler:${Date.now()}`] } }));
    celebrate();
    return true;
  },
  /** Buys a chest from the shop. Returns its id so the screen can open it straight away, or null. */
  buyChest(tier: Exclude<ChestTier, 'wood'>) {
    const price = tier === 'gold' ? SHOP.chestGold.price : SHOP.chestSilver.price;
    if (tokenBalance(state.game) < price) return null;
    const now = Date.now();
    const id = `c${now}`;
    set((s) => ({ game: { ...s.game, unlocked: [...s.game.unlocked, `chest-${tier}:${now}`], chests: [...(s.game.chests ?? []), { id, tier, from: 'shop', at: now }] } }));
    return id;
  },
  /**
   * Awards a chest from Squad (a won challenge or a top-3 week), once per `claimId`. Returns the
   * chest's id so the screen can open it straight away, or null if it was already claimed.
   */
  grantChest(tier: ChestTier, claimId: string, from: 'challenge' | 'league') {
    if (state.game.claims.some((c) => c.questId === claimId)) return null;
    const now = Date.now();
    // Several can be granted in the same millisecond (the rewards pop-up claims them together).
    const id = `c${now}${uid()}`;
    set((s) => ({
      game: {
        ...s.game,
        claims: [...s.game.claims, { day: dayKey(now), questId: claimId, xp: 0, tokens: 0, at: now }],
        chests: [...(s.game.chests ?? []), { id, tier, from, at: now }],
      },
    }));
    celebrate();
    playSfx('fanfare');
    return id;
  },
  /** Claims a finished season challenge; the last one also pays the season badge. */
  claimSeason(challengeId: string) {
    const s = season(state.entries, state.profile, state.game.claims);
    const c = s.challenges.find((x) => x.id === challengeId);
    if (!c || !c.done || c.claimed) return;
    const now = Date.now();
    const day = `${s.month}-01`;
    const claims: Claim[] = [{ day, questId: `season:${s.month}:${c.id}`, ...SEASON_REWARD, at: now }];
    const allDone = s.challenges.every((x) => x.claimed || x.id === c.id);
    if (allDone && !s.badge) claims.push({ day, questId: `season:${s.month}:badge`, ...SEASON_BADGE_REWARD, at: now });
    set((st) => ({ game: { ...st.game, claims: [...st.game.claims, ...claims] } }));
    pushReward(
      claims.reduce((n, x) => n + x.xp, 0),
      claims.reduce((n, x) => n + x.tokens, 0),
      allDone ? `${s.theme.emoji} SEASON BADGE` : c.title.toUpperCase(),
    );
    celebrate();
  },
  /** Buys one streak freeze with tokens (hold at most MAX_FREEZES). */
  buyFreeze() {
    const { game } = state;
    if ((game.freezes ?? 0) >= MAX_FREEZES || tokenBalance(game) < FREEZE_PRICE) return false;
    set((s) => ({ game: { ...s.game, freezes: (s.game.freezes ?? 0) + 1, unlocked: [...s.game.unlocked, `freeze:${Date.now()}`] } }));
    celebrate();
    return true;
  },
  /**
   * Spends owned freezes on days missed since the last log, so a streak survives a skipped day.
   * Runs on launch and when the day changes. Only gaps ending yesterday are covered, never today.
   */
  applyStreakFreezes() {
    const { game, entries } = state;
    let freezes = game.freezes ?? 0;
    if (!freezes || !entries.length) return;
    const logged = new Set([...loggedDays(entries), ...(game.frozenDays ?? [])]);
    const gap: string[] = [];
    const d = new Date();
    d.setDate(d.getDate() - 1);
    while (!logged.has(dayKey(d)) && gap.length < 7) {
      gap.push(dayKey(d));
      d.setDate(d.getDate() - 1);
    }
    // Only worth it if there's a streak to save behind the gap and enough freezes to bridge it.
    if (!gap.length || !logged.has(dayKey(d)) || gap.length > freezes) return;
    freezes -= gap.length;
    set((s) => ({ game: { ...s.game, freezes, frozenDays: [...(s.game.frozenDays ?? []), ...gap] } }));
    pushReward(0, 0, t('rewards.streakSaved', { count: gap.length }), true);
  },
  async addProgressPhoto(from: 'camera' | 'library') {
    const img = await pickImage(from);
    if (!img) return;
    const id = uid();
    const path = await saveProgressPhoto(img.uri, id);
    set((s) => ({ photos: [...s.photos, { id, path, at: Date.now(), weightKg: s.profile.weightKg }].sort((a, b) => a.at - b.at) }));
  },
  removeProgressPhoto(id: string) {
    const p = state.photos.find((x) => x.id === id);
    if (p) deleteJournalPhoto(p.path);
    set((s) => ({ photos: s.photos.filter((x) => x.id !== id) }));
  },
  async generateMealPlan(span: MealSpan, prefs: string, auto = false) {
    const s = state;
    const plan = await makeMealPlan({ apiKey: s.settings.apiKey, model: s.settings.model, profile: s.profile, entries: s.entries, span, prefs });
    const keys = nextDays(spanDays(span));
    const days = plan.days.slice(0, keys.length).map((d, i) => ({ day: keys[i], meals: d.meals }));
    set({ mealPlan: { days, grocery: plan.grocery, summary: plan.summary, checked: [], eaten: {}, auto, at: Date.now() } });
    // Meals already logged today count toward the new plan.
    state.entries.filter((e) => e.kind === 'meal' && dayKey(e.createdAt) === keys[0]).reverse().forEach((e) => matchToPlans(e, false));
    return plan;
  },
  async generateWorkoutPlan(span: WorkoutSpan, prefs: string, auto = false) {
    const s = state;
    const n = spanDays(span);
    const plan = await makeWorkoutPlan({ apiKey: s.settings.apiKey, model: s.settings.model, profile: s.profile, entries: s.entries, days: n, prefs });
    const keys = nextDays(n);
    const days = plan.days.slice(0, keys.length).map((d, i) => ({ ...d, day: keys[i] }));
    set({ workoutPlan: { days, summary: plan.summary, done: {}, auto, at: Date.now() } });
    state.entries.filter((e) => e.kind === 'exercise' && dayKey(e.createdAt) === keys[0]).forEach((e) => matchToPlans(e, false));
    return plan;
  },
  clearMealPlan() {
    set({ mealPlan: undefined });
  },
  clearWorkoutPlan() {
    set({ workoutPlan: undefined });
  },
  setAutoPlans(on: boolean) {
    set((s) => ({ settings: { ...s.settings, autoPlans: on } }));
    if (on) actions.ensurePlans();
  },
  /**
   * Once a day: finished days are scored against what was logged and dropped from the plans, then
   * today's meal and workout plans are generated if none cover today (unless auto-plans is off).
   */
  async ensurePlans() {
    if (planning) return;
    planning = true;
    try {
      const today = dayKey(Date.now());
      const { mealPlan, workoutPlan } = state;
      const pastDays = new Set([...(mealPlan?.days ?? []), ...(workoutPlan?.days ?? [])].map((d) => d.day).filter((d) => d < today));
      if (pastDays.size) {
        const history = { ...state.planHistory };
        for (const d of pastDays) {
          const r = resultFor(d, mealPlan, workoutPlan);
          if (r) history[d] = r;
        }
        const meals = mealPlan && { ...mealPlan, days: mealPlan.days.filter((d) => d.day >= today) };
        const workouts = workoutPlan && { ...workoutPlan, days: workoutPlan.days.filter((d) => d.day >= today) };
        set({ planHistory: history, mealPlan: meals?.days.length ? meals : undefined, workoutPlan: workouts?.days.length ? workouts : undefined });
      }
      const { settings } = state;
      if (!aiAvailable(settings.apiKey) || settings.autoPlans === false || !state.onboarded) return;
      if (!state.mealPlan?.days.some((d) => d.day === today)) await actions.generateMealPlan('today', '', true).catch((e) => console.warn('[plans] meal', e));
      if (!state.workoutPlan?.days.some((d) => d.day === today)) await actions.generateWorkoutPlan('today', '', true).catch((e) => console.warn('[plans] workout', e));
    } finally {
      planning = false;
    }
  },
  toggleGrocery(item: string) {
    set((s) => {
      if (!s.mealPlan) return {};
      const checked = s.mealPlan.checked.includes(item) ? s.mealPlan.checked.filter((x) => x !== item) : [...s.mealPlan.checked, item];
      return { mealPlan: { ...s.mealPlan, checked } };
    });
  },
  /** Logs a planned meal as eaten now, with its planned nutrition, and ticks it off the plan. */
  logPlannedMeal(day: string, index: number) {
    const m = state.mealPlan?.days.find((d) => d.day === day)?.meals[index];
    if (!m) return;
    const entry = actions.addEntry(
      { kind: 'meal', title: m.name, emoji: m.emoji, nutrition: { calories: m.calories, protein: m.protein, carbs: m.carbs, fat: m.fat }, source: 'quick', note: t('rewards.fromMealPlan') },
      { skipPlanMatch: true },
    );
    markMealEaten(day, index, entry.id);
  },
  /** Logs today's planned workout as done (its duration and estimated burn) and ticks it off. */
  completeWorkout(day: string) {
    const w = state.workoutPlan?.days.find((d) => d.day === day);
    if (!w || w.rest || state.workoutPlan?.done[day]) return;
    const entry = actions.addEntry(
      { kind: 'exercise', title: w.title, emoji: w.emoji || '💪', durationMin: w.durationMin, caloriesBurned: w.estKcal, intensity: w.focus === 'HIIT' ? 'high' : 'moderate', source: 'quick', note: t('rewards.fromWorkoutPlan') },
      { skipPlanMatch: true },
    );
    markWorkoutDone(day, entry.id);
  },
  /** Reloads balance, prices and subscription from Pulse cloud. */
  async refreshAccount() {
    const [credits, costs, subscription] = await Promise.all([fetchBalance(), fetchCosts(), fetchSubscription()]);
    set({ account: { ...state.account, credits: credits ?? state.account.credits, costs: Object.keys(costs).length ? costs : state.account.costs, subscription } });
  },
  async signInWithApple() {
    const { name } = await signInWithApple();
    if (name && !state.profile.name) actions.updateProfile({ name });
    // A fresh device with an empty log picks up the account's backup.
    const backup = await loadBackup();
    if (backup && state.entries.length === 0) actions.restoreBackup(backup.data);
  },
  async signOut() {
    await signOut();
  },
  /** Deletes the cloud account and its data (credits, backup). Local data on this phone stays. */
  async deleteAccount() {
    await deleteAccount();
    set({ account: { costs: state.account.costs } });
  },
  async backupNow() {
    const raw = await AsyncStorage.getItem(DATA_KEY);
    if (raw) await saveBackup(JSON.parse(raw));
    set({ account: { ...state.account, backedUpAt: Date.now() } });
  },
  restoreBackup(data: unknown) {
    const d = data as Record<string, unknown>;
    if (!d || !Array.isArray(d.entries)) return;
    // Signing in during the welcome wizard restores the log and profile but keeps the wizard (and
    // the app tour after it) going, so a returning player on a new phone still gets the guide.
    const restored = state.onboarded ? d : { ...d, onboarded: false };
    AsyncStorage.setItem(DATA_KEY, JSON.stringify(restored))
      .then(() => hydrate())
      .then(() => notifyRestored())
      .catch(() => {});
  },
  /** Meals saved without calories (an incomplete Coach reply) get estimated in the background. */
  async repairMeals() {
    const { settings, entries } = state;
    if (!aiAvailable(settings.apiKey)) return;
    const broken = entries.filter((e) => e.kind === 'meal' && !hasNutrition(e)).slice(0, 10);
    for (const e of broken) {
      try {
        const description = [e.title, e.summary, e.note, e.items?.map((i) => `${i.amount} ${i.name}`).join(', ')].filter(Boolean).join('. ');
        const nutrition = await estimateMeal({ apiKey: settings.apiKey, model: settings.model, description, units: state.profile.units });
        if (nutrition.calories > 0) actions.updateEntry(e.id, { nutrition, weightKg: undefined, waterMl: undefined });
      } catch (err) {
        console.warn('[repair] meal estimate failed', err);
      }
    }
  },
  /** Picks a rank wall as the app background; undefined goes back to following the current rank. */
  /** Picks the app's wall; undefined follows the current rank. */
  setWall(id: WallId | undefined) {
    set((s) => ({ game: { ...s.game, wall: id } }));
  },
  clearReward(id: string) {
    if (state.reward?.id === id) set({ reward: null });
  },
  retry(aiMsgId: string) {
    const input = retryInputs.get(aiMsgId);
    if (!input) return;
    retryInputs.delete(aiMsgId);
    // Drop the failed pair (user message + error) and send again.
    set((s) => {
      const i = s.messages.findIndex((m) => m.id === aiMsgId);
      return { messages: s.messages.filter((_, j) => j !== i && j !== i - 1) };
    });
    return actions.sendToCoach(input);
  },
  clearChat() {
    stopSpeaking();
    set({ messages: [] });
  },
  resetAll() {
    set({ entries: [], messages: [], onboarded: false, profile: defaultProfile, game: { claims: [], unlocked: [], freezes: 0, frozenDays: [], chests: [], doubler: 0, bests: {} }, photos: [], mealPlan: undefined, workoutPlan: undefined, planHistory: {}, reward: null });
  },

  async sendToCoach(input: CoachInput) {
    const s = state;
    const userMsg: ChatMessage = {
      id: uid(),
      role: 'user',
      text: input.text?.trim() || (input.audio ? 'Voice note' : ''),
      imageUri: input.image?.uri,
      isVoice: !!input.audio,
      createdAt: Date.now(),
    };
    const pending: ChatMessage = {
      id: uid(),
      role: 'ai',
      text: '',
      createdAt: Date.now(),
      pending: true,
      pendingKind: input.audio ? 'voice' : input.image ? 'photo' : 'text',
    };
    set({ messages: [...s.messages, userMsg, pending], thinking: true });
    const { apiKey, coachVoice, voiceReplies } = s.settings;
    // Start talking as soon as the first sentence of the reply streams in.
    const style = personaById(s.profile.persona).speech;
    let voice = voiceReplies ? speakStream(pending.id, { apiKey, voice: coachVoice, style }) : null;
    if (!voice) stopSpeaking();

    try {
      const result = await askCoach({
        apiKey: s.settings.apiKey,
        model: s.settings.model,
        profile: s.profile,
        entries: s.entries,
        history: s.messages,
        text: input.text,
        image: input.image,
        audio: input.audio,
        onReply: (reply) => {
          // Still pending (kept out of history and storage) until the whole answer is in.
          set((st) => ({ messages: st.messages.map((m) => (m.id === pending.id ? { ...m, text: reply } : m)) }));
          voice?.update(reply);
        },
        // The connection dropped midway: clear the half answer and start speaking the new one afresh.
        onRestart: () => {
          set((st) => ({ messages: st.messages.map((m) => (m.id === pending.id ? { ...m, text: '' } : m)) }));
          voice?.cancel();
          voice = voiceReplies ? speakStream(pending.id, { apiKey, voice: coachVoice, style }) : null;
        },
      });
      // Remember when replaced entries happened before they're removed, so corrections keep their date.
      const replacedAt = new Map(s.entries.map((e) => [e.id, e.createdAt]));
      result.removeEntryIds.forEach(actions.removeEntry);
      if (result.goalUpdate) actions.setGoal(result.goalUpdate.goal, result.goalUpdate.pace, result.goalUpdate.note);
      const source: Entry['source'] = input.audio ? 'voice' : input.image ? 'photo' : 'text';
      const onlyWorkout = result.entries.filter((e) => e.kind === 'exercise').length === 1;
      const added = result.entries
        .map((e) => fillExercise(e, result.reply, onlyWorkout, state.profile.weightKg))
        .map(cleanEntry)
        .map(fillJournal)
        .map(({ hoursAgo, daysAgo, replacesId, ...e }) =>
        actions.addEntry({
          ...e,
          source,
          hasPhoto: !!input.image,
          createdAt: entryTime(hoursAgo, daysAgo, replacesId ? replacedAt.get(replacesId) : undefined),
        }),
      );
      // Keep the photo with journal moments so the timeline can show it later.
      const img = input.image;
      if (img) {
        for (const e of added.filter((a) => a.kind === 'journal')) {
          saveJournalPhoto(img.uri, e.id)
            .then((photo) => actions.updateEntry(e.id, { photo }))
            .catch((err) => console.warn('[journal] photo save failed', err));
        }
      }
      set((st) => ({
        thinking: false,
        messages: st.messages.map((m) =>
          m.id === pending.id ? { ...m, pending: false, text: result.reply, entryIds: added.map((a) => a.id) } : m,
        ),
      }));
      voice?.finish(result.reply);
      if (added.some((e) => e.kind === 'meal' && !hasNutrition(e))) actions.repairMeals();
      return added;
    } catch (err) {
      voice?.cancel();
      const retryable = !(err instanceof AiError) || err.retryable;
      if (retryable) retryInputs.set(pending.id, input);
      set((st) => ({
        thinking: false,
        messages: st.messages.map((m) =>
          m.id === pending.id ? { ...m, pending: false, error: true, retryable, needsCredits: err instanceof AiError && err.code === 'credits', text: (err as Error).message } : m,
        ),
      }));
      return [];
    }
  },
};
