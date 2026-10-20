import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { AppState, Platform } from 'react-native';

// Arcade music and reward sounds (made by scripts/make-sounds.py). Music loops quietly while the app
// is open and is on by default; both can be switched off in Crew. Sounds follow the ringer switch and
// mix with whatever else is playing, and the music pauses while the Coach talks or you record.

const MUSIC_VOLUME = 0.22;
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
let active = AppState.currentState === 'active';
/** Reasons the music is paused for now (the Coach speaking, a recording). */
const ducks = new Set<string>();

let music: AudioPlayer | null = null;
const players: Partial<Record<Sfx, AudioPlayer>> = {};

const ambient = () =>
  setAudioModeAsync({ playsInSilentMode: false, interruptionMode: 'mixWithOthers', shouldPlayInBackground: false }).catch(() => {});

function sync() {
  if (Platform.OS === 'web') return;
  const shouldPlay = musicOn && active && ducks.size === 0;
  try {
    if (shouldPlay) {
      if (!music) {
        music = createAudioPlayer(require('@/assets/audio/arcade-loop.wav'));
        music.loop = true;
        music.volume = MUSIC_VOLUME;
      }
      ambient().then(() => music?.play());
    } else music?.pause();
  } catch (e) {
    console.warn('[sound] music failed', e);
  }
}

/** Applies the player's settings (called on launch and whenever they change). */
export function configureSound(opts: { music: boolean; sfx: boolean }) {
  musicOn = opts.music;
  sfxOn = opts.sfx;
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
