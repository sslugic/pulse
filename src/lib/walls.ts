import { t } from './i18n';

// The app's walls: 30 illustrated backdrops (made with Figma AI, see scripts/walls/examples-v3) that
// unlock over about a year. One per Street Crew rank (the top rank takes ~320 days), one per best-ever
// streak milestone up to 365 days, three for total days logged, and five rare gold-chest drops. Walls
// whose art isn't drawn yet stay out of the list until it is; a rank without its own wall yet shows
// the closest lower rank's. Chest unlocks live in game.unlocked as wall:<id>.

export type WallId =
  | 'alley' | 'handball' | 'court' | 'bodega' | 'hydrant' | 'rooftop' | 'platform' | 'nightTrain'
  | 'yard' | 'bridge' | 'arcade' | 'club' | 'square' | 'hall' | 'tower'
  | 'underground' | 'video' | 'boardwalk' | 'diner' | 'rink' | 'fireworks' | 'goldLine'
  | 'records' | 'radio' | 'highway'
  | 'laser' | 'pool' | 'skate' | 'carwash' | 'helipad';

export interface WallDef {
  id: WallId;
  name: string;
  art: number;
  /** Street Crew level (1-based) that unlocks it. */
  level?: number;
  /** Best-ever streak, in days, that unlocks it. */
  streak?: number;
  /** Total days with something logged that unlocks it. */
  days?: number;
  /** Only drops from gold chests. */
  chest?: boolean;
}

type Plan = Omit<WallDef, 'name' | 'art'> & { art?: number };

// In unlock order within each kind. `art` is missing for walls still being drawn.
const PLAN: Plan[] = [
  { id: 'alley', level: 1, art: require('@/assets/images/walls/alley.jpg') },
  { id: 'handball', level: 2, art: require('@/assets/images/walls/handball.jpg') },
  { id: 'court', level: 3, art: require('@/assets/images/walls/court.jpg') },
  { id: 'bodega', level: 4, art: require('@/assets/images/walls/bodega.jpg') },
  { id: 'hydrant', level: 5, art: require('@/assets/images/walls/hydrant.jpg') },
  { id: 'rooftop', level: 6, art: require('@/assets/images/walls/rooftop.jpg') },
  { id: 'platform', level: 7, art: require('@/assets/images/walls/platform.jpg') },
  { id: 'nightTrain', level: 8, art: require('@/assets/images/walls/night-train.jpg') },
  { id: 'yard', level: 9, art: require('@/assets/images/walls/yard.jpg') },
  { id: 'bridge', level: 10, art: require('@/assets/images/walls/bridge.jpg') },
  { id: 'arcade', level: 11, art: require('@/assets/images/walls/arcade.jpg') },
  { id: 'club', level: 12, art: require('@/assets/images/walls/club.jpg') },
  { id: 'square', level: 13, art: require('@/assets/images/walls/square.jpg') },
  { id: 'hall', level: 14, art: require('@/assets/images/walls/hall.jpg') },
  { id: 'tower', level: 15, art: require('@/assets/images/walls/tower.jpg') },
  { id: 'underground', streak: 7, art: require('@/assets/images/walls/underground.jpg') },
  { id: 'video', streak: 14, art: require('@/assets/images/walls/video.jpg') },
  { id: 'boardwalk', streak: 30, art: require('@/assets/images/walls/boardwalk.jpg') },
  { id: 'diner', streak: 60 },
  { id: 'rink', streak: 100 },
  { id: 'fireworks', streak: 180 },
  { id: 'goldLine', streak: 365 },
  { id: 'records', days: 50 },
  { id: 'radio', days: 125 },
  { id: 'highway', days: 250 },
  { id: 'laser', chest: true },
  { id: 'pool', chest: true },
  { id: 'skate', chest: true },
  { id: 'carwash', chest: true },
  { id: 'helipad', chest: true },
];

/** Every wall in the app, in unlock order. */
export const WALLS: WallDef[] = PLAN.filter((w): w is Plan & { art: number } => w.art != null).map((w) => ({ ...w, name: t(`walls.${w.id}`) }));

/** How many walls there will be once all the art is in. */
export const WALL_TOTAL = PLAN.length;

export const wallById = (id: string | undefined) => WALLS.find((w) => w.id === id);

/** The wall a rank brings: its own, or the closest lower rank's while its art is on the way. */
export function rankWall(level: number): WallDef {
  const ranked = WALLS.filter((w) => w.level != null && w.level <= level);
  return ranked[ranked.length - 1] ?? WALLS[0];
}

export const wallUnlockId = (id: WallId) => `wall:${id}`;

export interface WallProgress {
  level: number;
  unlocked: string[];
  bestStreak: number;
  daysLogged: number;
}

export const isWallUnlocked = (w: WallDef, p: WallProgress) =>
  p.unlocked.includes(wallUnlockId(w.id)) ||
  (w.level != null && p.level >= w.level) ||
  (w.streak != null && p.bestStreak >= w.streak) ||
  (w.days != null && p.daysLogged >= w.days);

/** What it takes to unlock a locked wall. */
export function wallHint(w: WallDef, rankName: (level: number) => string) {
  if (w.chest) return t('walls.unlocksChest');
  if (w.streak != null) return t('walls.unlocksStreak', { days: w.streak });
  if (w.days != null) return t('walls.unlocksDays', { days: w.days });
  return t('walls.unlocksAt', { rank: rankName(w.level ?? 1) });
}
