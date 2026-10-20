import { t } from './i18n';

// The jukebox: background tracks (made by scripts/make-music.py). Two are free; the rest unlock when
// the player reaches a Street Crew rank, or earlier by spending XP. Spending XP never lowers the
// rank: it comes out of the same "spendable XP" as trading XP for credits.

export type TrackId = 'brawl' | 'arcade' | 'neon' | 'funk' | 'chill' | 'boss';

export interface MusicTrack {
  id: TrackId;
  name: string;
  vibe: string;
  emoji: string;
  /** Street Crew level (1-based) that unlocks it for free. */
  level: number;
  /** XP to unlock it early; 0 for free tracks. */
  xp: number;
}

export const TRACKS: MusicTrack[] = [
  { id: 'brawl', name: t('music.brawl'), vibe: t('music.brawlVibe'), emoji: '🎺', level: 1, xp: 0 },
  { id: 'arcade', name: t('music.arcade'), vibe: t('music.arcadeVibe'), emoji: '👾', level: 1, xp: 0 },
  { id: 'neon', name: t('music.neon'), vibe: t('music.neonVibe'), emoji: '🌆', level: 3, xp: 1500 },
  { id: 'funk', name: t('music.funk'), vibe: t('music.funkVibe'), emoji: '🚇', level: 5, xp: 3000 },
  { id: 'chill', name: t('music.chill'), vibe: t('music.chillVibe'), emoji: '☕', level: 7, xp: 4000 },
  { id: 'boss', name: t('music.boss'), vibe: t('music.bossVibe'), emoji: '👊', level: 9, xp: 6000 },
];

export const DEFAULT_TRACK: TrackId = 'brawl';

export const TRACK_FILES: Record<TrackId, number> = {
  brawl: require('@/assets/audio/music-brawl.wav'),
  arcade: require('@/assets/audio/music-arcade.wav'),
  neon: require('@/assets/audio/music-neon.wav'),
  funk: require('@/assets/audio/music-funk.wav'),
  chill: require('@/assets/audio/music-chill.wav'),
  boss: require('@/assets/audio/music-boss.wav'),
};

export const trackById = (id: string | undefined) => TRACKS.find((x) => x.id === id) ?? TRACKS[0];

/** Unlock marker kept in game.unlocked when a track is bought with XP. */
export const trackUnlockId = (id: TrackId) => `music:${id}`;

export const isTrackUnlocked = (track: MusicTrack, level: number, unlocked: string[]) =>
  level >= track.level || unlocked.includes(trackUnlockId(track.id));
