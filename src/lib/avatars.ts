import { t } from './i18n';

// Profile avatars: 80s subway-graffiti stickers inside the tag ring (art in avatar-art.ts). The tag
// (your initial) and a couple of stickers are free; most unlock at a Street Crew rank or earlier with
// XP, like jukebox tracks. Reward avatars can't be bought: they only drop from silver and gold chests.

export type AvatarId = 'tag' | 'spray' | 'cassette' | 'boombox' | 'token' | 'sneaker' | 'mic' | 'bboy' | 'train' | 'crown' | 'skull';

export interface AvatarDef {
  id: AvatarId;
  name: string;
  /** Accent colour, used for the loot row and the tag's splash. */
  band: string;
  /** Street Crew level (1-based) that unlocks it for free; 0 = reward only. */
  level: number;
  /** XP to unlock it early; 0 when free or reward only. */
  xp: number;
}

export const AVATARS: AvatarDef[] = [
  { id: 'tag', name: t('avatars.tag'), band: '#FF7A1A', level: 1, xp: 0 },
  { id: 'spray', name: t('avatars.spray'), band: '#FF4FA0', level: 1, xp: 0 },
  { id: 'cassette', name: t('avatars.cassette'), band: '#FF9A3D', level: 1, xp: 0 },
  { id: 'boombox', name: t('avatars.boombox'), band: '#FF4141', level: 2, xp: 600 },
  { id: 'token', name: t('avatars.token'), band: '#FFD23F', level: 3, xp: 1200 },
  { id: 'sneaker', name: t('avatars.sneaker'), band: '#2B5CFF', level: 4, xp: 1800 },
  { id: 'mic', name: t('avatars.mic'), band: '#38D6FF', level: 5, xp: 2600 },
  { id: 'bboy', name: t('avatars.bboy'), band: '#9CFF2E', level: 6, xp: 3300 },
  { id: 'train', name: t('avatars.train'), band: '#A267FF', level: 7, xp: 4000 },
  { id: 'crown', name: t('avatars.crown'), band: '#FFD23F', level: 0, xp: 0 },
  { id: 'skull', name: t('avatars.skull'), band: '#9CFF2E', level: 0, xp: 0 },
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
