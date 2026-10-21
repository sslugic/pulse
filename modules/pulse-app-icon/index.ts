import { requireOptionalNativeModule } from 'expo';

// The app icon switcher (iOS). Missing on Android, web and builds made before the module existed.
type Native = {
  supported(): Promise<boolean>;
  current(): Promise<string | null>;
  set(name: string | null): Promise<void>;
};

const native = requireOptionalNativeModule<Native>('PulseAppIcon');

/** True when this device can change the app icon. */
export const appIconSupported = async () => (native ? native.supported() : false);

/** The alternate icon in use (asset catalog name), or null for the main one. */
export const currentAppIcon = async () => (native ? native.current() : null);

/** Switches the app icon; null goes back to the main one. */
export async function setAppIcon(name: string | null) {
  if (!native) throw new Error('App icons can’t be changed in this build.');
  await native.set(name);
}
