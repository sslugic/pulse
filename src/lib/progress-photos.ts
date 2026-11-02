import type { PhotoAngle } from './gemini';
import { dayKey } from './nutrition';
import type { ProgressPhoto } from './store';

/** Angles that make a fair before/after; "other" (close-ups, not a body) never gets compared. */
export const COMPARE_ANGLES = ['front', 'side', 'back'] as const;
export type CompareAngle = (typeof COMPARE_ANGLES)[number];

/** Photos of one angle, oldest first. Until any photo is sorted, every photo counts as one group. */
export function ofAngle(photos: ProgressPhoto[], angle: CompareAngle | null) {
  return angle ? photos.filter((p) => p.angle === angle) : photos;
}

const spansDays = (list: ProgressPhoto[]) => list.length >= 2 && dayKey(list[0].at) !== dayKey(list[list.length - 1].at);

/** Angles with photos from at least two different days. */
export function comparableAngles(photos: ProgressPhoto[]): CompareAngle[] {
  return COMPARE_ANGLES.filter((a) => spansDays(ofAngle(photos, a)));
}

/**
 * The angle to compare by default: of the angles in the newest day's photos that can be compared,
 * front first, then side, then back; else the first angle that can be compared. Null means compare
 * everything as one group (nothing sorted yet).
 */
export function defaultAngle(photos: ProgressPhoto[]): CompareAngle | null {
  const ok = comparableAngles(photos);
  if (!ok.length) return null;
  const sorted = photos.filter((p) => p.angle && (ok as string[]).includes(p.angle));
  const newestDay = sorted.length ? dayKey(sorted[sorted.length - 1].at) : '';
  const latest = new Set(sorted.filter((p) => dayKey(p.at) === newestDay).map((p) => p.angle));
  return ok.find((a) => latest.has(a)) ?? ok[0];
}

/**
 * Latest photo vs an earlier one of the same angle: the oldest by default, or the photo nearest
 * the chosen day. Never two photos from the same day.
 */
export function comparePair(photos: ProgressPhoto[], angle: CompareAngle | null, fromDay?: string) {
  const list = ofAngle(photos, angle);
  const after = list[list.length - 1];
  if (!after) return null;
  const earlier = list.filter((p) => dayKey(p.at) !== dayKey(after.at));
  if (!earlier.length) return null;
  let before = earlier[0];
  if (fromDay) {
    const target = new Date(fromDay + 'T12:00').getTime();
    before = earlier.reduce((best, p) => (Math.abs(p.at - target) < Math.abs(best.at - target) ? p : best), before);
  }
  return { before, after };
}

/** Days with photos of this angle, newest first, without the latest photo's day (it's always "now"). */
export function fromDays(photos: ProgressPhoto[], angle: CompareAngle | null) {
  const list = ofAngle(photos, angle);
  const last = list[list.length - 1];
  const days = [...new Set(list.map((p) => dayKey(p.at)))].filter((d) => !last || d !== dayKey(last.at));
  return days.reverse();
}

/** Photos grouped by day, newest day first; photos within a day in the order they were added. */
export function byDay(photos: ProgressPhoto[]) {
  const groups = new Map<string, ProgressPhoto[]>();
  for (const p of photos) groups.set(dayKey(p.at), [...(groups.get(dayKey(p.at)) ?? []), p]);
  return [...groups.entries()].reverse();
}

export type { PhotoAngle };
