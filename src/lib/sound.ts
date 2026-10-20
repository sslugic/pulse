import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { AppState, Platform } from 'react-native';

import { DEFAULT_TRACK, TRACK_FILES, type TrackId } from './music';

// Background music (scripts/make-music.py) and reward sounds (scripts/make-sounds.py). Music loops
// while the app is open and is on by default; the track, its volume, and both on/off switches live in
// Crew. Sounds follow the ringer switch and mix with whatever else is playing, and the music pauses
// while the Coach talks or you record.

/** Loudest the music gets at 100% on the volume control, so it stays background music. */
const MUSIC_MAX = 0.45;
const SFX_VOLUME = 0.7;

export type Sfx = 'chest' | 'reward' | 'fanfare' | 'nudge';

const SFX: Record<Sfx, number> = {
  chest: require('@/assets/audio/chest.m4a'),
  reward: require('@/assets/audio/reward.m4a'),
  fanfare: require('@/assets/audio/fanfare.m4a'),
  nudge: require('@/assets/audio/nudge.m4a'),
};

let musicOn = true;
let sfxOn = true;
let track: TrackId = DEFAULT_TRACK;
let volume = 0.5;
/** A track being previewed in the jukebox, played instead of the chosen one. */
let preview: TrackId | null = null;
let loaded: TrackId | null = null;
let active = AppState.currentState === 'active';
/** Reasons the music is paused for now (the Coach speaking, a recording). */
const ducks = new Set<string>();

let music: AudioPlayer | null = null;
const players: Partial<Record<Sfx, AudioPlayer>> = {};

const ambient = () =>
  setAudioModeAsync({ playsInSilentMode: false, interruptionMode: 'mixWithOthers', shouldPlayInBackground: false }).catch(() => {});

function sync() {
  if (Platform.OS === 'web') return;
  const shouldPlay = (musicOn || !!preview) && active && ducks.size === 0;
  const want = preview ?? track;
  try {
    if (shouldPlay) {
      if (!music) {
        music = createAudioPlayer(TRACK_FILES[want]);
        music.loop = true;
        loaded = want;
      } else if (loaded !== want) {
        music.replace(TRACK_FILES[want]);
        music.loop = true;
        loaded = want;
      }
      music.volume = MUSIC_MAX * volume;
      ambient().then(() => music?.play());
    } else music?.pause();
  } catch (e) {
    console.warn('[sound] music failed', e);
  }
}

/** Applies the player's settings (called on launch and whenever they change). */
export function configureSound(opts: { music: boolean; sfx: boolean; track?: TrackId; volume?: number }) {
  musicOn = opts.music;
  sfxOn = opts.sfx;
  track = opts.track ?? DEFAULT_TRACK;
  volume = Math.min(1, Math.max(0, opts.volume ?? 0.5));
  sync();
}

/** Plays a track in the jukebox without choosing it; null goes back to the chosen one. */
export function previewTrack(id: TrackId | null) {
  preview = id;
  sync();
}

/** Pauses the music while something else needs the speaker (or the mic). */
export function duckMusic(reason: string, on: boolean) {
  if (on) ducks.add(reason);
  else ducks.delete(reason);
  sync();
}

export function playSfx(name: Sfx) {
  if (!sfxOn || Platform.OS === 'web') return;
  try {
    let p = players[name];
    if (!p) {
      p = createAudioPlayer(SFX[name]);
      p.volume = SFX_VOLUME;
      players[name] = p;
    }
    p.seekTo(0);
    p.play();
  } catch (e) {
    console.warn('[sound] sfx failed', e);
  }
}

AppState.addEventListener('change', (s) => {
  active = s === 'active';
  sync();
});
