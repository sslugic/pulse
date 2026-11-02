import { AudioQuality, IOSOutputFormat, type RecordingOptions } from 'expo-audio';
import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Alert, Platform } from 'react-native';

import { t } from './i18n';

// 16 kHz mono WAV on iOS: tiny for short voice notes and a format Gemini reads natively.
export const VOICE_PRESET: RecordingOptions = {
  extension: Platform.OS === 'ios' ? '.wav' : '.m4a',
  sampleRate: 16000,
  numberOfChannels: 1,
  bitRate: 64000,
  isMeteringEnabled: true,
  android: { outputFormat: 'mpeg4', audioEncoder: 'aac' },
  ios: {
    outputFormat: IOSOutputFormat.LINEARPCM,
    audioQuality: AudioQuality.HIGH,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  web: { mimeType: 'audio/webm', bitsPerSecond: 64000 },
};

export function audioMime(uri: string) {
  if (uri.endsWith('.wav')) return 'audio/wav';
  if (uri.endsWith('.webm')) return 'audio/webm';
  if (uri.endsWith('.mp3')) return 'audio/mp3';
  return 'audio/aac';
}

export async function readBase64(uri: string) {
  if (Platform.OS === 'web') {
    const blob = await (await fetch(uri)).blob();
    return await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result).split(',')[1] ?? '');
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
  }
  return new File(uri).base64();
}

export interface PickedImage {
  uri: string;
  base64: string;
  mimeType: string;
}

export async function pickImage(from: 'camera' | 'library'): Promise<PickedImage | null> {
  const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.5, base64: true, allowsEditing: false };
  let res: ImagePicker.ImagePickerResult;
  if (from === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(t('errors.cameraTitle'), t('errors.cameraBody'));
      return null;
    }
    try {
      res = await ImagePicker.launchCameraAsync(opts);
    } catch {
      // No camera (e.g. Simulator): fall back to the photo library.
      res = await ImagePicker.launchImageLibraryAsync(opts);
    }
  } else {
    res = await ImagePicker.launchImageLibraryAsync(opts);
  }
  if (res.canceled || !res.assets?.[0]) return null;
  const a = res.assets[0];
  const base64 = a.base64 ?? (await readBase64(a.uri));
  return { uri: a.uri, base64, mimeType: a.mimeType ?? 'image/jpeg' };
}

/**
 * Progress photos: several at once from the library, or one from the camera. Returns file URIs only;
 * the photos are copied into the app and shrunk for AI separately.
 */
export async function pickProgressPhotos(from: 'camera' | 'library'): Promise<string[]> {
  const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.7, allowsEditing: false };
  let res: ImagePicker.ImagePickerResult;
  if (from === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(t('errors.cameraTitle'), t('errors.cameraBody'));
      return [];
    }
    try {
      res = await ImagePicker.launchCameraAsync(opts);
    } catch {
      // No camera (e.g. Simulator): fall back to the photo library.
      res = await ImagePicker.launchImageLibraryAsync({ ...opts, allowsMultipleSelection: true, selectionLimit: 20 });
    }
  } else {
    res = await ImagePicker.launchImageLibraryAsync({ ...opts, allowsMultipleSelection: true, selectionLimit: 20 });
  }
  return res.canceled ? [] : (res.assets ?? []).map((a) => a.uri);
}

/** A small JPEG of a photo for AI requests: fewer tokens, same picture. */
export async function shrinkForAi(uri: string, width = 768): Promise<{ base64: string; mimeType: string }> {
  if (Platform.OS === 'web') return { base64: await readBase64(uri), mimeType: 'image/jpeg' };
  const img = await ImageManipulator.manipulate(uri).resize({ width }).renderAsync();
  const out = await img.saveAsync({ format: SaveFormat.JPEG, compress: 0.7, base64: true });
  return { base64: out.base64 ?? (await readBase64(out.uri)), mimeType: 'image/jpeg' };
}

/** Saves an AI-drawn image next to the progress photos and returns its relative path. */
export async function saveProgressImage(base64: string, mimeType: string, id: string): Promise<string> {
  const ext = mimeType.includes('png') ? 'png' : 'jpg';
  if (Platform.OS === 'web') return `data:${mimeType};base64,${base64}`;
  const dir = new Directory(Paths.document, 'progress');
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  const name = `progress/${id}.${ext}`;
  await new File(Paths.document, name).write(base64, { encoding: 'base64' });
  return name;
}

// Journal photos live in documents/journal. We store the relative path because the absolute
// container path changes when iOS updates the app.
export async function saveJournalPhoto(uri: string, id: string): Promise<string> {
  if (Platform.OS === 'web') return uri;
  const dir = new Directory(Paths.document, 'journal');
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  const name = `journal/${id}.jpg`;
  await new File(uri).copy(new File(Paths.document, name));
  return name;
}

/** Progress photos live in documents/progress and never leave the device. */
export async function saveProgressPhoto(uri: string, id: string): Promise<string> {
  if (Platform.OS === 'web') return uri;
  const dir = new Directory(Paths.document, 'progress');
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  const name = `progress/${id}.jpg`;
  await new File(uri).copy(new File(Paths.document, name));
  return name;
}

export function journalPhotoUri(photo: string) {
  if (Platform.OS === 'web' || /^[a-z]+:/i.test(photo)) return photo;
  return new File(Paths.document, photo).uri;
}

export function deleteJournalPhoto(photo: string) {
  if (Platform.OS === 'web' || /^[a-z]+:/i.test(photo)) return;
  try {
    const f = new File(Paths.document, photo);
    if (f.exists) f.delete();
  } catch {
    // already gone
  }
}
