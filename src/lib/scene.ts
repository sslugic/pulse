import type { IconName } from '@/components/icon';
import { C } from '@/constants/theme';

import type { Entry } from './types';
import type { WallId } from './walls';

// Elements a journal moment can be drawn with. The Coach picks from these names; older entries fall
// back to keyword matching on the summary and tags.
export const SCENE_ELEMENTS = {
  sun: { icon: 'sun', color: C.yellow, words: ['sun', 'sunny', 'summer', 'hot', 'warm'] },
  beach: { icon: 'beach', color: C.orange, words: ['beach', 'sand', 'seaside', 'coast'] },
  waves: { icon: 'waves', color: C.cyan, words: ['sea', 'ocean', 'lake', 'river', 'waves', 'surf'] },
  swim: { icon: 'swim', color: C.cyan, words: ['swim', 'swam', 'pool'] },
  people: { icon: 'people', color: C.pink, words: ['friends', 'people', 'met', 'party', 'crew', 'team', 'colleagues'] },
  family: { icon: 'family', color: C.pink, words: ['family', 'kids', 'son', 'daughter', 'mom', 'dad', 'parents', 'wife', 'husband', 'partner'] },
  beer: { icon: 'beer', color: C.yellow, words: ['beer', 'pint', 'pub', 'brewery'] },
  drink: { icon: 'drink', color: C.violet, words: ['wine', 'cocktail', 'drinks', 'bar'] },
  coffee: { icon: 'coffee', color: C.orange, words: ['coffee', 'cafe', 'espresso', 'latte', 'tea'] },
  food: { icon: 'fork', color: C.orange, words: ['lunch', 'dinner', 'breakfast', 'brunch', 'restaurant', 'ate', 'meal', 'bbq'] },
  run: { icon: 'figure', color: C.lime, words: ['run', 'ran', 'jog', 'jogging', 'marathon'] },
  gym: { icon: 'dumbbell', color: C.lime, words: ['gym', 'lift', 'lifting', 'weights', 'workout', 'training'] },
  walk: { icon: 'walk', color: C.lime, words: ['walk', 'walked', 'hike', 'hiking', 'stroll'] },
  bike: { icon: 'bike', color: C.lime, words: ['bike', 'cycling', 'cycled', 'ride'] },
  tree: { icon: 'tree', color: C.lime, words: ['park', 'forest', 'garden', 'nature', 'trees'] },
  mountain: { icon: 'mountain', color: C.steelHi, words: ['mountain', 'mountains', 'hills', 'ski', 'snow'] },
  travel: { icon: 'plane', color: C.cyan, words: ['travel', 'trip', 'flight', 'flew', 'airport', 'vacation', 'holiday'] },
  car: { icon: 'car', color: C.steelHi, words: ['drive', 'drove', 'car', 'road trip', 'traffic', 'commute'] },
  city: { icon: 'city', color: C.steelHi, words: ['city', 'downtown', 'town', 'street'] },
  home: { icon: 'home', color: C.orange, words: ['home', 'house', 'couch', 'relaxed at home'] },
  work: { icon: 'work', color: C.blue, words: ['work', 'office', 'meeting', 'deadline', 'boss', 'job'] },
  laptop: { icon: 'laptop', color: C.blue, words: ['laptop', 'coding', 'emails', 'computer'] },
  music: { icon: 'music', color: C.violet, words: ['music', 'concert', 'gig', 'song', 'dance', 'danced'] },
  party: { icon: 'party', color: C.pink, words: ['birthday', 'celebrate', 'celebration', 'wedding', 'party'] },
  movie: { icon: 'film', color: C.violet, words: ['movie', 'film', 'cinema', 'show', 'netflix'] },
  pet: { icon: 'paw', color: C.orange, words: ['dog', 'cat', 'pet', 'puppy'] },
  shopping: { icon: 'cart', color: C.yellow, words: ['shopping', 'shop', 'groceries', 'mall'] },
  rain: { icon: 'rain', color: C.blue, words: ['rain', 'rainy', 'storm', 'wet'] },
  sleep: { icon: 'bed', color: C.violet, words: ['sleep', 'slept', 'nap', 'tired', 'rest'] },
  sick: { icon: 'sick', color: C.danger, words: ['sick', 'ill', 'injury', 'injured', 'sore', 'pain', 'headache'] },
  stress: { icon: 'warning', color: C.danger, words: ['stress', 'stressed', 'anxious', 'overwhelmed', 'fight', 'argument'] },
  love: { icon: 'heart', color: C.pink, words: ['love', 'date', 'romantic', 'hug'] },
  gift: { icon: 'gift', color: C.pink, words: ['gift', 'present'] },
  star: { icon: 'star', color: C.yellow, words: ['amazing', 'awesome', 'best', 'great day', 'win', 'proud'] },
} as const satisfies Record<string, { icon: IconName; color: string; words: readonly string[] }>;

export type SceneElement = keyof typeof SCENE_ELEMENTS;
export const SCENE_NAMES = Object.keys(SCENE_ELEMENTS) as SceneElement[];

const isElement = (s: string): s is SceneElement => s in SCENE_ELEMENTS;

/** Up to 4 elements to draw for a journal entry: the Coach's picks, else words found in what was said. */
export function sceneFor(e: Entry): SceneElement[] {
  const picked = (e.scene ?? []).filter(isElement);
  if (picked.length) return [...new Set(picked)].slice(0, 4);
  const text = ` ${[e.summary, e.title, ...(e.tags ?? [])].filter(Boolean).join(' ').toLowerCase()} `;
  const found = SCENE_NAMES.filter((k) => SCENE_ELEMENTS[k].words.some((w) => new RegExp(`\\b${w}\\b`).test(text)));
  if (found.length) return found.slice(0, 4);
  return e.sleepHours != null ? ['sleep'] : ['star'];
}

// The illustrated wall behind each kind of moment (src/lib/walls.ts). A wall whose art isn't drawn
// yet falls back to the next choice, then to the plain sky.
export const SCENE_WALLS: Record<SceneElement, WallId[]> = {
  sun: ['rooftop', 'boardwalk'],
  beach: ['boardwalk', 'rooftop'],
  waves: ['boardwalk', 'bridge'],
  swim: ['boardwalk', 'pool'],
  people: ['hydrant', 'club'],
  family: ['hydrant', 'boardwalk'],
  beer: ['club', 'diner'],
  drink: ['club', 'square'],
  coffee: ['diner', 'bodega'],
  food: ['diner', 'bodega'],
  run: ['court', 'bridge'],
  gym: ['alley', 'hall'],
  walk: ['hydrant', 'court'],
  bike: ['court', 'bridge'],
  tree: ['rooftop', 'court'],
  mountain: ['rooftop', 'tower'],
  travel: ['square', 'nightTrain'],
  car: ['highway', 'square'],
  city: ['square', 'rooftop'],
  home: ['hydrant', 'tower'],
  work: ['tower', 'square'],
  laptop: ['tower', 'video'],
  music: ['club', 'rink'],
  party: ['club', 'rink'],
  movie: ['video', 'square'],
  pet: ['hydrant', 'court'],
  shopping: ['bodega', 'square'],
  rain: ['square', 'hydrant'],
  sleep: ['platform', 'hydrant'],
  sick: ['platform', 'alley'],
  stress: ['nightTrain', 'platform'],
  love: ['boardwalk', 'rooftop'],
  gift: ['arcade', 'club'],
  star: ['hall', 'arcade'],
};

/** Sky colors for a moment, from how the day felt. */
export function skyFor(mood?: number): readonly [string, string] {
  if (mood == null) return ['#2B2F45', '#16181A'];
  if (mood >= 4.5) return ['#FF9A3D', '#7A2FE0'];
  if (mood >= 3.5) return ['#38D6FF', '#3E3A8C'];
  if (mood >= 2.5) return ['#5E6A8A', '#23272B'];
  return ['#3B3550', '#121316'];
}
