import { AudioQuality, IOSOutputFormat, type RecordingOptions } from 'expo-audio';
import { File } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { Alert, Platform } from 'react-native';

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
      Alert.alert('Camera access needed', 'Enable camera access in Settings to snap meals and workouts.');
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
