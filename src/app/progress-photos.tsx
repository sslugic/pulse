import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassButton, Icon } from '@/components/icon';
import { Card, SectionTitle, T, tap } from '@/components/ui';
import { ArcadeButton, Backdrop, Comic } from '@/components/underground';
import { C, Gradients, MaxContentWidth, Space } from '@/constants/theme';
import { journalPhotoUri } from '@/lib/media';
import { fmtKg } from '@/lib/nutrition';
import { actions, useStore } from '@/lib/store';

const date = (t: number) => new Date(t).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });

/** Private body-progress photos: a before/now slider and a timeline. Stored on this phone only. */
export default function ProgressPhotosScreen() {
  const insets = useSafeAreaInsets();
  const photos = useStore((s) => s.photos);
  const units = useStore((s) => s.profile.units);
  const [before, setBefore] = useState<string | null>(null);
  const first = photos.find((p) => p.id === before) ?? photos[0];
  const last = photos[photos.length - 1];

  const remove = (id: string) =>
    Alert.alert('Delete photo?', 'It’s removed from this phone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => actions.removeProgressPhoto(id) },
    ]);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Backdrop />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <T size={13} color={C.textDim} weight="600">
              Private · stored only on this phone
            </T>
            <Comic size={36}>PROGRESS PICS</Comic>
          </View>
          <GlassButton icon="close" onPress={() => router.back()} />
        </View>

        <View style={{ flexDirection: 'row', gap: 10 }}>
          <ArcadeButton label="TAKE" size="md" onPress={() => actions.addProgressPhoto('camera')} icon={<Icon name="camera" size={20} color="#FF7A1A" weight="bold" />} style={{ flex: 1 }} />
          <ArcadeButton label="LIBRARY" size="md" colors={Gradients.cool} textColor="#fff" onPress={() => actions.addProgressPhoto('library')} icon={<Icon name="photo" size={20} color="#fff" weight="bold" />} style={{ flex: 1 }} />
        </View>

        {photos.length === 0 ? (
          <Card style={{ alignItems: 'center', gap: 8, paddingVertical: Space.xl, marginTop: Space.sm }}>
            <T size={40}>📸</T>
            <T size={13} color={C.textDim} style={{ textAlign: 'center', lineHeight: 19 }}>
              Take a photo every week or two in the same spot and light. Your before and now appear side by side here.
            </T>
          </Card>
        ) : (
          <>
            {photos.length >= 2 && first && last && first.id !== last.id && (
              <>
                <SectionTitle>Before · Now</SectionTitle>
                <Compare beforeUri={journalPhotoUri(first.path)} afterUri={journalPhotoUri(last.path)} />
                <View style={styles.between}>
                  <T size={12} rounded color={C.textDim}>
                    {date(first.at)}
                    {first.weightKg ? ` · ${fmtKg(first.weightKg, units)}` : ''}
                  </T>
                  <T size={12} rounded color={C.lime}>
                    {date(last.at)}
                    {last.weightKg ? ` · ${fmtKg(last.weightKg, units)}` : ''}
                  </T>
                </View>
                <T size={11} color={C.textMute}>
                  Drag across the photo to compare. Tap any photo below to use it as “before”.
                </T>
              </>
            )}
            <SectionTitle right={<T size={12} rounded color={C.textMute}>{photos.length} PHOTOS</T>}>Timeline</SectionTitle>
            <View style={styles.grid}>
              {photos
                .slice()
                .reverse()
                .map((p) => (
                  <Pressable
                    key={p.id}
                    onPress={() => {
                      tap();
                      setBefore(p.id);
                    }}
                    onLongPress={() => remove(p.id)}
                    style={[styles.cell, p.id === first?.id && photos.length > 1 && { borderColor: C.cyan }]}>
                    <Image source={{ uri: journalPhotoUri(p.path) }} style={StyleSheet.absoluteFill} contentFit="cover" />
                    <View style={styles.cellLabel}>
                      <T size={10} rounded color={C.text}>
                        {new Date(p.at).toLocaleDateString([], { month: 'short', day: 'numeric' }).toUpperCase()}
                      </T>
                    </View>
                  </Pressable>
                ))}
            </View>
            <T size={11} color={C.textMute}>
              Long-press a photo to delete it.
            </T>
          </>
        )}
      </ScrollView>
    </View>
  );
}

/** Two photos stacked; dragging moves the divider that reveals "before" on the left. */
function Compare({ beforeUri, afterUri }: { beforeUri: string; afterUri: string }) {
  const [w, setW] = useState(0);
  const [split, setSplit] = useState(0.5);
  const move = (x: number) => {
    if (w) setSplit(Math.min(1, Math.max(0, x / w)));
  };
  return (
    <View
      style={styles.compare}
      onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderGrant={(e) => move(e.nativeEvent.locationX)}
      onResponderMove={(e) => move(e.nativeEvent.locationX)}>
      <Image source={{ uri: afterUri }} style={StyleSheet.absoluteFill} contentFit="cover" />
      <View style={[StyleSheet.absoluteFill, { width: `${split * 100}%`, overflow: 'hidden' }]} pointerEvents="none">
        <Image source={{ uri: beforeUri }} style={{ width: w, height: '100%' }} contentFit="cover" />
      </View>
      <View style={[styles.divider, { left: `${split * 100}%` }]} pointerEvents="none">
        <View style={styles.knob}>
          <Icon name="back" size={10} color={C.ink} weight="bold" />
          <Icon name="chevron" size={10} color={C.ink} weight="bold" />
        </View>
      </View>
      <View style={[styles.tag, { left: 8 }]} pointerEvents="none">
        <T size={10} rounded color={C.ink}>
          BEFORE
        </T>
      </View>
      <View style={[styles.tag, { right: 8, backgroundColor: C.lime }]} pointerEvents="none">
        <T size={10} rounded color={C.ink}>
          NOW
        </T>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: Space.md, paddingTop: Space.lg, gap: Space.sm, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: Space.sm },
  between: { flexDirection: 'row', justifyContent: 'space-between' },
  compare: { height: 420, borderRadius: 12, overflow: 'hidden', borderWidth: 3, borderColor: C.ink, backgroundColor: '#111' },
  divider: { position: 'absolute', top: 0, bottom: 0, width: 3, marginLeft: -1.5, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  knob: { flexDirection: 'row', width: 34, height: 34, borderRadius: 17, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: C.ink },
  tag: { position: 'absolute', top: 8, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 4, backgroundColor: C.yellow },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cell: { width: '31.5%', aspectRatio: 3 / 4, borderRadius: 8, overflow: 'hidden', borderWidth: 3, borderColor: C.ink, backgroundColor: '#111' },
  cellLabel: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 4, backgroundColor: 'rgba(11,12,13,0.7)' },
});
