import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';
import { LinearGradient } from 'expo-linear-gradient';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import type { ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { C } from '@/constants/theme';

import { tap } from '@/lib/haptics';

// SF Symbol -> Material Symbol, so every icon has an Android/web twin.
const ICONS = {
  mic: ['mic.fill', 'mic'],
  camera: ['camera.fill', 'photo_camera'],
  photo: ['photo.on.rectangle.angled', 'photo_library'],
  keyboard: ['character.cursor.ibeam', 'keyboard'],
  send: ['arrow.up', 'arrow_upward'],
  check: ['checkmark', 'check'],
  close: ['xmark', 'close'],
  sparkles: ['sparkles', 'auto_awesome'],
  flame: ['flame.fill', 'local_fire_department'],
  drop: ['drop.fill', 'water_drop'],
  bolt: ['bolt.fill', 'bolt'],
  fork: ['fork.knife', 'restaurant'],
  target: ['scope', 'target'],
  chart: ['chart.bar.fill', 'bar_chart'],
  retry: ['arrow.clockwise', 'refresh'],
  repeat: ['arrow.counterclockwise', 'replay'],
  chevron: ['chevron.right', 'chevron_right'],
  plus: ['plus', 'add'],
  minus: ['minus', 'remove'],
  scale: ['scalemass.fill', 'monitor_weight'],
  dumbbell: ['dumbbell.fill', 'fitness_center'],
  figure: ['figure.run', 'directions_run'],
  heart: ['heart.fill', 'favorite'],
  leaf: ['leaf.fill', 'eco'],
  wand: ['wand.and.stars', 'auto_fix_high'],
  trash: ['trash', 'delete'],
  key: ['key.fill', 'key'],
  person: ['person.fill', 'person'],
  waveform: ['waveform', 'graphic_eq'],
  viewfinder: ['viewfinder', 'center_focus_strong'],
  bubble: ['text.bubble.fill', 'chat'],
  pencil: ['pencil.and.scribble', 'edit_note'],
  cameraLens: ['camera.aperture', 'camera'],
  moon: ['moon.zzz.fill', 'bedtime'],
  brain: ['brain.head.profile', 'psychology'],
  book: ['book.closed.fill', 'menu_book'],
  gauge: ['gauge.with.needle.fill', 'speed'],
  warning: ['exclamationmark.triangle.fill', 'warning'],
  photoAdd: ['photo.badge.plus', 'add_photo_alternate'],
  speaker: ['speaker.wave.2.fill', 'volume_up'],
  speakerOff: ['speaker.slash.fill', 'volume_off'],
  stop: ['stop.fill', 'stop'],
  game: ['gamecontroller.fill', 'sports_esports'],
  calendar: ['calendar', 'calendar_month'],
  back: ['chevron.left', 'chevron_left'],
  grid: ['square.grid.3x3.fill', 'apps'],
  cards: ['rectangle.on.rectangle.angled', 'style'],
  shred: ['scissors', 'content_cut'],
  lock: ['lock.fill', 'lock'],
  journal: ['book.pages.fill', 'auto_stories'],
  sun: ['sun.max.fill', 'wb_sunny'],
  waves: ['water.waves', 'waves'],
  swim: ['figure.pool.swim', 'pool'],
  beach: ['beach.umbrella.fill', 'beach_access'],
  people: ['person.3.fill', 'groups'],
  drink: ['wineglass.fill', 'local_bar'],
  beer: ['mug.fill', 'sports_bar'],
  coffee: ['cup.and.saucer.fill', 'local_cafe'],
  tree: ['tree.fill', 'park'],
  mountain: ['mountain.2.fill', 'landscape'],
  plane: ['airplane', 'flight'],
  car: ['car.fill', 'directions_car'],
  home: ['house.fill', 'home'],
  work: ['briefcase.fill', 'work'],
  laptop: ['laptopcomputer', 'laptop'],
  music: ['music.note', 'music_note'],
  party: ['party.popper.fill', 'celebration'],
  paw: ['pawprint.fill', 'pets'],
  rain: ['cloud.rain.fill', 'rainy'],
  cloud: ['cloud.fill', 'cloud'],
  bike: ['bicycle', 'directions_bike'],
  walk: ['figure.walk', 'directions_walk'],
  family: ['figure.2.and.child.holdinghands', 'family_restroom'],
  cart: ['cart.fill', 'shopping_cart'],
  bed: ['bed.double.fill', 'bed'],
  star: ['star.fill', 'star'],
  city: ['building.2.fill', 'location_city'],
  film: ['film.fill', 'movie'],
  gift: ['gift.fill', 'redeem'],
  sick: ['bandage.fill', 'healing'],
} as const;

export type IconName = keyof typeof ICONS;

export function Icon({
  name,
  size = 20,
  color = C.text,
  weight = 'semibold',
  animation,
}: {
  name: IconName;
  size?: number;
  color?: string;
  weight?: 'regular' | 'medium' | 'semibold' | 'bold';
  animation?: SymbolViewProps['animationSpec'];
}) {
  const [ios, md] = ICONS[name];
  return (
    <SymbolView
      name={{ ios, android: md, web: md } as SymbolViewProps['name']}
      size={size}
      tintColor={color}
      weight={Platform.OS === 'ios' ? weight : undefined}
      type="hierarchical"
      animationSpec={animation}
      style={{ width: size, height: size }}
    />
  );
}

const glass = Platform.OS === 'ios' && isLiquidGlassAvailable() && isGlassEffectAPIAvailable();

/** Frosted surface: Liquid Glass on iOS 26+, a translucent fill elsewhere. */
export function Glass({ children, style, tint, interactive }: { children?: ReactNode; style?: StyleProp<ViewStyle>; tint?: string; interactive?: boolean }) {
  if (glass) {
    return (
      <GlassView style={style} glassEffectStyle="regular" tintColor={tint} isInteractive={interactive} colorScheme="dark">
        {children}
      </GlassView>
    );
  }
  return <View style={[styles.fallback, tint ? { backgroundColor: tint } : null, style]}>{children}</View>;
}

/** Round riveted steel button (bolt head). */
export function GlassButton({
  icon,
  onPress,
  size = 44,
  color = C.text,
  tint,
  disabled,
}: {
  icon: IconName;
  onPress: () => void;
  size?: number;
  color?: string;
  tint?: string;
  disabled?: boolean;
}) {
  return (
    <Pressable
      disabled={disabled}
      hitSlop={6}
      onPress={() => {
        tap();
        onPress();
      }}
      style={({ pressed }) => ({ opacity: disabled ? 0.4 : 1, transform: [{ scale: pressed ? 0.92 : 1 }] })}>
      <LinearGradient
        colors={['#B9BEC2', '#5E6468', '#3A3F43']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.round, { width: size, height: size, borderRadius: size / 2, padding: 3 }]}>
        <View style={[styles.round, styles.boltFace, { width: size - 6, height: size - 6, borderRadius: size / 2, backgroundColor: tint ?? '#25292C' }]}>
          <Icon name={icon} size={size * 0.42} color={color} />
        </View>
      </LinearGradient>
    </Pressable>
  );
}

/** Icon in a soft tinted badge, used for list rows and stat labels. */
export function IconBadge({ name, color, size = 36 }: { name: IconName; color: string; size?: number }) {
  return (
    <View style={[styles.round, styles.badge, { width: size, height: size, borderRadius: size * 0.26, backgroundColor: color + '2A', borderColor: color + '88' }]}>
      <Icon name={name} size={size * 0.5} color={color} />
    </View>
  );
}

const styles = StyleSheet.create({
  round: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  boltFace: { borderWidth: 1.5, borderColor: '#0B0C0D' },
  badge: { borderWidth: 1.5 },
  fallback: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.14)',
  },
});
