import { setAudioModeAsync } from 'expo-audio';
import * as Speech from 'expo-speech';
import { useSyncExternalStore } from 'react';

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
    .slice(0, Speech.maxSpeechInputLength);
}

export async function speak(id: string, text: string) {
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
}

export function stopSpeaking() {
  if (speakingId) setSpeaking(null);
  return Speech.stop();
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
