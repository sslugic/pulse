import AsyncStorage from '@react-native-async-storage/async-storage';
import * as StoreReview from 'expo-store-review';

const KEY = 'pulse:review-asked:v1';
const GAP_MS = 90 * 24 * 60 * 60 * 1000;

/**
 * Asks for an App Store rating at a high point (a 7+ day streak, a strong weekly recap), at most
 * once every 90 days. iOS decides whether the sheet actually shows and caps it at three a year,
 * so this never nags; it only picks good moments to let iOS ask.
 */
export async function askForReviewAtHighPoint(delayMs = 1500) {
  try {
    const last = Number((await AsyncStorage.getItem(KEY)) ?? 0);
    if (Date.now() - last < GAP_MS) return;
    if (!(await StoreReview.hasAction())) return;
    await AsyncStorage.setItem(KEY, String(Date.now()));
    // Let the screen that earned it settle first, so the sheet doesn't cut off an animation.
    setTimeout(() => StoreReview.requestReview().catch(() => {}), delayMs);
  } catch {
    // A rating prompt is never worth an error.
  }
}
