import { Directory, File, Paths } from 'expo-file-system';

import { MUSIC_BASE_URL, TRACK_FILES, trackById, type TrackId } from './music';

// Tracks that don't ship with the app are saved to the phone the first time they're played, so they
// loop offline afterwards. Until then they stream from the Pulse website. A download only lands once
// it's complete, so a dropped connection never leaves a broken file behind.

const downloading = new Map<TrackId, Promise<void>>();

// Made on demand: the release build also evaluates this module for its web/server manifest, where
// the file system isn't available.
const musicDir = () => new Directory(Paths.document, 'music');
const fileFor = (name: string) => new File(musicDir(), `${name}.wav`);

/** What expo-audio should play for a track: bundled asset, saved file, or the website (streaming). */
export function trackSource(id: TrackId): number | string {
  const bundled = TRACK_FILES[id];
  if (bundled != null) return bundled;
  const name = trackById(id).file!;
  const saved = fileFor(name);
  return saved.exists ? saved.uri : `${MUSIC_BASE_URL}/${name}.wav`;
}

/** Saves a downloadable track to the phone (once). Safe to call repeatedly. */
export function saveTrack(id: TrackId): Promise<void> {
  const name = trackById(id).file;
  if (!name || fileFor(name).exists) return Promise.resolve();
  let job = downloading.get(id);
  if (!job) {
    job = (async () => {
      musicDir().create({ idempotent: true, intermediates: true });
      await File.downloadFileAsync(`${MUSIC_BASE_URL}/${name}.wav`, fileFor(name), { idempotent: true });
    })()
      .catch((err) => console.warn('[music] download failed', id, err))
      .finally(() => downloading.delete(id));
    downloading.set(id, job);
  }
  return job;
}
