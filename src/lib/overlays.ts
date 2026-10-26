import { useEffect, useSyncExternalStore } from 'react';

// Which full-screen pop-ups are up right now (a chest opening, the rewards offer), so other pop-ups
// wait their turn: iOS shows only one modal at a time and drops a second one silently.

const open = new Set<string>();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** Marks a pop-up as showing while `on` is true. */
export function useOverlay(name: string, on: boolean) {
  useEffect(() => {
    if (!on) return;
    open.add(name);
    emit();
    return () => {
      open.delete(name);
      emit();
    };
  }, [name, on]);
}

/** True while a pop-up other than `self` is showing. */
export function useOverlayBusy(self?: string) {
  return useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => [...open].some((n) => n !== self),
  );
}

/** The same, read once (for timers). */
export const overlayBusy = (self?: string) => [...open].some((n) => n !== self);

// ---------- Restores ----------

const restored = new Set<() => void>();
/** Called after a backup replaces this phone's data. */
export const notifyRestored = () => restored.forEach((l) => l());
export function onRestored(l: () => void) {
  restored.add(l);
  return () => {
    restored.delete(l);
  };
}
