import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, Ellipse, G, Line, LinearGradient as SvgLinearGradient, Pattern, RadialGradient, Rect, Stop, Text as SvgText } from 'react-native-svg';

import { C, Display } from '@/constants/theme';
import { tap } from '@/lib/haptics';

type Piece = { text: string; x: number; y: number; size: number; fill: string; rot: number };

/** One graffiti "throw-up": dark outline, colour fill, highlight and paint drips. */
function GraffitiPiece({ p }: { p: Piece }) {
  const drips = [0.18, 0.42, 0.7].map((f, i) => ({ dx: p.size * p.text.length * 0.55 * f, len: p.size * (0.35 + ((i * 37) % 5) * 0.12) }));
  return (
    <G rotation={p.rot} originX={p.x} originY={p.y}>
      <SvgText x={p.x + 4} y={p.y + 5} fontSize={p.size} fontFamily={Display.tag} fill="#000" opacity={0.55}>
        {p.text}
      </SvgText>
      <SvgText x={p.x} y={p.y} fontSize={p.size} fontFamily={Display.tag} fill={p.fill} stroke="#0B0C0D" strokeWidth={p.size / 8} strokeLinejoin="round">
        {p.text}
      </SvgText>
      <SvgText x={p.x - 2} y={p.y - 3} fontSize={p.size} fontFamily={Display.tag} fill="#fff" opacity={0.18}>
        {p.text}
      </SvgText>
      {drips.map((d, i) => (
        <G key={i}>
          <Line x1={p.x + d.dx} y1={p.y + 2} x2={p.x + d.dx} y2={p.y + d.len} stroke={p.fill} strokeWidth={p.size / 14} strokeLinecap="round" />
          <Circle cx={p.x + d.dx} cy={p.y + d.len + 2} r={p.size / 18} fill={p.fill} />
        </G>
      ))}
    </G>
  );
}

/**
 * Subway-station wall behind every screen: grimy cream tiles, a mosaic station band,
 * and faded graffiti pieces. Kept dim so the steel panels stay readable on top.
 */
export function Backdrop({ tags = ['NYC', 'PULSE'], station = 'PULSE ST' }: { tags?: string[]; station?: string }) {
  const { width: w, height: h } = useWindowDimensions();
  const bandY = Math.round(h * 0.47);
  const pieces: Piece[] = [
    { text: tags[0] ?? 'NYC', x: w * 0.05, y: h * 0.11, size: 54, fill: C.violet, rot: -10 },
    { text: tags[1] ?? 'PULSE', x: w * 0.42, y: h * 0.56, size: 66, fill: C.lime, rot: -6 },
    { text: 'CREW', x: w * 0.04, y: h * 0.8, size: 46, fill: C.orange, rot: 8 },
    { text: 'GO!', x: w * 0.66, y: h * 0.22, size: 40, fill: C.pink, rot: 12 },
  ];
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient colors={['#4A4F4C', '#3A3E3C', '#2A2D2C']} style={StyleSheet.absoluteFill} />
      <Svg width={w} height={h} style={StyleSheet.absoluteFill}>
        <Defs>
          {/* glazed subway tile with dark grout */}
          <Pattern id="tile" width="44" height="22" patternUnits="userSpaceOnUse">
            <Rect width="44" height="22" fill="#141616" />
            <Rect x="1.5" y="1.5" width="41" height="19" rx="2.5" fill="#8C918A" />
            <Rect x="3" y="3" width="38" height="5" rx="2" fill="#fff" opacity={0.12} />
          </Pattern>
          <Pattern id="mosaic" width="12" height="12" patternUnits="userSpaceOnUse">
            <Rect width="12" height="12" fill="#101211" />
            <Rect x="1" y="1" width="10" height="10" fill="#3F8F3A" />
          </Pattern>
          <Pattern id="mosaic2" width="12" height="12" patternUnits="userSpaceOnUse">
            <Rect width="12" height="12" fill="#101211" />
            <Rect x="1" y="1" width="10" height="10" fill="#C9A227" />
          </Pattern>
          <SvgLinearGradient id="grimeV" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#000" stopOpacity="0.15" />
            <Stop offset="0.6" stopColor="#000" stopOpacity="0.35" />
            <Stop offset="1" stopColor="#000" stopOpacity="0.8" />
          </SvgLinearGradient>
          <RadialGradient id="stain" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#3B2A12" stopOpacity="0.5" />
            <Stop offset="1" stopColor="#3B2A12" stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="vignette" cx="50%" cy="40%" r="80%">
            <Stop offset="0.5" stopColor="#000" stopOpacity="0" />
            <Stop offset="1" stopColor="#000" stopOpacity="0.75" />
          </RadialGradient>
        </Defs>

        <Rect width={w} height={h} fill="url(#tile)" opacity={0.55} />

        {/* station mosaic band */}
        <Rect x={0} y={bandY} width={w} height={10} fill="url(#mosaic2)" opacity={0.7} />
        <Rect x={0} y={bandY + 10} width={w} height={44} fill="url(#mosaic)" opacity={0.75} />
        <Rect x={0} y={bandY + 54} width={w} height={10} fill="url(#mosaic2)" opacity={0.7} />
        <Rect x={w / 2 - 78} y={bandY + 14} width={156} height={36} fill="#0E100F" opacity={0.85} />
        <SvgText x={w / 2} y={bandY + 40} fontSize={22} fontFamily={Display.block} fill="#E8E2CC" textAnchor="middle" letterSpacing={3} opacity={0.85}>
          {station}
        </SvgText>

        {/* water stains and grime */}
        <Ellipse cx={w * 0.18} cy={h * 0.47} rx={90} ry={160} fill="url(#stain)" />
        <Ellipse cx={w * 0.86} cy={h * 0.72} rx={110} ry={190} fill="url(#stain)" />

        {/* graffiti */}
        <G opacity={0.55}>
          {pieces.map((p) => (
            <GraffitiPiece key={p.text} p={p} />
          ))}
          {/* tags, arrow and spray mist */}
          <SvgText x={w * 0.62} y={h * 0.93} fontSize={30} fontFamily={Display.tag} fill="#E8E2CC" rotation={-8} originX={w * 0.62} originY={h * 0.93}>
            skrap 99
          </SvgText>
          <Line x1={w * 0.72} y1={h * 0.44} x2={w * 0.9} y2={h * 0.41} stroke={C.yellow} strokeWidth={6} strokeLinecap="round" />
          <Line x1={w * 0.9} y1={h * 0.41} x2={w * 0.86} y2={h * 0.385} stroke={C.yellow} strokeWidth={6} strokeLinecap="round" />
          <Line x1={w * 0.9} y1={h * 0.41} x2={w * 0.865} y2={h * 0.435} stroke={C.yellow} strokeWidth={6} strokeLinecap="round" />
          {Array.from({ length: 26 }).map((_, i) => (
            <Circle key={i} cx={(w * ((i * 53) % 97)) / 97} cy={(h * ((i * 71) % 89)) / 89} r={1 + (i % 3)} fill={[C.lime, C.violet, C.orange, C.pink][i % 4]} opacity={0.6} />
          ))}
        </G>

        <Rect width={w} height={h} fill="url(#grimeV)" />
        <Rect width={w} height={h} fill="url(#vignette)" />
      </Svg>
    </View>
  );
}

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
export function DripLetter({ letter, on, color = C.lime }: { letter: string; on: boolean; color?: string }) {
  return (
    <View style={{ alignItems: 'center', width: 26 }}>
      <Text style={[styles.drip, { color: on ? color : '#4A4E52', textShadowColor: on ? color : 'transparent' }]}>{letter}</Text>
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
