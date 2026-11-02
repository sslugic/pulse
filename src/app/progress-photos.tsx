import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassButton, Icon } from '@/components/icon';
import { Card, Chip, SectionTitle, T, tap } from '@/components/ui';
import { ArcadeButton, Backdrop, Comic } from '@/components/underground';
import { C, Gradients, MaxContentWidth, Space } from '@/constants/theme';
import { AiError } from '@/lib/gemini';
import { locale, t } from '@/lib/i18n';
import { journalPhotoUri } from '@/lib/media';
import { dayKey, fmtKg } from '@/lib/nutrition';
import { byDay, comparableAngles, comparePair, defaultAngle, fromDays, type CompareAngle, type PhotoAngle } from '@/lib/progress-photos';
import { actions, canUseAI, useStore, type ProgressPhoto } from '@/lib/store';
import { useTodayKey } from '@/lib/use-today';

type Tab = 'compare' | 'photos' | 'retro';

const date = (ms: number) => new Date(ms).toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' });
const shortDay = (k: string) => new Date(k + 'T12:00').toLocaleDateString(locale, { month: 'short', day: 'numeric' }).toLocaleUpperCase(locale);
const ANGLE_LABEL: Record<PhotoAngle, string> = { front: t('photos.angleFront'), side: t('photos.angleSide'), back: t('photos.angleBack'), other: t('photos.angleOther') };

const shiftDay = (k: string, by: number) => {
  const d = new Date(k + 'T12:00');
  d.setDate(d.getDate() + by);
  return dayKey(d);
};

/**
 * Private body-progress photos. Compare puts the latest photo next to an earlier one of the same
 * angle; Photos adds several at once to any day; Retro shows the same comparison as cartoons.
 * Photos are stored on this phone; the AI only sees small copies to sort angles and draw cartoons.
 */
export default function ProgressPhotosScreen() {
  const insets = useSafeAreaInsets();
  const photos = useStore((s) => s.photos);
  const units = useStore((s) => s.profile.units);
  const todayKey = useTodayKey();
  const [tab, setTab] = useState<Tab>(() => (comparePair(photos, defaultAngle(photos)) ? 'compare' : 'photos'));
  const [angle, setAngle] = useState<CompareAngle | null | undefined>(undefined);
  const [from, setFrom] = useState<string | undefined>(undefined);
  const [addDay, setAddDay] = useState(todayKey);

  // Photos from before angle sorting existed get sorted the first time this screen opens.
  useEffect(() => {
    void actions.sortPhotoAngles();
  }, []);

  const angles = useMemo(() => comparableAngles(photos), [photos]);
  // Follow the smart default until the user picks an angle, and drop a pick that no longer has a pair.
  const active = angle !== undefined && (angle === null ? !angles.length : angles.includes(angle)) ? angle : defaultAngle(photos);
  const pair = useMemo(() => comparePair(photos, active, from), [photos, active, from]);
  const days = useMemo(() => fromDays(photos, active), [photos, active]);
  const sorting = canUseAI() && photos.some((p) => !p.angle);

  const add = async (source: 'camera' | 'library') => {
    const n = await actions.addProgressPhotos(source, addDay);
    if (n) setFrom(undefined);
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Backdrop />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <T size={13} color={C.textDim} weight="600">
              {t('photos.subtitle')}
            </T>
            <Comic size={36}>{t('photos.title')}</Comic>
          </View>
          <GlassButton icon="close" onPress={() => router.back()} />
        </View>

        <View style={styles.tabs}>
          {(['compare', 'photos', 'retro'] as const).map((k) => (
            <Pressable
              key={k}
              onPress={() => {
                tap();
                setTab(k);
              }}
              style={[styles.tab, tab === k && styles.tabOn]}
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === k }}>
              <T size={12} rounded color={tab === k ? C.ink : C.textDim}>
                {t(`photos.tab_${k}`)}
              </T>
            </Pressable>
          ))}
        </View>

        {(tab === 'compare' || tab === 'retro') && (
          <>
            {angles.length > 0 && (
              <View style={styles.row}>
                {angles.map((a) => (
                  <Chip
                    key={a}
                    label={ANGLE_LABEL[a]}
                    active={active === a}
                    onPress={() => {
                      setAngle(a);
                      setFrom(undefined);
                    }}
                  />
                ))}
              </View>
            )}
            {!pair ? (
              <Card style={styles.empty}>
                <T size={40}>📸</T>
                <T size={13} color={C.textDim} style={styles.emptyText}>
                  {photos.length ? t('photos.needTwoDays') : t('photos.emptyBody')}
                </T>
                <ArcadeButton label={t('photos.addPhotos')} size="md" onPress={() => setTab('photos')} />
              </Card>
            ) : tab === 'compare' ? (
              <>
                <Compare beforeUri={journalPhotoUri(pair.before.path)} afterUri={journalPhotoUri(pair.after.path)} />
                <PairCaption before={pair.before} after={pair.after} units={units} />
                <FromPicker days={days} value={from} onChange={setFrom} />
                <T size={11} color={C.textMute}>
                  {sorting ? t('photos.sorting') : active ? t('photos.smartHint', { angle: ANGLE_LABEL[active].toLocaleLowerCase(locale) }) : t('photos.compareHint')}
                </T>
              </>
            ) : (
              <RetroPair before={pair.before} after={pair.after} units={units} days={days} from={from} onFrom={setFrom} />
            )}
          </>
        )}

        {tab === 'photos' && (
          <>
            <Card style={styles.dayCard}>
              <T size={11} rounded color={C.textDim}>
                {t('photos.addingTo')}
              </T>
              <View style={styles.dayRow}>
                <GlassButton icon="back" onPress={() => setAddDay((d) => shiftDay(d, -1))} />
                <T size={18} rounded color={addDay === todayKey ? C.lime : C.text} style={{ flex: 1, textAlign: 'center' }}>
                  {addDay === todayKey ? t('common.today') : addDay === shiftDay(todayKey, -1) ? t('common.yesterday') : shortDay(addDay)}
                </T>
                <View style={{ opacity: addDay >= todayKey ? 0.3 : 1 }} pointerEvents={addDay >= todayKey ? 'none' : 'auto'}>
                  <GlassButton icon="chevron" onPress={() => setAddDay((d) => shiftDay(d, 1))} />
                </View>
              </View>
              <View style={styles.row}>
                <ArcadeButton label={t('photos.take')} size="md" onPress={() => add('camera')} icon={<Icon name="camera" size={20} color="#FF7A1A" weight="bold" />} style={{ flex: 1 }} />
                <ArcadeButton label={t('photos.library')} size="md" colors={Gradients.cool} textColor="#fff" onPress={() => add('library')} icon={<Icon name="photo" size={20} color="#fff" weight="bold" />} style={{ flex: 1 }} />
              </View>
              <T size={11} color={C.textMute}>
                {t('photos.multiHint')}
              </T>
            </Card>
            {photos.length === 0 ? (
              <Card style={styles.empty}>
                <T size={40}>📸</T>
                <T size={13} color={C.textDim} style={styles.emptyText}>
                  {t('photos.emptyBody')}
                </T>
              </Card>
            ) : (
              <>
                {byDay(photos).map(([k, list]) => (
                  <View key={k} style={{ gap: 8 }}>
                    <SectionTitle right={<T size={12} rounded color={C.textMute}>{t('photos.count', { count: list.length })}</T>}>
                      {k === todayKey ? t('common.today') : shortDay(k)}
                    </SectionTitle>
                    <View style={styles.grid}>
                      {list.map((p) => (
                        <PhotoCell key={p.id} photo={p} />
                      ))}
                    </View>
                  </View>
                ))}
                <T size={11} color={C.textMute}>
                  {t('photos.cellHint')}
                </T>
              </>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function PairCaption({ before, after, units }: { before: ProgressPhoto; after: ProgressPhoto; units: 'metric' | 'imperial' }) {
  return (
    <View style={styles.between}>
      <T size={12} rounded color={C.textDim}>
        {date(before.at)}
        {before.weightKg ? ` · ${fmtKg(before.weightKg, units)}` : ''}
      </T>
      <T size={12} rounded color={C.lime}>
        {date(after.at)}
        {after.weightKg ? ` · ${fmtKg(after.weightKg, units)}` : ''}
      </T>
    </View>
  );
}

/** "Compare from": the oldest photo by default, or any earlier day with a photo of this angle. */
function FromPicker({ days, value, onChange }: { days: string[]; value?: string; onChange: (d: string | undefined) => void }) {
  if (days.length < 2) return null;
  return (
    <View style={{ gap: 6 }}>
      <T size={11} rounded color={C.textDim}>
        {t('photos.compareFrom')}
      </T>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
        <Chip label={t('photos.oldest')} active={!value} onPress={() => onChange(undefined)} />
        {days.map((d) => (
          <Chip key={d} label={shortDay(d)} active={value === d} onPress={() => onChange(d)} />
        ))}
      </ScrollView>
    </View>
  );
}

const ANGLE_OPTIONS: PhotoAngle[] = ['front', 'side', 'back', 'other'];

function PhotoCell({ photo }: { photo: ProgressPhoto }) {
  const remove = () =>
    Alert.alert(t('photos.deleteTitle'), t('photos.deleteMessage'), [
      { text: t('photos.cancel'), style: 'cancel' },
      { text: t('photos.delete'), style: 'destructive', onPress: () => actions.removeProgressPhoto(photo.id) },
    ]);
  // Tap to fix the angle if the AI got it wrong (or it couldn't sort it).
  const edit = () => {
    tap();
    Alert.alert(t('photos.angleTitle'), t('photos.angleMessage'), [
      ...ANGLE_OPTIONS.map((a) => ({ text: (photo.angle === a ? '✓ ' : '') + ANGLE_LABEL[a], onPress: () => actions.setPhotoAngle(photo.id, a) })),
      { text: t('photos.delete'), style: 'destructive' as const, onPress: remove },
      { text: t('photos.cancel'), style: 'cancel' as const },
    ]);
  };
  return (
    <Pressable onPress={edit} onLongPress={remove} style={styles.cell} accessibilityRole="button" accessibilityLabel={photo.angle ? ANGLE_LABEL[photo.angle] : t('photos.unsorted')}>
      <Image source={{ uri: journalPhotoUri(photo.path) }} style={StyleSheet.absoluteFill} contentFit="cover" />
      <View style={styles.cellLabel}>
        <T size={10} rounded color={photo.angle ? C.text : C.textMute}>
          {photo.angle ? ANGLE_LABEL[photo.angle].toLocaleUpperCase(locale) : '…'}
        </T>
      </View>
    </Pressable>
  );
}

/** The Compare pair drawn as retro cartoons; draws whichever of the two isn't drawn yet. */
function RetroPair({ before, after, units, days, from, onFrom }: { before: ProgressPhoto; after: ProgressPhoto; units: 'metric' | 'imperial'; days: string[]; from?: string; onFrom: (d: string | undefined) => void }) {
  const cost = useStore((s) => s.account.costs.photo_retro);
  const [busy, setBusy] = useState(false);
  const missing = [before, after].filter((p) => !p.retro);

  const draw = async () => {
    if (!canUseAI()) return Alert.alert(t('photos.retroTitle'), t('errors.signInForAi'));
    setBusy(true);
    try {
      for (const p of missing) await actions.makeRetroPhoto(p.id);
    } catch (e) {
      Alert.alert(t('photos.retroTitle'), e instanceof AiError || e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {missing.length === 0 ? (
        <Compare beforeUri={journalPhotoUri(before.retro!)} afterUri={journalPhotoUri(after.retro!)} />
      ) : (
        <View style={styles.compare}>
          <View style={[StyleSheet.absoluteFill, { flexDirection: 'row' }]}>
            {[before, after].map((p) => (
              <Image key={p.id} source={{ uri: journalPhotoUri(p.retro ?? p.path) }} style={{ flex: 1, opacity: p.retro ? 1 : 0.35 }} contentFit="cover" />
            ))}
          </View>
          <View style={styles.retroCta}>
            {busy ? (
              <>
                <ActivityIndicator color={C.yellow} />
                <T size={13} rounded color={C.text}>
                  {t('photos.retroDrawing')}
                </T>
              </>
            ) : (
              <>
                <T size={13} color={C.text} style={styles.emptyText}>
                  {t('photos.retroBody')}
                </T>
                <ArcadeButton
                  label={cost ? t('photos.retroMakeCost', { count: cost * missing.length }) : t('photos.retroMake')}
                  size="md"
                  onPress={draw}
                  icon={<Icon name="wand" size={20} color="#FF7A1A" weight="bold" />}
                />
              </>
            )}
          </View>
        </View>
      )}
      <PairCaption before={before} after={after} units={units} />
      <FromPicker days={days} value={from} onChange={onFrom} />
      <T size={11} color={C.textMute}>
        {t('photos.retroHint')}
      </T>
    </>
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
          {t('photos.before')}
        </T>
      </View>
      <View style={[styles.tag, { right: 8, backgroundColor: C.lime }]} pointerEvents="none">
        <T size={10} rounded color={C.ink}>
          {t('photos.now')}
        </T>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: Space.md, paddingTop: Space.lg, gap: Space.sm, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: Space.sm },
  tabs: { flexDirection: 'row', gap: 4, padding: 4, borderRadius: 12, backgroundColor: '#1D2023', borderWidth: 2, borderColor: C.ink },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 8 },
  tabOn: { backgroundColor: C.yellow },
  row: { flexDirection: 'row', gap: 8 },
  empty: { alignItems: 'center', gap: 10, paddingVertical: Space.xl },
  emptyText: { textAlign: 'center', lineHeight: 19 },
  between: { flexDirection: 'row', justifyContent: 'space-between' },
  dayCard: { gap: 10 },
  dayRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  compare: { height: 420, borderRadius: 12, overflow: 'hidden', borderWidth: 3, borderColor: C.ink, backgroundColor: '#111' },
  retroCta: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', gap: 12, padding: Space.lg, backgroundColor: 'rgba(11,12,13,0.45)' },
  divider: { position: 'absolute', top: 0, bottom: 0, width: 3, marginLeft: -1.5, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  knob: { flexDirection: 'row', width: 34, height: 34, borderRadius: 17, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: C.ink },
  tag: { position: 'absolute', top: 8, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 4, backgroundColor: C.yellow },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cell: { width: '31.5%', aspectRatio: 3 / 4, borderRadius: 8, overflow: 'hidden', borderWidth: 3, borderColor: C.ink, backgroundColor: '#111' },
  cellLabel: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 4, backgroundColor: 'rgba(11,12,13,0.7)' },
});
