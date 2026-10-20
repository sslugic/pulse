export type EntryKind = 'meal' | 'exercise' | 'water' | 'weight' | 'journal';

export interface Nutrition {
  calories: number;
  protein: number; // g
  carbs: number; // g
  fat: number; // g
  fiber?: number; // g
  sugar?: number; // g
  sodium?: number; // mg
}

export interface Entry {
  id: string;
  kind: EntryKind;
  title: string;
  emoji: string;
  createdAt: number; // epoch ms
  // meal
  nutrition?: Nutrition;
  items?: { name: string; amount: string; calories: number }[];
  // exercise
  caloriesBurned?: number;
  durationMin?: number;
  intensity?: 'low' | 'moderate' | 'high';
  // water
  waterMl?: number;
  // weight
  weightKg?: number;
  // journal: mood, sleep and what happened today
  mood?: number; // 1 awful .. 5 great
  energy?: number; // 1 drained .. 5 energized
  stress?: number; // 1 calm .. 10 overwhelmed, as judged from what the user said
  sleepHours?: number;
  sleepQuality?: number; // 1 .. 5
  tags?: string[]; // e.g. "work deadline", "sore legs", "travel"
  summary?: string; // the journal note in the user's words, lightly cleaned up
  photo?: string; // journal photo, path relative to the documents directory
  scene?: string[]; // journal: elements to illustrate the moment, from SCENE_NAMES
  healthId?: string; // set when imported from Apple Health, so syncs don't duplicate
  passive?: boolean; // everyday activity from Apple Health: adds calories burned, but isn't a log (no XP, streak or workout)
  note?: string;
  confidence?: number; // 0..1 from the AI
  source: 'text' | 'voice' | 'photo' | 'quick';
  hasPhoto?: boolean;
}

export type Goal = 'lose' | 'recomp' | 'maintain' | 'gain';
export type Pace = 'gentle' | 'standard' | 'aggressive';

export interface Targets {
  calories: number;
  protein: number; // g
  carbs: number; // g
  fat: number; // g
  fiber: number; // g
  waterMl: number;
}
export type Activity = 'sedentary' | 'light' | 'moderate' | 'active' | 'athlete';

export interface Profile {
  name: string;
  sex: 'male' | 'female';
  age: number;
  heightCm: number;
  weightKg: number;
  goal: Goal;
  activity: Activity;
  units: 'metric' | 'imperial';
  pace: Pace;
  /** User or AI edits on top of the recommended targets; missing keys stay automatic. */
  custom?: Partial<Targets>;
  /** Short AI rationale for the current plan. */
  planNote?: string;
  /** Coach personality; see lib/personas. */
  persona?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'ai';
  text: string;
  createdAt: number;
  imageUri?: string;
  isVoice?: boolean;
  entryIds?: string[];
  pending?: boolean;
  pendingKind?: 'voice' | 'photo' | 'text';
  error?: boolean;
  retryable?: boolean;
  /** The reply failed because the account is out of AI credits. */
  needsCredits?: boolean;
}

export interface Settings {
  apiKey: string;
  model: string;
  /** Coach reads its replies out loud. */
  voiceReplies: boolean;
  /** Gemini voice name for the Coach, or 'device' for the built-in offline voice. */
  coachVoice: string;
  /** Hour (0-23) for the evening streak reminder; undefined = reminders off. */
  reminderHour?: number;
  /** Apple Health sync on, and when it last pulled. */
  health?: { on: boolean; lastSync?: number };
  /** Generate today's meal and workout plans automatically each day (default on). */
  autoPlans?: boolean;
  /** Background music (default off; the player turns it on in Crew or the jukebox). */
  music?: boolean;
  /** Reward and chest sounds (default on). */
  sfx?: boolean;
  /** Jukebox track id (default 'brawl'). */
  musicTrack?: string;
  /** Music volume, 0-1 (default 0.5). */
  musicVolume?: number;
}
