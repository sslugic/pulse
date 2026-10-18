import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';

import { C, Display, Fonts } from '@/constants/theme';
import { tap } from '@/lib/haptics';

import { Icon, type IconName } from './icon';
import { ArcadeButton, MetalPanel, SprayLabel } from './underground';

export { tap };

export function T({
  children,
  size = 15,
  weight = '500',
  color = C.text,
  rounded,
  style,
  numberOfLines,
}: {
  children: ReactNode;
  size?: number;
  weight?: TextStyle['fontWeight'];
  color?: string;
  rounded?: boolean;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
}) {
  // Display faces ship a single weight; asking for bold would make iOS fall back to the system font.
  const face = rounded ? { fontFamily: Display.block } : { fontFamily: Fonts?.sans, fontWeight: weight };
  return (
    <Text numberOfLines={numberOfLines} style={[{ fontSize: size, color }, face, style]}>
      {children}
    </Text>
  );
}

const OUTER_KEYS = /^(margin|width$|minWidth|maxWidth|flex$|flexGrow|flexShrink|flexBasis|alignSelf|position|top|left|right|bottom|transform)/;

/** Content card, drawn as a riveted steel plate. Layout styles go inside, placement styles outside. */
export function Card({ children, style, onPress, accent }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; accent?: string }) {
  const flat = (StyleSheet.flatten(style as never) ?? {}) as Record<string, unknown>;
  const outer: Record<string, unknown> = {};
  const inner: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(flat)) (OUTER_KEYS.test(k) ? outer : inner)[k] = v;
  return (
    <MetalPanel style={outer as ViewStyle} innerStyle={inner as ViewStyle} onPress={onPress} accent={accent}>
      {children}
    </MetalPanel>
  );
}

export function GradientButton({
  label,
  onPress,
  colors,
  disabled,
  icon,
  style,
}: {
  label: string;
  onPress: () => void;
  colors?: readonly [string, string];
  disabled?: boolean;
  icon?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <ArcadeButton label={label.toUpperCase()} onPress={onPress} colors={colors} disabled={disabled} icon={icon} style={style} size="md" />;
}

export function Chip({
  label,
  onPress,
  active,
  color = C.lime,
  icon,
}: {
  label: string;
  onPress: () => void;
  active?: boolean;
  color?: string;
  icon?: IconName;
}) {
  return (
    <Pressable
      onPress={() => {
        tap();
        onPress();
      }}
      style={({ pressed }) => [styles.chip, active && { backgroundColor: color }, pressed && { transform: [{ translateY: 2 }] }]}>
      {icon && <Icon name={icon} size={13} color={active ? C.ink : C.textDim} weight="bold" />}
      <T size={13} rounded color={active ? C.ink : C.text}>
        {label}
      </T>
    </Pressable>
  );
}

/** Gradient progress ring. `progress` may exceed 1 (over target). */
export function Ring({
  size,
  stroke,
  progress,
  colors,
  track = '#0E1011',
  children,
}: {
  size: number;
  stroke: number;
  progress: number;
  colors: readonly [string, string];
  track?: string;
  children?: ReactNode;
}) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(progress, 1));
  const id = `g${colors.join('').replace(/#/g, '')}`;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Defs>
          <SvgGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={colors[0]} />
            <Stop offset="1" stopColor={colors[1]} />
          </SvgGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={progress > 1 ? C.danger : `url(#${id})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${circ} ${circ}`}
          strokeDashoffset={circ * (1 - p)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      {children}
    </View>
  );
}

export function Bar({ value, max, color, height = 8 }: { value: number; max: number; color: string; height?: number }) {
  const pct = max > 0 ? Math.min(value / max, 1) : 0;
  return (
    <View style={[styles.track, { height: height + 4, borderRadius: 4 }]}>
      <View style={{ width: `${pct * 100}%`, height: '100%', borderRadius: 2, backgroundColor: color, overflow: 'hidden' }}>
        <View style={{ height: '45%', backgroundColor: 'rgba(255,255,255,0.35)' }} />
      </View>
    </View>
  );
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return <SprayLabel right={right}>{String(children).toUpperCase()}</SprayLabel>;
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: C.surfaceHi,
    borderWidth: 2,
    borderColor: C.ink,
    borderBottomWidth: 4,
  },
  track: { backgroundColor: '#0E1011', borderWidth: 2, borderColor: '#000', padding: 1, overflow: 'hidden' },
});
