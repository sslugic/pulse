import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, Line, Pattern, RadialGradient, Rect, Stop } from 'react-native-svg';

import { C, Display } from '@/constants/theme';
import { tap } from '@/lib/haptics';

export { Backdrop } from './backdrops';

function Rivet({ style }: { style: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.rivet, style]}>
      <View style={styles.rivetShine} />
    </View>
  );
}

/** Riveted steel plate: beveled frame, dark inset, optional neon edge. */
export function MetalPanel({
  children,
  style,
  innerStyle,
  accent,
  rivets = true,
  onPress,
}: {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  innerStyle?: StyleProp<ViewStyle>;
  accent?: string;
  rivets?: boolean;
  onPress?: () => void;
}) {
  const body = (
    <LinearGradient colors={['#B9BEC2', '#6C7276', '#3E4347', '#80868A']} locations={[0, 0.35, 0.7, 1]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.frame, style]}>
      <View style={[styles.inset, accent ? { borderColor: accent, shadowColor: accent, shadowOpacity: 0.6, shadowRadius: 8 } : null]}>
        <LinearGradient colors={['#2C3135', '#1E2225']} style={StyleSheet.absoluteFill} />
        {/* rust bloom in one corner */}
        <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
          <Defs>
            <RadialGradient id="rust" cx="100%" cy="100%" r="60%">
              <Stop offset="0" stopColor={C.rust} stopOpacity="0.28" />
              <Stop offset="1" stopColor={C.rust} stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#rust)" />
        </Svg>
        <View style={[styles.content, innerStyle]}>{children}</View>
      </View>
      {rivets && (
        <>
          <Rivet style={{ top: 3, left: 3 }} />
          <Rivet style={{ top: 3, right: 3 }} />
          <Rivet style={{ bottom: 3, left: 3 }} />
          <Rivet style={{ bottom: 3, right: 3 }} />
        </>
      )}
    </LinearGradient>
  );
  if (!onPress) return body;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.985 : 1 }] })}>
      {body}
    </Pressable>
  );
}

/** Rusty chain stretched across the screen. */
export function Chain({ style }: { style?: StyleProp<ViewStyle> }) {
  const links = Array.from({ length: 24 });
  return (
    <View style={[{ height: 22, overflow: 'hidden' }, style]} pointerEvents="none">
      <Svg width={24 * 30} height={22}>
        {links.map((_, i) =>
          i % 2 === 0 ? (
            <Rect key={i} x={i * 30} y={4} width={38} height={14} rx={7} fill="none" stroke="#7A6250" strokeWidth={4} />
          ) : (
            <Line key={i} x1={i * 30 + 2} y1={11} x2={i * 30 + 36} y2={11} stroke="#9A7A60" strokeWidth={5} strokeLinecap="round" />
          ),
        )}
        {links.map((_, i) => (i % 2 === 0 ? <Rect key={`h${i}`} x={i * 30 + 3} y={5} width={30} height={2} rx={1} fill="#C9A88A" opacity={0.5} /> : null))}
      </Svg>
    </View>
  );
}

/** Yellow/black caution stripes. */
export function Hazard({ height = 10, style }: { height?: number; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ height, overflow: 'hidden', backgroundColor: '#111' }, style]} pointerEvents="none">
      <Svg width="100%" height={height}>
        <Defs>
          <Pattern id="hz" width="20" height={height} patternUnits="userSpaceOnUse" patternTransform="skewX(-35)">
            <Rect width="10" height={height} fill={C.yellow} />
          </Pattern>
        </Defs>
        <Rect width="100%" height={height} fill="url(#hz)" />
      </Svg>
    </View>
  );
}

/** Peel-off vinyl sticker. */
export function Sticker({ text, color = C.violet, rotate = -6, style, size = 18 }: { text: string; color?: string; rotate?: number; style?: StyleProp<ViewStyle>; size?: number }) {
  return (
    <View style={[styles.sticker, { backgroundColor: color, transform: [{ rotate: `${rotate}deg` }] }, style]} pointerEvents="none">
      <Text style={[styles.stickerText, { fontSize: size }]}>{text}</Text>
      <View style={styles.peel} />
    </View>
  );
}

/** Big comic headline with a thick dark outline (layered shadows fake a text stroke). */
export function Comic({ children, size = 34, color = C.text, style, outline = C.ink }: { children: ReactNode; size?: number; color?: string; style?: StyleProp<TextStyle>; outline?: string }) {
  const o = Math.max(2, Math.round(size / 14));
  return (
    <View>
      {[
        [o, o],
        [-o, o],
        [o, -o],
        [-o, -o],
        [0, o + 2],
      ].map(([x, y], i) => (
        <Text key={i} style={[styles.comic, { fontSize: size, lineHeight: size * 1.05, color: outline, position: 'absolute', left: x, top: y }, style]} aria-hidden>
          {children}
        </Text>
      ))}
      <Text style={[styles.comic, { fontSize: size, lineHeight: size * 1.05, color }, style]}>{children}</Text>
    </View>
  );
}

/** Chunky 3D arcade button. */
export function ArcadeButton({
  label,
  onPress,
  colors = [C.yellow, '#FF9C00'],
  textColor = '#FF7A1A',
  size = 'lg',
  icon,
  disabled,
  style,
}: {
  label: string;
  onPress: () => void;
  colors?: readonly [string, string];
  textColor?: string;
  size?: 'md' | 'lg' | 'xl';
  icon?: ReactNode;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const h = size === 'xl' ? 96 : size === 'lg' ? 64 : 50;
  const fs = size === 'xl' ? 36 : size === 'lg' ? 28 : 22;
  return (
    <Pressable
      disabled={disabled}
      onPress={() => {
        tap();
        onPress();
      }}
      style={({ pressed }) => [{ opacity: disabled ? 0.45 : 1 }, style, pressed && { transform: [{ translateY: 3 }] }]}>
      {({ pressed }) => (
        <View style={[styles.arcadeBase, { height: h + 6, borderRadius: 14 }]}>
          <LinearGradient
            colors={colors}
            style={[styles.arcadeFace, { height: h, borderRadius: 12, marginBottom: pressed ? 0 : 6, marginTop: pressed ? 6 : 0 }]}>
            <LinearGradient colors={['rgba(255,255,255,0.55)', 'rgba(255,255,255,0)']} style={styles.arcadeGloss} />
            {icon}
            <View style={{ flexShrink: 1 }}>
              <Comic size={fs} color={textColor} style={{ textAlign: 'center' }}>
                {label}
              </Comic>
            </View>
          </LinearGradient>
        </View>
      )}
    </Pressable>
  );
}

/** Spray-painted section label. */
export function SprayLabel({ children, color = C.text, right }: { children: string; color?: string; right?: ReactNode }) {
  return (
    <View style={styles.spray}>
      <Text style={[styles.sprayText, { color }]}>{children}</Text>
      {right}
    </View>
  );
}

/** Graffiti drip letter for the weekly streak row. */
/** One weekday in the streak strip: drips paint when the day was logged; today gets a marker even before that. */
export function DripLetter({ letter, on, color = C.lime, today = false }: { letter: string; on: boolean; color?: string; today?: boolean }) {
  return (
    <View style={{ alignItems: 'center', width: 26 }}>
      <Text style={[styles.drip, { color: on ? color : today ? color + 'AA' : '#4A4E52', textShadowColor: on ? color : 'transparent' }]}>{letter}</Text>
      {today && !on && <View style={{ width: 14, height: 3, borderRadius: 2, marginTop: -2, backgroundColor: color }} />}
      {on && (
        <Svg width={20} height={10} style={{ marginTop: -6 }}>
          <Line x1={6} y1={0} x2={6} y2={7} stroke={color} strokeWidth={2.5} strokeLinecap="round" />
          <Line x1={13} y1={0} x2={13} y2={4} stroke={color} strokeWidth={2} strokeLinecap="round" />
          <Circle cx={6} cy={8} r={1.6} fill={color} />
        </Svg>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { borderRadius: 14, padding: 3 },
  inset: { borderRadius: 11, overflow: 'hidden', borderWidth: 1.5, borderColor: '#0E1011' },
  content: { padding: 14 },
  rivet: {
    position: 'absolute',
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#5B6064',
    borderWidth: 1,
    borderColor: '#2A2D30',
  },
  rivetShine: { position: 'absolute', top: 1, left: 1, width: 3, height: 3, borderRadius: 2, backgroundColor: '#D7DBDE' },
  sticker: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#F3EEDC',
    shadowColor: '#000',
    shadowOpacity: 0.6,
    shadowRadius: 4,
    shadowOffset: { width: 2, height: 3 },
  },
  stickerText: { fontFamily: Display.comic, color: C.ink, letterSpacing: 1 },
  peel: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 14,
    height: 14,
    backgroundColor: '#F3EEDC',
    borderBottomLeftRadius: 10,
    opacity: 0.9,
  },
  comic: { fontFamily: Display.comic, letterSpacing: 1.5 },
  arcadeBase: { backgroundColor: '#7A3B00', borderWidth: 3, borderColor: C.ink, overflow: 'hidden' },
  arcadeFace: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, overflow: 'hidden' },
  arcadeGloss: { position: 'absolute', top: 0, left: 0, right: 0, height: '45%' },
  spray: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 18, marginBottom: 8, paddingHorizontal: 4 },
  sprayText: { fontFamily: Display.comic, fontSize: 22, letterSpacing: 1.5, textShadowColor: '#000', textShadowOffset: { width: 2, height: 2 }, textShadowRadius: 0 },
  drip: { fontFamily: Display.tag, fontSize: 24, textShadowRadius: 8, textShadowOffset: { width: 0, height: 0 } },
});
