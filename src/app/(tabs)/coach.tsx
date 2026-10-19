import type React from 'react';
import { AudioModule, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from 'expo-audio';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, FlatList, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeInDown, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EntryRow } from '@/components/entry-row';
import { GlassButton, Icon, type IconName } from '@/components/icon';
import { TagAvatar } from '@/components/tag-avatar';
import { Chip, T, tap } from '@/components/ui';
import { Backdrop, Comic } from '@/components/underground';
import { C, Gradients, MaxContentWidth, Radius, Space } from '@/constants/theme';
import { audioMime, pickImage, readBase64, VOICE_PRESET } from '@/lib/media';
import { actions, useStore } from '@/lib/store';
import type { ChatMessage, Entry } from '@/lib/types';
import { speak, stopSpeaking, useSpeakingId, voiceAvailable } from '@/lib/voice';

const SUGGESTIONS = [
  '😴 Slept badly, about 5 hours',
  '😤 Stressful day at work',
  '😄 Feeling great today',
  '☕ Flat white',
  '🥣 Oats with berries',
  '🍌 A banana',
  '🏃 30 min run',
  '🏋️ 45 min weights',
  '🚶 10k steps walk',
  '💧 Big glass of water',
  '📊 How am I doing today?',
  '💬 Plan me a 20 min home workout',
  '💬 How much protein do I need?',
  '💬 Best cardio for fat loss?',
  '💬 How do I fix sore legs?',
];

const MAX_RECORDING_S = 90;

export default function Coach() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ mode?: string; t?: string }>();
  const messages = useStore((s) => s.messages);
  const entries = useStore((s) => s.entries);
  const thinking = useStore((s) => s.thinking);
  const hasKey = useStore((s) => !!s.settings.apiKey);
  const voiceReplies = useStore((s) => s.settings.voiceReplies);
  const speakingId = useSpeakingId();

  const [text, setText] = useState('');
  const inputRef = useRef<React.ComponentRef<typeof TextInput>>(null);
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const didInitialScroll = useRef(false);

  const recorder = useAudioRecorder(VOICE_PRESET);
  const rec = useAudioRecorderState(recorder, 80);
  const recSeconds = Math.floor(rec.durationMillis / 1000);

  const entryById = useMemo(() => new Map(entries.map((e) => [e.id, e])), [entries]);

  // Recent meals become one-tap "again" chips — logging a repeat should take zero typing.
  const repeats = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const e of entries) {
      if (e.kind !== 'meal' && e.kind !== 'exercise') continue;
      const k = e.title.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(`${e.emoji} ${e.title}`);
      if (out.length >= 4) break;
    }
    return out;
  }, [entries]);

  // Deep-link actions from the Today screen's quick tiles.
  useEffect(() => {
    if (!params.t) return;
    if (params.mode === 'voice') startRecording();
    else if (params.mode === 'camera') sendPhoto('camera');
    else if (params.mode === 'type') setTimeout(() => inputRef.current?.focus(), 350);
    router.setParams({ mode: undefined, t: undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.t]);

  // Long voice notes are slow to upload and analyze, so cap them.
  useEffect(() => {
    if (rec.isRecording && recSeconds >= MAX_RECORDING_S) stopRecording(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rec.isRecording, recSeconds]);

  useEffect(() => {
    if (messages.length) setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
  }, [messages.length, thinking]);

  function guardKey() {
    if (hasKey) return true;
    Alert.alert('Connect Google AI', 'Add your Gemini API key in Profile to start logging.', [
      { text: 'Later', style: 'cancel' },
      { text: 'Open Profile', onPress: () => router.navigate('/profile') },
    ]);
    return false;
  }

  async function sendText(value = text) {
    if (!value.trim() || !guardKey()) return;
    tap();
    setText('');
    await actions.sendToCoach({ text: value });
  }

  async function sendPhoto(from: 'camera' | 'library') {
    if (!guardKey()) return;
    Keyboard.dismiss();
    const img = await pickImage(from);
    if (!img) return;
    const caption = text;
    setText('');
    await actions.sendToCoach({ text: caption, image: img });
  }

  async function startRecording() {
    if (!guardKey() || thinking) return;
    Keyboard.dismiss();
    stopSpeaking();
    try {
      const perm = await AudioModule.requestRecordingPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Microphone access needed', 'Enable microphone access in Settings to log by voice.');
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      tap();
    } catch (err) {
      console.warn('[voice] start failed', err);
      Alert.alert('Could not start recording', (err as Error).message);
    }
  }

  async function stopRecording(send: boolean) {
    try {
      await recorder.stop();
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      tap();
      const uri = recorder.uri;
      if (!send || !uri) return;
      if (rec.durationMillis < 700) return; // accidental tap
      const base64 = await readBase64(uri);
      const caption = text;
      setText('');
      await actions.sendToCoach({ audio: { base64, mimeType: audioMime(uri) }, text: caption || undefined });
    } catch (err) {
      console.warn('[voice] stop failed', err);
      Alert.alert('Could not send voice note', (err as Error).message);
    }
  }

  const empty = messages.length === 0;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Backdrop />
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TagAvatar size={48} band={C.violet} online={!thinking} letter="C" />
        <View style={{ flex: 1 }}>
          <Comic size={30}>COACH</Comic>
          <T size={12} rounded color={thinking ? C.lime : C.textDim}>
            {thinking ? 'ANALYZING…' : speakingId ? 'TALKING…' : 'LOG IT OR ASK ME ANYTHING.'}
          </T>
        </View>
        {voiceAvailable && (
          <GlassButton
            icon={voiceReplies ? 'speaker' : 'speakerOff'}
            size={38}
            color={voiceReplies ? C.lime : C.textDim}
            onPress={() => actions.setVoiceReplies(!voiceReplies)}
          />
        )}
        {!empty && (
          <GlassButton
            icon="trash"
            size={38}
            color={C.textDim}
            onPress={() =>
              Alert.alert('Clear conversation?', 'Your logged entries stay.', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Clear', style: 'destructive', onPress: actions.clearChat },
              ])
            }
          />
        )}
      </View>

      {empty ? (
        <ScrollView contentContainerStyle={styles.emptyWrap}>
          <LinearGradient colors={['#1B2130', '#10131B']} style={styles.emptyOrb}>
            <Icon name="sparkles" size={44} color={C.lime} animation={{ effect: { type: 'pulse' }, repeating: true }} />
          </LinearGradient>
          <T size={26} weight="800" rounded style={{ textAlign: 'center' }}>
            WHAT DID YOU EAT{'\n'}OR DO TODAY?
          </T>
          <T size={14} color={C.textDim} style={{ textAlign: 'center', maxWidth: 300 }}>
            No forms, no searching. Tap the mic and talk, or snap your plate or the treadmill screen. Ask me anything about training, food or recovery and I’ll talk back.
          </T>
          <View style={styles.bigActions}>
            <BigAction icon="mic" label="Talk" colors={Gradients.violet} onPress={startRecording} />
            <BigAction icon="camera" label="Snap" colors={Gradients.warm} onPress={() => sendPhoto('camera')} />
            <BigAction icon="photo" label="Library" colors={Gradients.cool} onPress={() => sendPhoto('library')} />
          </View>
        </ScrollView>
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.list}
          keyboardDismissMode="interactive"
          extraData={speakingId}
          onContentSizeChange={() => {
            // Open on the latest message, not the oldest.
            if (!didInitialScroll.current) {
              didInitialScroll.current = true;
              listRef.current?.scrollToEnd({ animated: false });
            }
          }}
          renderItem={({ item }) => <Bubble msg={item} entryById={entryById} speaking={speakingId === item.id} />}
        />
      )}

      {/* Composer */}
      <View style={[styles.composerWrap, { paddingBottom: 10 }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} keyboardShouldPersistTaps="handled">
          {repeats.map((r) => (
            <Chip key={`r-${r}`} icon="repeat" label={r} onPress={() => sendText(`Same again: ${r}`)} />
          ))}
          {SUGGESTIONS.map((s) => (
            <Chip key={s} label={s} onPress={() => sendText(s)} />
          ))}
        </ScrollView>

        {rec.isRecording ? (
          <RecordingBar seconds={recSeconds} metering={rec.metering} onCancel={() => stopRecording(false)} onSend={() => stopRecording(true)} />
        ) : (
          <View style={styles.composer}>
            <GlassButton icon="camera" onPress={() => sendPhoto('camera')} />
            <GlassButton icon="photo" onPress={() => sendPhoto('library')} />
            <TextInput
              ref={inputRef}
              value={text}
              onChangeText={setText}
              placeholder="Log a meal or ask me anything"
              placeholderTextColor={C.textMute}
              style={styles.input}
              multiline
              returnKeyType="send"
              submitBehavior="submit"
              onSubmitEditing={() => sendText()}
            />
            <Pressable
              onPress={() => (text.trim() ? sendText() : startRecording())}
              disabled={thinking}
              style={({ pressed }) => ({ opacity: thinking ? 0.5 : 1, transform: [{ scale: pressed ? 0.92 : 1 }] })}>
              <LinearGradient
                colors={text.trim() ? Gradients.brand : Gradients.violet}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.sendBtn}>
                <Icon name={text.trim() ? 'send' : 'mic'} size={20} weight="bold" color={text.trim() ? '#07080C' : '#fff'} />
              </LinearGradient>
            </Pressable>
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const PENDING_LABEL = { voice: 'Listening to your voice note', photo: 'Looking at your photo', text: 'Crunching the numbers' } as const;

function Bubble({ msg, entryById, speaking }: { msg: ChatMessage; entryById: Map<string, Entry>; speaking: boolean }) {
  const mine = msg.role === 'user';
  const logged = (msg.entryIds ?? []).map((id) => entryById.get(id)).filter(Boolean) as Entry[];

  if (mine) {
    return (
      <Animated.View entering={FadeInDown.duration(220)} style={{ alignItems: 'flex-end', gap: 6 }}>
        {msg.imageUri && <Image source={{ uri: msg.imageUri }} style={styles.photo} contentFit="cover" />}
        {!!msg.text && (
          <LinearGradient colors={Gradients.arcade} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={[styles.bubble, styles.mine]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              {msg.isVoice && <Icon name="mic" size={15} color="#07080C" />}
              <T size={15} weight="600" color="#07080C">
                {msg.text}
              </T>
            </View>
          </LinearGradient>
        )}
      </Animated.View>
    );
  }

  return (
    <Animated.View entering={FadeInDown.duration(260)} style={{ alignItems: 'flex-start', gap: 8, maxWidth: '92%' }}>
      <View style={[styles.bubble, styles.theirs, msg.error && { borderColor: C.danger + '88' }]}>
        {msg.pending ? (
          <PendingStatus since={msg.createdAt} label={PENDING_LABEL[msg.pendingKind ?? 'text']} />
        ) : msg.error ? (
          <View style={{ gap: 10 }}>
            <T size={15} color={C.danger} style={{ lineHeight: 21 }}>
              {msg.text}
            </T>
            {msg.retryable && (
              <Pressable
                onPress={() => {
                  tap();
                  actions.retry(msg.id);
                }}
                style={({ pressed }) => [styles.retry, pressed && { opacity: 0.7 }]}>
                <Icon name="retry" size={14} color="#07080C" weight="bold" />
                <T size={13} weight="800" color="#07080C">
                  Try again
                </T>
              </Pressable>
            )}
          </View>
        ) : (
          <T size={15} color={C.text} style={{ lineHeight: 21 }}>
            {msg.text}
          </T>
        )}
      </View>
      {voiceAvailable && !msg.pending && !msg.error && !!msg.text && (
        <Pressable
          hitSlop={8}
          onPress={() => {
            tap();
            if (speaking) stopSpeaking();
            else speak(msg.id, msg.text);
          }}
          style={({ pressed }) => [styles.listen, pressed && { opacity: 0.6 }]}>
          <Icon name={speaking ? 'stop' : 'speaker'} size={13} color={speaking ? C.lime : C.textMute} />
          <T size={11} weight="700" color={speaking ? C.lime : C.textMute} style={{ letterSpacing: 1 }}>
            {speaking ? 'STOP' : 'LISTEN'}
          </T>
        </Pressable>
      )}
      {logged.length > 0 && (
        <View style={{ gap: 6, alignSelf: 'stretch', minWidth: 280 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 4 }}>
            <Icon name="check" size={12} color={C.lime} weight="bold" />
            <T size={11} color={C.lime} weight="700" style={{ letterSpacing: 1 }}>
              LOGGED
            </T>
          </View>
          {logged.map((e) => (
            <EntryRow key={e.id} entry={e} compact />
          ))}
        </View>
      )}
    </Animated.View>
  );
}

/** Typing dots plus what we're doing and for how long, so a slow answer never looks frozen. */
function PendingStatus({ since, label }: { since: number; label: string }) {
  const [now, setNow] = useState(since);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const s = Math.max(0, Math.round((now - since) / 1000));
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <TypingDots />
        <T size={13} color={C.textDim} weight="600">
          {label}
          {s >= 3 ? ` · ${s}s` : '…'}
        </T>
      </View>
      {s >= 20 && (
        <T size={12} color={C.textMute}>
          Gemini is slow right now — I’ll keep trying for a bit.
        </T>
      )}
    </View>
  );
}

function TypingDots() {
  return (
    <View style={{ flexDirection: 'row', gap: 5, paddingVertical: 6, paddingHorizontal: 2 }}>
      {[0, 1, 2].map((i) => (
        <Dot key={i} delay={i * 150} />
      ))}
    </View>
  );
}

function Dot({ delay }: { delay: number }) {
  const v = useSharedValue(0.3);
  useEffect(() => {
    const id = setTimeout(() => {
      v.value = withRepeat(withSequence(withTiming(1, { duration: 350 }), withTiming(0.3, { duration: 350 })), -1);
    }, delay);
    return () => clearTimeout(id);
  }, [delay, v]);
  const style = useAnimatedStyle(() => ({ opacity: v.value, transform: [{ scale: 0.8 + v.value * 0.3 }] }));
  return <Animated.View style={[{ width: 7, height: 7, borderRadius: 4, backgroundColor: C.lime }, style]} />;
}

function RecordingBar({ seconds, metering, onCancel, onSend }: { seconds: number; metering?: number; onCancel: () => void; onSend: () => void }) {
  // Rolling waveform from mic metering (dBFS, roughly -60..0).
  const [levels, setLevels] = useState<number[]>(() => Array(28).fill(0.1));
  const [lastMeter, setLastMeter] = useState(metering);
  if (metering !== lastMeter) {
    setLastMeter(metering);
    const lvl = metering == null ? 0.2 : Math.max(0.08, Math.min(1, (metering + 55) / 50));
    setLevels([...levels.slice(1), lvl]);
  }
  const left = MAX_RECORDING_S - seconds;

  return (
    <View style={styles.recBar}>
      <GlassButton icon="close" size={38} color={C.textDim} onPress={onCancel} />
      <View style={styles.wave}>
        {levels.map((l, i) => (
          <View key={i} style={{ width: 3, borderRadius: 2, height: 4 + l * 30, backgroundColor: C.violet, opacity: 0.4 + (i / levels.length) * 0.6 }} />
        ))}
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <T size={14} weight="700" color={C.pink} rounded>
          {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}
        </T>
        {left <= 15 && (
          <T size={10} color={C.textMute} weight="600">
            {left}s left
          </T>
        )}
      </View>
      <Pressable onPress={onSend} style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.92 : 1 }] })}>
        <LinearGradient colors={Gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.sendBtn}>
          <Icon name="check" size={20} weight="bold" color="#07080C" />
        </LinearGradient>
      </Pressable>
    </View>
  );
}

function BigAction({ icon, label, colors, onPress }: { icon: IconName; label: string; colors: readonly [string, string]; onPress: () => void }) {
  return (
    <Pressable
      onPress={() => {
        tap();
        onPress();
      }}
      style={({ pressed }) => ({ alignItems: 'center', gap: 10, transform: [{ scale: pressed ? 0.94 : 1 }] })}>
      <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.bigAction}>
        <LinearGradient colors={['rgba(255,255,255,0.35)', 'rgba(255,255,255,0)']} style={styles.gloss} />
        <Icon name={icon} size={32} color="#fff" weight="bold" />
      </LinearGradient>
      <T size={13} weight="700" color={C.textDim}>
        {label}
      </T>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: Space.md,
    paddingBottom: 12,
    borderBottomWidth: 3,
    borderBottomColor: '#5E6468',
    backgroundColor: 'rgba(22,24,26,0.9)',
  },
  avatar: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  list: { padding: Space.md, gap: 14, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  emptyWrap: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: Space.lg, gap: 12 },
  emptyOrb: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: C.lime + '33',
    marginBottom: 6,
  },
  bigActions: { flexDirection: 'row', gap: 22, marginTop: Space.lg },
  bigAction: { width: 76, height: 76, borderRadius: 26, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  gloss: { position: 'absolute', top: 0, left: 0, right: 0, height: '55%' },
  bubble: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, maxWidth: '85%' },
  mine: { borderBottomRightRadius: 4, borderWidth: 2.5, borderColor: C.ink, borderBottomWidth: 5 },
  theirs: { backgroundColor: '#262A2E', borderBottomLeftRadius: 4, borderWidth: 2.5, borderColor: '#5E6468', maxWidth: '100%' },
  photo: { width: 200, height: 200, borderRadius: 20 },
  listen: { flexDirection: 'row', alignItems: 'center', gap: 5, marginLeft: 6, marginTop: -2 },
  retry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: C.lime,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.pill,
  },
  composerWrap: { borderTopWidth: 3, borderTopColor: '#5E6468', backgroundColor: 'rgba(22,24,26,0.96)', gap: 10, paddingTop: 10 },
  chips: { gap: 8, paddingHorizontal: Space.md },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: Space.md },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    backgroundColor: '#0F1112',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    color: C.text,
    fontSize: 15,
    borderWidth: 2,
    borderColor: '#5E6468',
  },
  sendBtn: { width: 44, height: 44, borderRadius: 12, borderWidth: 2.5, borderColor: C.ink, alignItems: 'center', justifyContent: 'center' },
  recBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: Space.md,
    paddingLeft: 4,
    backgroundColor: C.surface,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: C.violet + '66',
  },
  wave: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 3, height: 44, overflow: 'hidden' },
});
