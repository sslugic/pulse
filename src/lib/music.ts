import { t } from './i18n';

// The jukebox: 30 original 80s tracks (scripts/make-music.py and scripts/make-music-library.py).
// Two are free. The rest unlock slowly: by Street Crew rank (or earlier by spending XP, which never
// lowers the rank: it comes out of the same "spendable XP" as trading XP for credits), by reaching a
// streak milestone (best streak ever, so it stays unlocked), or as a rare drop from a gold chest.
// The first six ship with the app; the other 24 download from the Pulse website when first played.

export type TrackId =
  | 'drive' | 'noir' | 'chrome' | 'montage' | 'grid' | 'lap'
  | 'sunset' | 'coastline' | 'palm' | 'afterglow' | 'rain' | 'ice' | 'signal' | 'circuit'
  | 'turbo' | 'redline' | 'pursuit' | 'overdrive' | 'mirrorball' | 'laser' | 'strobe' | 'velvet'
  | 'round' | 'uphill' | 'champion' | 'retreat' | 'pastel' | 'lateshow' | 'slowburn' | 'vapor';

export interface MusicTrack {
  id: TrackId;
  name: string;
  vibe: string;
  emoji: string;
  /** Street Crew level (1-based) that unlocks it for free; 0 when it unlocks another way. */
  level: number;
  /** XP to unlock it early; 0 when it can't be bought (free, streak and chest tracks). */
  xp: number;
  /** Unlocks at this best-ever streak, in days. */
  streak?: number;
  /** Only drops from gold chests. */
  chest?: boolean;
  /** File name on the Pulse website for tracks that download instead of shipping with the app. */
  file?: string;
}

// Track names are titles, the same in every language; the one-line vibe is translated.
const rank = (id: TrackId, name: string, emoji: string, level: number, xp: number, file?: string): MusicTrack => ({
  id, name, emoji, level, xp, file, vibe: t(`music.${id}Vibe`),
});
const streakTrack = (id: TrackId, name: string, emoji: string, days: number, file: string): MusicTrack => ({
  id, name, emoji, level: 0, xp: 0, streak: days, file, vibe: t(`music.${id}Vibe`),
});
const chestTrack = (id: TrackId, name: string, emoji: string, file: string): MusicTrack => ({
  id, name, emoji, level: 0, xp: 0, chest: true, file, vibe: t(`music.${id}Vibe`),
});

export const TRACKS: MusicTrack[] = [
  rank('drive', 'Night Drive', '🌆', 1, 0),
  rank('noir', 'Neon Noir', '🌃', 1, 0),
  rank('sunset', 'Sunset Boulevard', '🌅', 2, 1000, 'sunset-boulevard'),
  rank('chrome', 'Chrome City', '🪩', 3, 1500),
  rank('rain', 'Rain City', '🌧️', 4, 2500, 'rain-city'),
  rank('montage', 'Training Montage', '🥊', 5, 3000),
  rank('mirrorball', 'Mirrorball', '💿', 6, 3500, 'mirrorball'),
  rank('grid', 'Midnight Grid', '🌙', 7, 4000),
  rank('round', 'Last Round', '🔔', 8, 5000, 'last-round'),
  rank('lap', 'Final Lap', '🏁', 9, 6000),
  rank('pastel', 'Pastel Skyline', '🏙️', 10, 7000, 'pastel-skyline'),
  rank('turbo', 'Turbo Nights', '🏎️', 11, 8000, 'turbo-nights'),
  rank('ice', 'Black Ice', '🧊', 12, 9500, 'black-ice'),
  rank('laser', 'Laser Disco', '🔦', 12, 9500, 'laser-disco'),
  rank('uphill', 'Uphill', '⛰️', 13, 11000, 'uphill'),
  rank('lateshow', 'Late Show', '📺', 13, 11000, 'late-show'),
  rank('coastline', 'Coastline 1986', '🌊', 14, 13000, 'coastline-1986'),
  rank('redline', 'Redline', '🚨', 14, 13000, 'redline'),
  rank('signal', 'Signal Lost', '📡', 15, 15000, 'signal-lost'),
  rank('champion', 'Champion Code', '🏆', 15, 15000, 'champion-code'),
  streakTrack('palm', 'Palm Static', '🌴', 7, 'palm-static'),
  streakTrack('strobe', 'Strobe', '⚡', 14, 'strobe'),
  streakTrack('slowburn', 'Slow Burn', '🕯️', 30, 'slow-burn'),
  streakTrack('afterglow', 'Afterglow Highway', '🛣️', 60, 'afterglow-highway'),
  streakTrack('pursuit', 'Pursuit', '🚓', 100, 'pursuit'),
  streakTrack('velvet', 'Velvet Tape', '📼', 180, 'velvet-tape'),
  streakTrack('retreat', 'No Retreat', '🔥', 365, 'no-retreat'),
  chestTrack('circuit', 'Cold Circuit', '🔌', 'cold-circuit'),
  chestTrack('overdrive', 'Overdrive', '💥', 'overdrive'),
  chestTrack('vapor', 'Vapor Lounge', '🍸', 'vapor-lounge'),
];

export const DEFAULT_TRACK: TrackId = 'drive';

/** Tracks that ship with the app. */
export const TRACK_FILES: Partial<Record<TrackId, number>> = {
  drive: require('@/assets/audio/music-drive.wav'),
  noir: require('@/assets/audio/music-noir.wav'),
  chrome: require('@/assets/audio/music-chrome.wav'),
  montage: require('@/assets/audio/music-montage.wav'),
  grid: require('@/assets/audio/music-grid.wav'),
  lap: require('@/assets/audio/music-lap.wav'),
};

/** Where downloadable tracks live (the Pulse website on GitHub Pages). */
export const MUSIC_BASE_URL = 'https://sslugic.github.io/pulse-site/music';

/** The first jukebox's ids, mapped to the 80s tracks that took their place (same unlock rank). */
export const OLD_TRACKS: Record<string, TrackId> = { brawl: 'drive', arcade: 'noir', neon: 'chrome', funk: 'montage', chill: 'grid', boss: 'lap' };

export const trackById = (id: string | undefined) => TRACKS.find((x) => x.id === id) ?? TRACKS[0];

/** Unlock marker kept in game.unlocked when a track is bought with XP or drops from a chest. */
export const trackUnlockId = (id: TrackId) => `music:${id}`;

export const isTrackUnlocked = (track: MusicTrack, level: number, unlocked: string[], bestStreak: number) =>
  unlocked.includes(trackUnlockId(track.id)) ||
  (track.level > 0 && level >= track.level) ||
  (track.streak != null && bestStreak >= track.streak);

/** What it takes to unlock a locked track, for the jukebox. */
export function unlockHint(track: MusicTrack, rankName: (level: number) => string) {
  if (track.chest) return t('music.unlocksChest');
  if (track.streak != null) return t('music.unlocksStreak', { days: track.streak });
  return t('music.unlocksAt', { rank: rankName(track.level) });
}
