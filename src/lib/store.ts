import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';

import { AiError, askCoach, DEFAULT_MODEL, DEFAULT_VOICE, makeMealPlan, type Media, type MealPlan, type PlanResult } from './gemini';
import { deleteJournalPhoto, pickImage, saveJournalPhoto, saveProgressPhoto } from './media';
import { celebrate } from './haptics';
import { connectHealth, healthAvailable, pullHealth } from './health';
import { cancelReminders, enableReminders, scheduleReminder } from './reminders';
import { dayKey, macroTargets, recommendedTargets } from './nutrition';
import { ARCADE_CLAIM, ARCADE_XP, FREEZE_PRICE, MAX_FREEZES, gameById, isUnlocked, type GameId } from './arcade';
import { season, SEASON_BADGE_REWARD, SEASON_REWARD } from './seasons';
import { isPersonaUnlocked, personaById, personaUnlockId, type PersonaId } from './personas';
import { dailyQuests, PERFECT_DAY, PERFECT_REWARD, tokenBalance, type Claim, type GameState } from './quests';
import { logXp } from './rank';
import type { ChatMessage, Entry, Profile, Settings, Targets } from './types';
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
  /** Private body-progress photos (paths relative to documents), oldest first. */
  photos: { id: string; path: string; at: number; weightKg?: number }[];
  /** Last AI meal plan and which grocery items are ticked; persisted. */
  mealPlan?: { plan: MealPlan; span: 'today' | '3days'; at: number; checked: string[]; logged: string[] };
  /** Latest "+XP" pop-up; not persisted. */
  reward: Reward | null;
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
  settings: { apiKey: process.env.EXPO_PUBLIC_GEMINI_API_KEY ?? '', model: DEFAULT_MODEL, voiceReplies: true, coachVoice: DEFAULT_VOICE },
  thinking: false,
  game: { claims: [], unlocked: [] },
  photos: [],
  reward: null,
};

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function set(patch: Partial<State> | ((s: State) => Partial<State>)) {
  state = { ...state, ...(typeof patch === 'function' ? patch(state) : patch) };
  emit();
  schedulePersist();
}

let persistTimer: ReturnType<typeof setTimeout> | undefined;
function schedulePersist() {
  if (!state.ready) return;
  clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    const { onboarded, profile, entries, messages, settings, game, mealPlan, photos } = state;
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
      health: settings.health,
      game,
      mealPlan,
      photos,
    };
    AsyncStorage.setItem(DATA_KEY, JSON.stringify(data)).catch(() => {});
  }, 250);
}

// The API key stays out of AsyncStorage on device: Keychain via SecureStore.
const secret = {
  get: () => (Platform.OS === 'web' ? AsyncStorage.getItem(KEY_KEY) : SecureStore.getItemAsync(KEY_KEY)),
  set: (v: string) => (Platform.OS === 'web' ? AsyncStorage.setItem(KEY_KEY, v) : SecureStore.setItemAsync(KEY_KEY, v)),
};

export async function hydrate() {
  try {
    const [raw, key] = await Promise.all([AsyncStorage.getItem(DATA_KEY), secret.get().catch(() => null)]);
    const data = raw ? JSON.parse(raw) : {};
    state = {
      ...state,
      onboarded: !!data.onboarded,
      profile: migrateProfile(data.profile),
      entries: data.entries ?? [],
      messages: data.messages ?? [],
      settings: {
        apiKey: key || state.settings.apiKey,
        model: data.model || DEFAULT_MODEL,
        voiceReplies: data.voiceReplies ?? true,
        coachVoice: data.coachVoice || DEFAULT_VOICE,
        reminderHour: data.reminderHour,
        health: data.health,
      },
      mealPlan: data.mealPlan,
      photos: data.photos ?? [],
      game: { claims: data.game?.claims ?? [], unlocked: data.game?.unlocked ?? [], wall: data.game?.wall, freezes: data.game?.freezes ?? 0, frozenDays: data.game?.frozenDays ?? [] },
    };
  } catch {
    // corrupt storage: start fresh rather than crash
  }
  state = { ...state, ready: true };
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

/** Newest weigh-in by date (entries are kept newest first). */
const latestWeight = (entries: Entry[]) => entries.find((e) => e.kind === 'weight' && e.weightKg);

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

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

export const actions = {
  completeOnboarding(profile: Partial<Profile>, apiKey?: string) {
    set((s) => ({ onboarded: true, profile: { ...s.profile, ...profile } }));
    if (apiKey !== undefined) actions.setApiKey(apiKey);
  },
  updateProfile(patch: Partial<Profile>) {
    set((s) => ({ profile: { ...s.profile, ...patch } }));
  },
  setApiKey(apiKey: string) {
    set((s) => ({ settings: { ...s.settings, apiKey: apiKey.trim() } }));
    secret.set(apiKey.trim()).catch(() => {});
  },
  setModel(model: string) {
    set((s) => ({ settings: { ...s.settings, model: model.trim() || DEFAULT_MODEL } }));
  },
  setVoiceReplies(voiceReplies: boolean) {
    set((s) => ({ settings: { ...s.settings, voiceReplies } }));
    if (!voiceReplies) stopSpeaking();
  },
  /** Switches coach personality and its matching voice (unless the offline voice is chosen). Buys it with tokens if needed. */
  choosePersona(id: PersonaId) {
    const p = personaById(id);
    const { game } = state;
    if (!isPersonaUnlocked(id, game.unlocked)) {
      if (tokenBalance(game) < p.price) return false;
      set((s) => ({ game: { ...s.game, unlocked: [...s.game.unlocked, personaUnlockId(id)] } }));
      celebrate();
    }
    actions.updateProfile({ persona: id });
    if (state.settings.coachVoice !== 'device') actions.setCoachVoice(p.voice);
    actions.speakMessage('voice-preview', p.sample);
    return true;
  },
  /** Turns the evening streak reminder on at `hour`, or off with undefined. Asks for permission first. */
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
    const { settings, entries, game } = state;
    if (settings.reminderHour == null) return Promise.resolve();
    return scheduleReminder(entries, settings.reminderHour, game.frozenDays).catch(() => {});
  },
  /** Turns Apple Health sync on (asking permission) and pulls the last 7 days. */
  async connectHealth() {
    if (!(await connectHealth())) return false;
    set((s) => ({ settings: { ...s.settings, health: { on: true, lastSync: s.settings.health?.lastSync } } }));
    await actions.syncHealth();
    return true;
  },
  disconnectHealth() {
    set((s) => ({ settings: { ...s.settings, health: { on: false, lastSync: s.settings.health?.lastSync } } }));
  },
  /** Imports new Health workouts, weigh-ins and sleep since the last sync (first sync: 7 days). Returns how many. */
  async syncHealth() {
    const h = state.settings.health;
    if (!h?.on || !healthAvailable()) return 0;
    const since = new Date(h.lastSync ? h.lastSync - 6 * 3600_000 : Date.now() - 7 * 86400_000);
    const known = new Set(state.entries.flatMap((e) => (e.healthId ? [e.healthId] : [])));
    try {
      const fresh = await pullHealth(since, known);
      fresh.sort((a, b) => a.createdAt - b.createdAt).forEach((e) => actions.addEntry(e));
      set((s) => ({ settings: { ...s.settings, health: { on: true, lastSync: Date.now() } } }));
      return fresh.length;
    } catch (err) {
      console.warn('[health] sync failed', err);
      return 0;
    }
  },
  setCoachVoice(coachVoice: string) {
    set((s) => ({ settings: { ...s.settings, coachVoice } }));
  },
  speakMessage(id: string, text: string) {
    const { apiKey, coachVoice } = state.settings;
    return speak(id, text, { apiKey, voice: coachVoice });
  },
  addEntry(e: Omit<Entry, 'id' | 'createdAt'> & { createdAt?: number }) {
    const entry: Entry = { ...e, id: uid(), createdAt: e.createdAt ?? Date.now() };
    const before = logXp(state.entries);
    set((s) => ({ entries: [entry, ...s.entries].sort((a, b) => b.createdAt - a.createdAt) }));
    pushReward(logXp(state.entries) - before, 0, 'LOGGED');
    // Today's logged now, so tonight's reminder moves to tomorrow.
    actions.refreshReminder();
    // The latest weigh-in keeps the profile weight current so calorie math follows; a back-dated one doesn't.
    if (entry.kind === 'weight' && entry.weightKg && latestWeight(state.entries)?.id === entry.id) actions.updateProfile({ weightKg: entry.weightKg });
    return entry;
  },
  removeEntry(id: string) {
    const removed = state.entries.find((e) => e.id === id);
    if (removed?.photo) deleteJournalPhoto(removed.photo);
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
    pushReward(xp, tokens, perfect ? 'PERFECT DAY' : q.title);
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
    if (state.game.claims.some((c) => c.day === day && c.questId === ARCADE_CLAIM)) return;
    set((s) => ({ game: { ...s.game, claims: [...s.game.claims, { day, questId: ARCADE_CLAIM, xp: ARCADE_XP, tokens: 0, at: Date.now() }] } }));
    pushReward(ARCADE_XP, 0, 'CHILLED OUT');
    celebrate();
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
    const logged = new Set([...entries.map((e) => dayKey(e.createdAt)), ...(game.frozenDays ?? [])]);
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
    pushReward(0, 0, `🧊 STREAK SAVED · ${gap.length} FREEZE${gap.length > 1 ? 'S' : ''} USED`, true);
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
  async generateMealPlan(span: 'today' | '3days', prefs: string) {
    const s = state;
    const plan = await makeMealPlan({ apiKey: s.settings.apiKey, model: s.settings.model, profile: s.profile, entries: s.entries, span, prefs });
    set({ mealPlan: { plan, span, at: Date.now(), checked: [], logged: [] } });
    return plan;
  },
  toggleGrocery(item: string) {
    set((s) => {
      if (!s.mealPlan) return {};
      const checked = s.mealPlan.checked.includes(item) ? s.mealPlan.checked.filter((x) => x !== item) : [...s.mealPlan.checked, item];
      return { mealPlan: { ...s.mealPlan, checked } };
    });
  },
  /** Logs a planned meal as eaten now, with its planned nutrition. */
  logPlannedMeal(key: string, m: { name: string; emoji: string; calories: number; protein: number; carbs: number; fat: number }) {
    actions.addEntry({ kind: 'meal', title: m.name, emoji: m.emoji, nutrition: { calories: m.calories, protein: m.protein, carbs: m.carbs, fat: m.fat }, source: 'quick', note: 'From your meal plan' });
    set((s) => (s.mealPlan ? { mealPlan: { ...s.mealPlan, logged: [...s.mealPlan.logged, key] } } : {}));
  },
  /** Picks a rank wall as the app background; undefined goes back to following the current rank. */
  setWall(level: number | undefined) {
    set((s) => ({ game: { ...s.game, wall: level } }));
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
    set({ entries: [], messages: [], onboarded: false, profile: defaultProfile, game: { claims: [], unlocked: [], freezes: 0, frozenDays: [] }, photos: [], mealPlan: undefined, reward: null });
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
    const voice = voiceReplies ? speakStream(pending.id, { apiKey, voice: coachVoice }) : null;
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
      });
      // Remember when replaced entries happened before they're removed, so corrections keep their date.
      const replacedAt = new Map(s.entries.map((e) => [e.id, e.createdAt]));
      result.removeEntryIds.forEach(actions.removeEntry);
      if (result.goalUpdate) actions.setGoal(result.goalUpdate.goal, result.goalUpdate.pace, result.goalUpdate.note);
      const source: Entry['source'] = input.audio ? 'voice' : input.image ? 'photo' : 'text';
      const added = result.entries.map(fillJournal).map(({ hoursAgo, daysAgo, replacesId, ...e }) =>
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
      return added;
    } catch (err) {
      voice?.cancel();
      const retryable = !(err instanceof AiError) || err.retryable;
      if (retryable) retryInputs.set(pending.id, input);
      set((st) => ({
        thinking: false,
        messages: st.messages.map((m) =>
          m.id === pending.id ? { ...m, pending: false, error: true, retryable, text: (err as Error).message } : m,
        ),
      }));
      return [];
    }
  },
};
