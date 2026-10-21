import { t } from './i18n';

// The jukebox: background tracks (made by scripts/make-music.py). Two are free; the rest unlock when
// the player reaches a Street Crew rank, or earlier by spending XP. Spending XP never lowers the
// rank: it comes out of the same "spendable XP" as trading XP for credits.

export type TrackId = 'drive' | 'noir' | 'chrome' | 'montage' | 'grid' | 'lap';

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
  { id: 'drive', name: t('music.drive'), vibe: t('music.driveVibe'), emoji: '🌆', level: 1, xp: 0 },
  { id: 'noir', name: t('music.noir'), vibe: t('music.noirVibe'), emoji: '🌃', level: 1, xp: 0 },
  { id: 'chrome', name: t('music.chrome'), vibe: t('music.chromeVibe'), emoji: '🪩', level: 3, xp: 1500 },
  { id: 'montage', name: t('music.montage'), vibe: t('music.montageVibe'), emoji: '🥊', level: 5, xp: 3000 },
  { id: 'grid', name: t('music.grid'), vibe: t('music.gridVibe'), emoji: '🌙', level: 7, xp: 4000 },
  { id: 'lap', name: t('music.lap'), vibe: t('music.lapVibe'), emoji: '🏁', level: 9, xp: 6000 },
];

export const DEFAULT_TRACK: TrackId = 'drive';

export const TRACK_FILES: Record<TrackId, number> = {
  drive: require('@/assets/audio/music-drive.wav'),
  noir: require('@/assets/audio/music-noir.wav'),
  chrome: require('@/assets/audio/music-chrome.wav'),
  montage: require('@/assets/audio/music-montage.wav'),
  grid: require('@/assets/audio/music-grid.wav'),
  lap: require('@/assets/audio/music-lap.wav'),
};

/** The first jukebox's ids, mapped to the 80s tracks that took their place (same unlock rank). */
export const OLD_TRACKS: Record<string, TrackId> = { brawl: 'drive', arcade: 'noir', neon: 'chrome', funk: 'montage', chill: 'grid', boss: 'lap' };

export const trackById = (id: string | undefined) => TRACKS.find((x) => x.id === id) ?? TRACKS[0];

/** Unlock marker kept in game.unlocked when a track is bought with XP. */
export const trackUnlockId = (id: TrackId) => `music:${id}`;

export const isTrackUnlocked = (track: MusicTrack, level: number, unlocked: string[]) =>
  level >= track.level || unlocked.includes(trackUnlockId(track.id));
