import { t } from './i18n';

// Profile avatars: illustrated 80s items and characters inside the tag ring (assets/images/avatars,
// made with Figma AI; the old SVG stickers in avatar-art.ts are the fallback). The tag (your initial)
// and a couple of avatars are free; most unlock at a Street Crew rank or earlier with XP, like jukebox
// tracks. Reward avatars can't be bought: they only drop from silver and gold chests. Avatars whose art
// isn't drawn yet stay out of the list until it is.

export type AvatarId =
  | 'tag' | 'spray' | 'cassette' | 'boombox' | 'token' | 'sneaker' | 'mic' | 'bboy' | 'train' | 'crown' | 'skull'
  | 'walkman' | 'skate' | 'vhs' | 'writer' | 'skater' | 'arcadeKid' | 'punk' | 'aerobics' | 'skateboarder' | 'boxer' | 'dj'
  | 'cyborg' | 'robot' | 'ninja';

export interface AvatarDef {
  id: AvatarId;
  name: string;
  /** Accent colour, used for the loot row and the tag's splash. */
  band: string;
  /** Street Crew level (1-based) that unlocks it for free; 0 = reward only. */
  level: number;
  /** XP to unlock it early; 0 when free or reward only. */
  xp: number;
  /** Illustrated artwork; the tag has none (it shows your initial). */
  art?: number;
}

const ART: Partial<Record<AvatarId, number>> = {
  spray: require('@/assets/images/avatars/spray.jpg'),
  cassette: require('@/assets/images/avatars/cassette.jpg'),
  boombox: require('@/assets/images/avatars/boombox.jpg'),
  token: require('@/assets/images/avatars/token.jpg'),
  sneaker: require('@/assets/images/avatars/sneaker.jpg'),
  mic: require('@/assets/images/avatars/mic.jpg'),
  bboy: require('@/assets/images/avatars/bboy.jpg'),
  train: require('@/assets/images/avatars/train.jpg'),
  crown: require('@/assets/images/avatars/crown.jpg'),
  skull: require('@/assets/images/avatars/skull.jpg'),
  walkman: require('@/assets/images/avatars/walkman.jpg'),
  skate: require('@/assets/images/avatars/skate.jpg'),
  vhs: require('@/assets/images/avatars/vhs.jpg'),
  writer: require('@/assets/images/avatars/writer.jpg'),
  skater: require('@/assets/images/avatars/skater.jpg'),
  cyborg: require('@/assets/images/avatars/cyborg.jpg'),
  arcadeKid: require('@/assets/images/avatars/arcadeKid.jpg'),
  punk: require('@/assets/images/avatars/punk.jpg'),
  aerobics: require('@/assets/images/avatars/aerobics.jpg'),
  skateboarder: require('@/assets/images/avatars/skateboarder.jpg'),
  boxer: require('@/assets/images/avatars/boxer.jpg'),
  dj: require('@/assets/images/avatars/dj.jpg'),
  robot: require('@/assets/images/avatars/robot.jpg'),
  ninja: require('@/assets/images/avatars/ninja.jpg'),
};

const PLAN: AvatarDef[] = [
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
  { id: 'walkman', name: t('avatars.walkman'), band: '#FF9A3D', level: 3, xp: 1200 },
  { id: 'skate', name: t('avatars.skate'), band: '#FF4FA0', level: 4, xp: 1800 },
  { id: 'vhs', name: t('avatars.vhs'), band: '#FF7A1A', level: 5, xp: 2600 },
  { id: 'writer', name: t('avatars.writer'), band: '#9CFF2E', level: 8, xp: 4800 },
  { id: 'skater', name: t('avatars.skater'), band: '#FF4FA0', level: 9, xp: 5600 },
  { id: 'arcadeKid', name: t('avatars.arcadeKid'), band: '#38D6FF', level: 10, xp: 6400 },
  { id: 'punk', name: t('avatars.punk'), band: '#FF4FA0', level: 11, xp: 7200 },
  { id: 'aerobics', name: t('avatars.aerobics'), band: '#38D6FF', level: 12, xp: 8000 },
  { id: 'skateboarder', name: t('avatars.skateboarder'), band: '#FF9A3D', level: 13, xp: 9000 },
  { id: 'boxer', name: t('avatars.boxer'), band: '#FF4141', level: 14, xp: 10000 },
  { id: 'dj', name: t('avatars.dj'), band: '#A267FF', level: 15, xp: 11000 },
  { id: 'cyborg', name: t('avatars.cyborg'), band: '#38D6FF', level: 0, xp: 0 },
  { id: 'robot', name: t('avatars.robot'), band: '#9CFF2E', level: 0, xp: 0 },
  { id: 'ninja', name: t('avatars.ninja'), band: '#A267FF', level: 0, xp: 0 },
];

/** Every avatar that can be picked: the tag plus those with artwork. */
export const AVATARS: AvatarDef[] = PLAN.map((a) => ({ ...a, art: ART[a.id] })).filter((a) => a.id === 'tag' || a.art != null);

export const DEFAULT_AVATAR: AvatarId = 'tag';

export const avatarById = (id: string | undefined) => AVATARS.find((a) => a.id === id) ?? AVATARS[0];

/** Unlock marker kept in game.unlocked when an avatar is bought with XP. */
export const avatarUnlockId = (id: AvatarId) => `avatar:${id}`;
/** Marker for an avatar won from a chest; it costs nothing. */
export const avatarGiftId = (id: AvatarId) => `gift:avatar:${id}`;

export const isRewardAvatar = (a: AvatarDef) => a.level === 0;

export const isAvatarUnlocked = (a: AvatarDef, level: number, unlocked: string[]) =>
  (!isRewardAvatar(a) && level >= a.level) || unlocked.includes(avatarUnlockId(a.id)) || unlocked.includes(avatarGiftId(a.id));
