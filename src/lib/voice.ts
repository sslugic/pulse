import { requireOptionalNativeModule } from 'expo';
import { setAudioModeAsync } from 'expo-audio';
import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';

// expo-speech throws on import when its native code isn't in the build (an app binary built
// before it was added), which would crash the app at launch. Load it only when it's there.
const Speech: typeof import('expo-speech') | null =
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Platform.OS === 'web' || requireOptionalNativeModule('ExpoSpeech') ? require('expo-speech') : null;

/** False when this build can't talk; the Coach hides its voice controls. */
export const voiceAvailable = !!Speech;

// Which chat message the Coach is reading out loud, if any.
let speakingId: string | null = null;
const listeners = new Set<() => void>();
const setSpeaking = (id: string | null) => {
  speakingId = id;
  listeners.forEach((l) => l());
};

/** Replies are written for the screen; drop emoji and markdown so they read naturally. */
function forSpeech(text: string) {
  return text
    .replace(/\p{Extended_Pictographic}|\p{Emoji_Modifier}|️|‍/gu, '')
    .replace(/^\s*[-•]\s+/gm, '. ')
    .replace(/[*_#`>~]/g, '')
    .replace(/(\d)\s?x\s?(\d)/g, '$1 sets of $2')
    .replace(/\bkcal\b/gi, 'calories')
    .replace(/(\d)\s?g\b/g, '$1 grams')
    .replace(/(\d)\s?ml\b/g, '$1 milliliters')
    .replace(/(\d)\s?kg\b/g, '$1 kilos')
    .replace(/(\d)\s?lbs?\b/g, '$1 pounds')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, Speech?.maxSpeechInputLength ?? 4000);
}

export async function speak(id: string, text: string) {
  if (!Speech) return;
  try {
    const say = forSpeech(text);
    await Speech.stop();
    if (!say) return setSpeaking(null);
    // Talk back even with the ringer switch off, like a voice note would.
    await setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
    setSpeaking(id);
    const done = () => {
      if (speakingId === id) setSpeaking(null);
    };
    Speech.speak(say, { rate: 1.02, onDone: done, onStopped: done, onError: done });
  } catch (err) {
    console.warn('[voice] speak failed', err);
    setSpeaking(null);
  }
}

export async function stopSpeaking() {
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
