import { requireOptionalNativeModule } from 'expo';
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { Directory, File, Paths } from 'expo-file-system';
import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';

import { synthesizeSpeech } from './gemini';

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
  listeners.forEach((l) => l());
};

/** Replies are written for the screen; drop emoji and markdown so they read naturally. */
// Backstop for the Coach prompt: never speak a self-introduction or greeting before the answer.
const INTRO = /^\s*(?:(?:hi|hey|hello|hiya|yo)\b[^.!?\n]{0,25}[.!?]+|(?:i'm|i am|this is|it's)\s+(?:pulse|your (?:pulse |ai )?(?:fitness )?coach)\b[^.!?\n]*[.!?]+|(?:sure|absolutely|of course|great question|good question)\b[^.!?\n]{0,20}[.!?]+)\s*/i;

function forSpeech(text: string) {
  let rest = text;
  // Only strip while something is left to say.
  for (let m = rest.match(INTRO); m && rest.length > m[0].length; m = rest.match(INTRO)) rest = rest.slice(m[0].length);
  return rest
    .replace(/\p{Extended_Pictographic}|\p{Emoji_Modifier}|️|‍/gu, '')
    .replace(/^\s*[-•]\s+(.*?)[.!?]?\s*$/gm, '$1.')
    .replace(/(\d)\s?[-–]\s?(\d)/g, '$1 to $2')
    .replace(/[*_#`>~]/g, '')
    .replace(/(\d)\s?x\s?(\d)/g, '$1 sets of $2')
    .replace(/\bkcal\b/gi, 'calories')
    .replace(/(\d)\s?g\b/g, '$1 grams')
    .replace(/(\d)\s?ml\b/g, '$1 milliliters')
    .replace(/(\d)\s?kg\b/g, '$1 kilos')
    .replace(/(\d)\s?lbs?\b/g, '$1 pounds')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 4000);
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

/**
 * Speech is generated a few sentences at a time. The first chunk is one sentence so the Coach
 * starts talking quickly; the rest are generated while it speaks.
 */
function chunks(text: string) {
  // Split after . ! ? followed by a space, so decimals like "1.6" stay whole.
  const sentences = text
    .replace(/([.!?]+["')\]]*)\s+/g, '$1\n')
    .split('\n')
    .map((x) => x.trim())
    .filter((x) => /\w/.test(x));
  const out: string[] = [];
  let cur = '';
  for (const sentence of sentences) {
    // Grow chunk sizes so each one is ready before the previous one finishes playing.
    const limit = [0, 120][out.length] ?? 260;
    if (cur && cur.length + sentence.length > limit) {
      out.push(cur);
      cur = sentence;
    } else cur = cur ? `${cur} ${sentence}` : sentence;
  }
  if (cur) out.push(cur);
  return out;
}

// Generated audio per message and voice, so Listen replays instantly and costs nothing.
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

export async function speak(id: string, text: string, opts: { apiKey: string; voice: string }) {
  const my = ++turn;
  releasePlayer();
  await Speech?.stop().catch(() => {});
  const say = forSpeech(text);
  if (!say) return setSpeaking(null);
  setSpeaking(id);

  try {
    // Talk back even with the ringer switch off, like a voice note would.
    await setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
    const parts = opts.voice !== 'device' && opts.apiKey ? chunks(say) : [];
    const clipsFor: Promise<string>[] = [];
    const clip = (i: number) => {
      if (i >= parts.length) return;
      if (!clipsFor[i]) {
        clipsFor[i] = naturalClip(`${opts.voice}-${id}-${i}`, parts[i], opts.apiKey, opts.voice);
        clipsFor[i].catch(() => {}); // awaited below; don't report prefetches as unhandled
      }
      return clipsFor[i];
    };

    let spoken = 0;
    try {
      for (; spoken < parts.length; spoken++) {
        // Keep the next two chunks generating while this one plays.
        clip(spoken + 1);
        clip(spoken + 2);
        const uri = await clip(spoken)!;
        if (my !== turn) return;
        await playClip(uri);
        if (my !== turn) return;
      }
    } catch (err) {
      if (my !== turn) return;
      console.warn('[voice] Gemini speech failed, using the device voice', err);
    }
    // Whatever Gemini couldn't voice (or everything, for the Offline voice) uses the device voice.
    const rest = parts.length ? parts.slice(spoken).join(' ') : say;
    if (rest) await speakOnDevice(rest, my);
  } catch (err) {
    console.warn('[voice] speak failed', err);
  }
  if (my === turn) {
    releasePlayer();
    setSpeaking(null);
  }
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
