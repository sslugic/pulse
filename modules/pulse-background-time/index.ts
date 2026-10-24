import { requireOptionalNativeModule } from 'expo';

// Extra background time for a request in flight (iOS). Missing on Android, web and builds made
// before the module existed, where the work just runs as usual.
type Native = {
  begin(): Promise<number>;
  end(id: number): Promise<void>;
};

const native = requireOptionalNativeModule<Native>('PulseBackgroundTime');

/** Runs work, asking iOS to keep the app running for a while if it leaves the foreground meanwhile. */
export async function withBackgroundTime<T>(work: () => Promise<T>): Promise<T> {
  const id = await native?.begin().catch(() => undefined);
  try {
    return await work();
  } finally {
    if (id != null) native?.end(id).catch(() => {});
  }
}
