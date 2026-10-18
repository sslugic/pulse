import type { Entry, Goal, Pace, Profile, Targets } from './types';

const ACTIVITY_FACTOR = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, athlete: 1.9 };

// Energy balance as a fraction of maintenance, by goal and pace.
const ENERGY: Record<Goal, Record<Pace, number>> = {
  lose: { gentle: -0.15, standard: -0.2, aggressive: -0.25 },
  recomp: { gentle: -0.05, standard: -0.1, aggressive: -0.15 },
  maintain: { gentle: 0, standard: 0, aggressive: 0 },
  gain: { gentle: 0.05, standard: 0.1, aggressive: 0.15 },
};

// Protein in g per kg of reference body weight.
const PROTEIN: Record<Goal, number> = { lose: 2.2, recomp: 2.2, maintain: 1.6, gain: 1.8 };

export const GOAL_INFO: Record<Goal, { label: string; blurb: string }> = {
  lose: { label: 'Lose fat', blurb: 'Steady deficit, high protein to keep muscle.' },
  recomp: { label: 'Build muscle & lose fat', blurb: 'Small deficit, very high protein, lift 3–5×/week.' },
  maintain: { label: 'Maintain', blurb: 'Eat at maintenance and keep performance up.' },
  gain: { label: 'Build muscle', blurb: 'Lean surplus to grow with minimal fat gain.' },
};

export const PACE_INFO: Record<Pace, string> = { gentle: 'Gentle', standard: 'Standard', aggressive: 'Aggressive' };

// Mifflin-St Jeor BMR
export function bmr(p: Profile) {
  const base = 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age;
  return p.sex === 'male' ? base + 5 : base - 161;
}

export const tdee = (p: Profile) => bmr(p) * ACTIVITY_FACTOR[p.activity];

export const bmi = (p: Profile) => p.weightKg / (p.heightCm / 100) ** 2;

/** Protein is dosed on a reference weight so it doesn't balloon at higher body fat (caps at BMI 25). */
function referenceWeight(p: Profile) {
  const capped = 25 * (p.heightCm / 100) ** 2;
  return bmi(p) > 27 ? (p.weightKg + capped) / 2 : p.weightKg;
}

const round = (n: number, to: number) => Math.round(n / to) * to;

export function recommendedTargets(p: Profile): Targets {
  const pace = p.pace ?? 'standard';
  const floor = p.sex === 'male' ? 1500 : 1200;
  const calories = Math.max(floor, round(tdee(p) * (1 + ENERGY[p.goal][pace]), 10));
  const protein = round(referenceWeight(p) * PROTEIN[p.goal] * (pace === 'aggressive' && p.goal !== 'gain' ? 1.1 : 1), 5);
  const fat = round(Math.max((calories * 0.25) / 9, p.weightKg * 0.6), 5);
  const carbs = Math.max(50, round((calories - protein * 4 - fat * 9) / 4, 5));
  return { calories, protein, carbs, fat, fiber: round((calories / 1000) * 14, 1), waterMl: round(p.weightKg * 35, 100) };
}

/** Recommended targets with the user's edits layered on; carbs fill the gap when calories change. */
export function targets(p: Profile): Targets {
  const rec = recommendedTargets(p);
  const c = p.custom ?? {};
  const t = { ...rec, ...c };
  if (c.carbs == null && (c.calories != null || c.protein != null || c.fat != null)) {
    t.carbs = Math.max(0, round((t.calories - t.protein * 4 - t.fat * 9) / 4, 5));
  }
  return t;
}

export const calorieTarget = (p: Profile) => targets(p).calories;
export const macroTargets = targets;

export const dayKey = (t: number | Date) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export interface DaySummary {
  key: string;
  eaten: number;
  burned: number;
  protein: number;
  carbs: number;
  fat: number;
  water: number;
  meals: number;
  workouts: number;
  activeMin: number;
}

export function summarize(entries: Entry[], key: string): DaySummary {
  const s: DaySummary = { key, eaten: 0, burned: 0, protein: 0, carbs: 0, fat: 0, water: 0, meals: 0, workouts: 0, activeMin: 0 };
  for (const e of entries) {
    if (dayKey(e.createdAt) !== key) continue;
    if (e.kind === 'meal' && e.nutrition) {
      s.eaten += e.nutrition.calories;
      s.protein += e.nutrition.protein;
      s.carbs += e.nutrition.carbs;
      s.fat += e.nutrition.fat;
      s.meals++;
    } else if (e.kind === 'exercise') {
      s.burned += e.caloriesBurned ?? 0;
      s.activeMin += e.durationMin ?? 0;
      s.workouts++;
    } else if (e.kind === 'water') {
      s.water += e.waterMl ?? 0;
    }
  }
  return s;
}

export function lastNDays(n: number, from = new Date()) {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(from);
    d.setDate(d.getDate() - i);
    out.push(dayKey(d));
  }
  return out;
}

export function streak(entries: Entry[]) {
  const days = new Set(entries.map((e) => dayKey(e.createdAt)));
  let n = 0;
  const d = new Date();
  if (!days.has(dayKey(d))) d.setDate(d.getDate() - 1); // today not logged yet doesn't break it
  while (days.has(dayKey(d))) {
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}

export const fmtKg = (kg: number, units: Profile['units']) =>
  units === 'imperial' ? `${Math.round(kg * 2.20462)} lb` : `${Math.round(kg * 10) / 10} kg`;

export const fmtWater = (ml: number, units: Profile['units']) =>
  units === 'imperial' ? `${Math.round(ml / 29.57)} oz` : ml >= 1000 ? `${(ml / 1000).toFixed(1)} L` : `${ml} ml`;
