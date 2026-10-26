import { requireOptionalNativeModule } from 'expo';
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { Directory, File, Paths } from 'expo-file-system';
import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';

import { synthesizeSpeech, aiAvailable } from './gemini';
import { duckMusic } from './sound';

// expo-speech throws on import when its native code isn't in the build (an app binary built
// before it was added), which would crash the app at launch. Load it only when it's there.
const Speech: typeof import('expo-speech') | null =
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Platform.OS === 'web' || requireOptionalNativeModule('ExpoSpeech') ? require('expo-speech') : null;

// Which chat message the Coach is reading out loud (or preparing to), if any.
let speakingId: string | null = null;
const listeners = new Set<() => void>();
const setSpeaking = (id: string | null) => {
  speakingId = id;
  duckMusic('voice', !!id);
  listeners.forEach((l) => l());
};

// Backstop for the Coach prompt: never speak a self-introduction, greeting or filler before the answer.
const INTRO = /^\s*(?:(?:hi|hey|hello|hiya|yo)\b[^.!?\n]{0,25}[.!?]+|(?:i'm|i am|this is|it's)\s+(?:pulse|your (?:pulse |ai )?(?:fitness )?coach)\b[^.!?\n]*[.!?]+|(?:sure|absolutely|of course|great question|good question)\b[^.!?\n]{0,20}[.!?]+)\s*$/i;

/** Replies are written for the screen; drop emoji and markdown so a sentence reads naturally. */
function forSpeech(sentence: string) {
  return sentence
    .replace(/\p{Extended_Pictographic}|\p{Emoji_Modifier}|\uFE0F|\u200D/gu, '')
    .replace(/^\s*[-•]\s+(.*?)[.!?]?\s*$/, '$1.')
    .replace(/(\d)\s?[-–]\s?(\d)/g, '$1 to $2')
    .replace(/[*_#`>~]/g, '')
    .replace(/(\d)\s?x\s?(\d)/g, '$1 sets of $2')
    .replace(/\bkcal\b/gi, 'calories')
    .replace(/(\d)\s?g\b/g, '$1 grams')
    .replace(/(\d)\s?ml\b/g, '$1 milliliters')
    .replace(/(\d)\s?kg\b/g, '$1 kilos')
    .replace(/(\d)\s?lbs?\b/g, '$1 pounds')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * The complete sentences (or bullet lines) in text. A sentence counts as complete once a space or
 * newline follows its . ! or ?, so "1.6" stays whole and a reply still streaming in isn't cut short.
 */
function sentences(text: string, final: boolean) {
  const out: string[] = [];
  let last = 0;
  for (const m of text.matchAll(/[.!?]+["')\]]*(?=\s)|\n/g)) {
    const end = m.index + m[0].length;
    out.push(text.slice(last, end));
    last = end;
  }
  if (final) out.push(text.slice(last));
  return out.map((x) => x.trim()).filter((x) => /\w/.test(x));
}

// Every speak/stop bumps this, so a slow speech request can't start talking over a newer one.
let turn = 0;
let player: ReturnType<typeof createAudioPlayer> | null = null;
// Resolves the clip that's playing, so stopping also ends the wait for it.
let endClip: (() => void) | null = null;

function releasePlayer() {
  try {
    player?.pause();
    player?.remove();
  } catch {
    // already released
  }
  player = null;
  endClip?.();
  endClip = null;
}

function playClip(uri: string) {
  return new Promise<void>((resolve) => {
    releasePlayer();
    endClip = resolve;
    player = createAudioPlayer({ uri });
    player.addListener('playbackStatusUpdate', (s) => {
      if (s.didJustFinish) resolve();
    });
    player.play();
  });
}

// Generated audio by voice and text, so Listen replays instantly and costs nothing.
const clips = new Map<string, string>();
const MAX_CLIPS = 60;

function remember(key: string, uri: string) {
  clips.set(key, uri);
  if (clips.size <= MAX_CLIPS) return;
  const [oldKey, oldUri] = clips.entries().next().value as [string, string];
  clips.delete(oldKey);
  if (Platform.OS === 'web') URL.revokeObjectURL(oldUri);
  else {
    try {
      new File(oldUri).delete();
    } catch {
      // the OS may have cleared the cache already
    }
  }
}

function wavHeader(dataBytes: number, sampleRate: number) {
  const view = new DataView(new ArrayBuffer(44));
  const ascii = (at: number, s: string) => [...s].forEach((c, i) => view.setUint8(at + i, c.charCodeAt(0)));
  ascii(0, 'RIFF');
  view.setUint32(4, 36 + dataBytes, true);
  ascii(8, 'WAVE');
  ascii(12, 'fmt ');
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  ascii(36, 'data');
  view.setUint32(40, dataBytes, true);
  return new Uint8Array(view.buffer);
}

/** Gemini speech for a reply, saved as a playable file. Raw PCM gets a WAV header. */
async function naturalClip(key: string, text: string, apiKey: string, voice: string) {
  const cached = clips.get(key);
  if (cached) return cached;
  const { base64, mimeType } = await synthesizeSpeech({ apiKey, text, voice });
  const pcm = /L16|pcm/i.test(mimeType);
  const rate = Number(mimeType.match(/rate=(\d+)/)?.[1]) || 24000;
  const ext = pcm || /wav/i.test(mimeType) ? 'wav' : /mpeg|mp3/i.test(mimeType) ? 'mp3' : 'audio';
  let uri: string;
  if (Platform.OS === 'web') {
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const parts: BlobPart[] = pcm ? [wavHeader(bytes.length, rate), bytes] : [bytes];
    uri = URL.createObjectURL(new Blob(parts, { type: pcm ? 'audio/wav' : mimeType }));
  } else {
    const dir = new Directory(Paths.cache, 'coach-voice');
    if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
    const file = new File(dir, `${key.replace(/[^\w-]/g, '_')}.${ext}`);
    if (pcm) {
      const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
      await file.write(wavHeader((base64.length * 3) / 4 - padding, rate));
      await file.write(base64, { encoding: 'base64', append: true });
    } else {
      await file.write(base64, { encoding: 'base64' });
    }
    uri = file.uri;
  }
  remember(key, uri);
  return uri;
}

// The built-in voice is the fallback; pick the device's best English one rather than the default.
let deviceVoice: Promise<string | undefined> | undefined;
function bestDeviceVoice() {
  deviceVoice ??= (Speech?.getAvailableVoicesAsync() ?? Promise.resolve([]))
    .then((voices) => {
      const en = voices.filter((v) => v.language.startsWith('en'));
      const lang = (v: { language: string }) => (v.language === 'en-US' ? 1 : 0);
      return en.sort((a, b) => Number(b.quality === 'Enhanced') - Number(a.quality === 'Enhanced') || lang(b) - lang(a))[0]
        ?.identifier;
    })
    .catch(() => undefined);
  return deviceVoice;
}

function speakOnDevice(text: string, my: number) {
  return new Promise<void>((resolve) => {
    if (!Speech) return resolve();
    bestDeviceVoice().then((voice) => {
      if (my !== turn) return resolve();
      Speech.speak(text.slice(0, Speech.maxSpeechInputLength), { voice, onDone: resolve, onStopped: resolve, onError: () => resolve() });
    });
  });
}

function hash(text: string) {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = (h * 33) ^ text.charCodeAt(i);
  return (h >>> 0).toString(36);
}

export interface SpeechStream {
  /** The reply so far; complete sentences start playing while the rest streams in. */
  update(text: string): void;
  /** The whole reply. */
  finish(text: string): void;
  /** Stop, e.g. when the reply failed. */
  cancel(): void;
}

/**
 * Speaks a reply while it is still arriving. Speech is generated a chunk at a time: the first
 * sentence alone so the Coach starts talking quickly, then bigger chunks made while it speaks.
 */
export function speakStream(id: string, opts: { apiKey: string; voice: string }): SpeechStream {
  const my = ++turn;
  releasePlayer();
  Speech?.stop().catch(() => {});
  const natural = opts.voice !== 'device' && aiAvailable(opts.apiKey);

  const parts: string[] = []; // chunks queued to speak, in order
  let pending: string[] = []; // complete sentences not yet grouped into a chunk
  let seen = 0; // sentences of the reply taken so far
  let skipped: string[] = []; // a leading greeting or intro, said only if it's the whole reply
  let ended = false;
  let idle = true; // nothing queued to play, so queue whatever is ready
  let playing = 0;
  let wake: (() => void) | null = null;

  const clipsFor: Promise<string>[] = [];
  const clip = (i: number) => {
    // Generate up to two chunks ahead of the one playing.
    if (!natural || i >= parts.length || i > playing + 2) return;
    if (!clipsFor[i]) {
      clipsFor[i] = naturalClip(`${opts.voice}-${hash(parts[i])}`, parts[i], opts.apiKey, opts.voice);
      clipsFor[i].catch(() => {}); // awaited when its turn comes; don't report prefetches as unhandled
    }
    return clipsFor[i];
  };

  const push = (chunk: string) => {
    parts.push(chunk);
    if (parts.length === 1) setSpeaking(id);
    clip(parts.length - 1);
    wake?.();
  };

  const flush = (final: boolean) => {
    while (pending.length) {
      // Grow chunk sizes so each one is ready before the previous one finishes playing.
      const limit = [0, 120][parts.length] ?? 260;
      let chunk = pending[0];
      let n = 1;
      for (; n < pending.length && chunk.length + pending[n].length < limit; n++) chunk += ` ${pending[n]}`;
      // A chunk with room left waits for more sentences, unless that would leave the Coach silent.
      if (!final && !idle && n === pending.length && chunk.length < limit) return;
      pending = pending.slice(n);
      push(chunk);
    }
  };

  const feed = (text: string, final: boolean) => {
    if (my !== turn || ended) return;
    const all = sentences(text, final);
    for (const sentence of all.slice(seen).map(forSpeech)) {
      if (!sentence) continue;
      if (!parts.length && !pending.length && INTRO.test(sentence)) skipped.push(sentence);
      else pending.push(sentence);
    }
    seen = all.length;
    if (final) {
      if (!parts.length && !pending.length) pending = skipped;
      skipped = [];
      flush(true);
      ended = true;
      wake?.();
    } else flush(false);
  };

  (async () => {
    // Talk back even with the ringer switch off, like a voice note would.
    await setAudioModeAsync({ playsInSilentMode: true, interruptionMode: 'mixWithOthers' }).catch(() => {});
    let device = !natural;
    for (let i = 0; ; i++) {
      while (i >= parts.length && !ended) {
        idle = true;
        flush(false);
        if (i < parts.length) break;
        await new Promise<void>((r) => (wake = r));
        wake = null;
        if (my !== turn) return;
      }
      idle = false;
      if (my !== turn || i >= parts.length) break;
      playing = i;
      clip(i + 1);
      clip(i + 2);
      if (!device) {
        try {
          const uri = await clip(i)!;
          if (my !== turn) return;
          await playClip(uri);
          continue;
        } catch (err) {
          if (my !== turn) return;
          console.warn('[voice] Gemini speech failed, using the device voice', err);
          device = true;
        }
      }
      // Whatever Gemini couldn't voice (or everything, for the Offline voice) uses the device voice.
      await speakOnDevice(parts[i], my);
    }
    if (my === turn) {
      releasePlayer();
      setSpeaking(null);
    }
  })().catch((err) => {
    console.warn('[voice] speak failed', err);
    if (my === turn) {
      releasePlayer();
      setSpeaking(null);
    }
  });

  return {
    update: (text) => feed(text, false),
    finish: (text) => feed(text, true),
    cancel: () => {
      if (my === turn) stopSpeaking();
    },
  };
}

/** Speaks a whole reply, e.g. when the user taps Listen. */
export function speak(id: string, text: string, opts: { apiKey: string; voice: string }) {
  speakStream(id, opts).finish(text);
}

export async function stopSpeaking() {
  turn++;
  releasePlayer();
  if (speakingId) setSpeaking(null);
  await Speech?.stop().catch(() => {});
}

export function useSpeakingId() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => speakingId,
    () => speakingId,
  );
}
