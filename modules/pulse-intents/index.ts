import { requireOptionalNativeModule } from 'expo';

// Requests from Siri, Shortcuts, the Action Button or Back Tap (see plugins/app-intents). Missing on
// Android, web and builds made before the module existed, so every call is optional.
type Native = {
  takePendingLink(): string | null;
  addListener(event: 'onLink', listener: (e: { url: string }) => void): { remove(): void };
};

const native = requireOptionalNativeModule<Native>('PulseIntents');

/** The latest shortcut request as a pulse:// link, taken once; null when there is none. */
export function takePendingLink(): string | null {
  return native?.takePendingLink() ?? null;
}

/** Calls `listener` with each shortcut request that arrives while the app is running. */
export function onShortcutLink(listener: (url: string) => void) {
  const sub = native?.addListener('onLink', (e) => listener(e.url));
  return () => sub?.remove();
}
