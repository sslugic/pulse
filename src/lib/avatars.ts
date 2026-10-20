import { t } from './i18n';

// Profile avatars: 8-bit sprites sprayed inside the graffiti tag ring. The tag (your initial) and a
// couple of sprites are free; most unlock at a Street Crew rank or earlier with XP, like jukebox
// tracks. Reward avatars can't be bought: they only drop from silver and gold chests.

export type AvatarId = 'tag' | 'invader' | 'heart' | 'ghost' | 'cat' | 'mushroom' | 'robot' | 'skull' | 'flame' | 'crown';

export interface AvatarDef {
  id: AvatarId;
  name: string;
  /** Splash colour behind the sprite. */
  band: string;
  /** Pixel rows: '.' is empty, other letters index `colors`. Empty for the tag. */
  sprite: string[];
  colors: Record<string, string>;
  /** Street Crew level (1-based) that unlocks it for free; 0 = reward only. */
  level: number;
  /** XP to unlock it early; 0 when free or reward only. */
  xp: number;
}

const INK = '#0B0B0C';
const CREAM = '#F4F1E8';

export const AVATARS: AvatarDef[] = [
  { id: 'tag', name: t('avatars.tag'), band: '#FF7A1A', sprite: [], colors: {}, level: 1, xp: 0 },
  {
    id: 'invader',
    name: t('avatars.invader'),
    band: '#A267FF',
    sprite: ['..a.....a..', '...a...a...', '..aaaaaaa..', '.aakaaakaa.', 'aaaaaaaaaaa', 'a.aaaaaaa.a', 'a.a.....a.a', '...aa.aa...'],
    colors: { a: '#9CFF2E', k: INK },
    level: 1,
    xp: 0,
  },
  {
    id: 'heart',
    name: t('avatars.heart'),
    band: '#38D6FF',
    sprite: ['.aa.aa.', 'awaaaaa', 'aaaaaaa', '.aaaaa.', '..aaa..', '...a...'],
    colors: { a: '#FF4FA0', w: CREAM },
    level: 1,
    xp: 0,
  },
  {
    id: 'ghost',
    name: t('avatars.ghost'),
    band: '#FFD23F',
    sprite: ['..aaaa..', '.aaaaaa.', 'awwaawwa', 'awkaawka', 'aaaaaaaa', 'aaaaaaaa', 'aaaaaaaa', 'a.aa.aa.'],
    colors: { a: '#FF4141', w: CREAM, k: '#2B5CFF' },
    level: 2,
    xp: 600,
  },
  {
    id: 'cat',
    name: t('avatars.cat'),
    band: '#9CFF2E',
    sprite: ['a......a', 'aa....aa', 'aaaaaaaa', 'akaaaaka', 'aaaaaaaa', 'aaabbaaa', '.aaaaaa.', '..a..a..'],
    colors: { a: '#FF9A3D', k: INK, b: '#FF4FA0' },
    level: 3,
    xp: 1200,
  },
  {
    id: 'mushroom',
    name: t('avatars.mushroom'),
    band: '#38D6FF',
    sprite: ['..aaaa..', '.awwaaa.', 'aaaawwaa', 'awwaaaaa', 'aaaaaaaa', '..wwww..', '..wkwk..', '..wwww..'],
    colors: { a: '#FF4141', w: CREAM, k: INK },
    level: 4,
    xp: 1800,
  },
  {
    id: 'robot',
    name: t('avatars.robot'),
    band: '#FF4FA0',
    sprite: ['...b....', '..aaaa..', '.aaaaaa.', '.akaaka.', '.aaaaaa.', '.abbbba.', '..aaaa..', '.aa..aa.'],
    colors: { a: '#C9CDD0', k: '#38D6FF', b: INK },
    level: 5,
    xp: 2600,
  },
  {
    id: 'skull',
    name: t('avatars.skull'),
    band: '#A267FF',
    sprite: ['.aaaaaa.', 'aaaaaaaa', 'akkaakka', 'akkaakka', 'aaakkaaa', '.aaaaaa.', '..a.a.a.', '..aaaaa.'],
    colors: { a: CREAM, k: INK },
    level: 7,
    xp: 4000,
  },
  {
    id: 'flame',
    name: t('avatars.flame'),
    band: '#2B5CFF',
    sprite: ['...a...', '..aa...', '..aaa..', '.aaaa.a', '.aabaaa', 'aabbbaa', 'abbwbba', 'abbwbba', '.abbba.'],
    colors: { a: '#FF4141', b: '#FFD23F', w: CREAM },
    level: 0,
    xp: 0,
  },
  {
    id: 'crown',
    name: t('avatars.crown'),
    band: '#FF4FA0',
    sprite: ['a...a...a', 'aa.aaa.aa', 'aaaaaaaaa', 'abaabaaba', 'aaaaaaaaa', 'aaaaaaaaa'],
    colors: { a: '#FFD23F', b: '#38D6FF' },
    level: 0,
    xp: 0,
  },
];

export const DEFAULT_AVATAR: AvatarId = 'tag';

export const avatarById = (id: string | undefined) => AVATARS.find((a) => a.id === id) ?? AVATARS[0];

/** Unlock marker kept in game.unlocked when an avatar is bought with XP. */
export const avatarUnlockId = (id: AvatarId) => `avatar:${id}`;
/** Marker for an avatar won from a chest; it costs nothing. */
export const avatarGiftId = (id: AvatarId) => `gift:avatar:${id}`;

export const isRewardAvatar = (a: AvatarDef) => a.level === 0;

export const isAvatarUnlocked = (a: AvatarDef, level: number, unlocked: string[]) =>
  (!isRewardAvatar(a) && level >= a.level) || unlocked.includes(avatarUnlockId(a.id)) || unlocked.includes(avatarGiftId(a.id));
