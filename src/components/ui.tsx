import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';

import { C, Fonts, Radius, Space } from '@/constants/theme';
import { tap } from '@/lib/haptics';

import { Icon, type IconName } from './icon';

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
  return (
    <Text
      numberOfLines={numberOfLines}
      style={[{ fontSize: size, fontWeight: weight, color, fontFamily: rounded ? Fonts?.rounded : Fonts?.sans }, style]}>
      {children}
    </Text>
  );
}

export function Card({ children, style, onPress }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void }) {
  const body = <View style={[styles.card, style]}>{children}</View>;
  if (!onPress) return body;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.985 : 1 }] })}>
      {body}
    </Pressable>
  );
}

export function GradientButton({
  label,
  onPress,
  colors = [C.lime, C.cyan],
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
  return (
    <Pressable
      disabled={disabled}
      onPress={() => {
        tap(Haptics.ImpactFeedbackStyle.Medium);
        onPress();
      }}
      style={({ pressed }) => [{ opacity: disabled ? 0.4 : pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] }, style]}>
      <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.gradBtn}>
        {icon}
        <T size={16} weight="700" color="#07080C">
          {label}
        </T>
      </LinearGradient>
    </Pressable>
  );
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
      style={({ pressed }) => [
        styles.chip,
        active && { backgroundColor: color, borderColor: color },
        pressed && { opacity: 0.7 },
      ]}>
      {icon && <Icon name={icon} size={13} color={active ? '#07080C' : C.textDim} weight="bold" />}
      <T size={13} weight="600" color={active ? '#07080C' : C.text}>
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
  track = 'rgba(255,255,255,0.07)',
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
    <View style={{ height, borderRadius: height, backgroundColor: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
      <View style={{ width: `${pct * 100}%`, height: '100%', borderRadius: height, backgroundColor: color }} />
    </View>
  );
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <View style={styles.sectionTitle}>
      <T size={13} weight="700" color={C.textDim} style={{ letterSpacing: 1.2, textTransform: 'uppercase' }}>
        {children}
      </T>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: C.surface,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.border,
    padding: Space.md,
  },
  gradBtn: {
    height: 56,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: Space.lg,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: Radius.pill,
    backgroundColor: C.surfaceHi,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.border,
  },
  sectionTitle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Space.lg,
    marginBottom: Space.sm,
    paddingHorizontal: 4,
  },
});
