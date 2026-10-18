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
}

export interface Settings {
  apiKey: string;
  model: string;
}
