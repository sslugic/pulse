import { useEffect, useState } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  FadeOut,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, Line, Path, Pattern, Rect } from 'react-native-svg';

import { C, Display } from '@/constants/theme';
import { t } from '@/lib/i18n';

const AnimatedPath = Animated.createAnimatedComponent(Path);

// Heartbeat line across the logo; its length is long enough for the dash trick.
const BEAT = 'M0 60 H70 L84 30 L98 92 L114 8 L128 60 H170 L180 48 L190 60 H260';
const BEAT_LEN = 520;
const CELLS = 14;

/**
 * Retro arcade boot screen shown while the app loads: CRT scanlines, a neon PULSE logo that
 * flickers on, a heartbeat drawn across it, a segmented loading bar and a blinking INSERT COIN.
 * Calls onDone once it has played and the app is ready.
 */
export function BootScreen({ ready, onDone }: { ready: boolean; onDone: () => void }) {
  const { width, height } = useWindowDimensions();
  const [played, setPlayed] = useState(false);
  const [lit, setLit] = useState(0);

  const glow = useSharedValue(0);
  const beat = useSharedValue(BEAT_LEN);
  const blink = useSharedValue(1);
  const sweep = useSharedValue(0);

  useEffect(() => {
    // Neon tube flicker, then steady.
    glow.set(withSequence(withTiming(1, { duration: 80 }), withTiming(0.2, { duration: 70 }), withTiming(1, { duration: 90 }), withTiming(0.4, { duration: 60 }), withTiming(1, { duration: 220 })));
    beat.set(withDelay(350, withRepeat(withTiming(0, { duration: 1100, easing: Easing.inOut(Easing.quad) }), -1, false)));
    blink.set(withRepeat(withSequence(withTiming(0, { duration: 380 }), withTiming(1, { duration: 380 })), -1));
    sweep.set(withRepeat(withTiming(1, { duration: 2400, easing: Easing.linear }), -1));
    const tick = setInterval(() => setLit((n) => Math.min(CELLS, n + 1)), 95);
    const done = setTimeout(() => setPlayed(true), CELLS * 95 + 250);
    return () => {
      clearInterval(tick);
      clearTimeout(done);
    };
  }, [glow, beat, blink, sweep]);

  useEffect(() => {
    if (played && ready) onDone();
  }, [played, ready, onDone]);

  const logo = useAnimatedStyle(() => ({ opacity: glow.value, transform: [{ scale: 0.96 + glow.value * 0.04 }] }));
  const coin = useAnimatedStyle(() => ({ opacity: blink.value }));
  const scan = useAnimatedStyle(() => ({ transform: [{ translateY: sweep.value * height }] }));
  const beatProps = useAnimatedProps(() => ({ strokeDashoffset: beat.value }));

  return (
    <Animated.View exiting={FadeOut.duration(250)} style={[StyleSheet.absoluteFill, styles.root]}>
      {/* CRT scanlines and a slow bright sweep */}
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Defs>
          <Pattern id="scan" width="4" height="4" patternUnits="userSpaceOnUse">
            <Line x1="0" y1="1" x2="4" y2="1" stroke="#000" strokeOpacity={0.55} strokeWidth={1.5} />
          </Pattern>
          <Pattern id="grid" width="36" height="36" patternUnits="userSpaceOnUse">
            <Path d="M36 0 H0 V36" stroke={C.violet} strokeOpacity={0.12} strokeWidth={1} fill="none" />
          </Pattern>
        </Defs>
        <Rect width={width} height={height} fill="url(#grid)" />
        <Rect width={width} height={height} fill="url(#scan)" />
      </Svg>
      <Animated.View style={[styles.sweep, { width }, scan]} pointerEvents="none" />

      <Animated.View style={[styles.center, logo]}>
        <Text style={styles.logo}>PULSE</Text>
        <Svg width={260} height={100} viewBox="0 0 260 100" style={{ marginTop: -36 }}>
          <Path d={BEAT} stroke={C.lime} strokeOpacity={0.15} strokeWidth={4} fill="none" strokeLinejoin="round" />
          <AnimatedPath
            d={BEAT}
            stroke={C.lime}
            strokeWidth={4}
            fill="none"
            strokeLinejoin="round"
            strokeLinecap="round"
            strokeDasharray={`${BEAT_LEN} ${BEAT_LEN}`}
            animatedProps={beatProps}
          />
        </Svg>
        <Text style={styles.sub}>{t('common.bootTagline')}</Text>
      </Animated.View>

      <View style={styles.bottom}>
        <View style={styles.bar}>
          {Array.from({ length: CELLS }, (_, i) => {
            const on = i < lit;
            const hue = i < 5 ? C.orange : i < 10 ? C.yellow : C.lime;
            return <View key={i} style={[styles.cell, { backgroundColor: on ? hue : '#15181A', shadowColor: hue, shadowOpacity: on ? 0.9 : 0 }]} />;
          })}
        </View>
        <Text style={styles.loading}>{lit < CELLS ? t('common.bootLoading', { pct: Math.round((lit / CELLS) * 100) }) : t('common.bootReady')}</Text>
        <Animated.Text style={[styles.coin, coin]}>{t('common.bootInsertCoin')}</Animated.Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: '#07080C', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  sweep: { position: 'absolute', top: -60, height: 60, backgroundColor: 'rgba(156,255,46,0.05)' },
  center: { alignItems: 'center' },
  // Glow lives on the letters themselves; a separate glow layer renders as a box on iOS.
  logo: { fontFamily: Display.comic, fontSize: 92, letterSpacing: 6, color: '#FFE9C7', textShadowColor: C.orange, textShadowRadius: 18, textShadowOffset: { width: 0, height: 0 }, paddingHorizontal: 30, paddingVertical: 14 },
  sub: { fontFamily: Display.block, fontSize: 12, letterSpacing: 4, color: C.textDim, marginTop: 6 },
  bottom: { position: 'absolute', bottom: 90, alignItems: 'center', gap: 12 },
  bar: { flexDirection: 'row', gap: 4, padding: 4, borderRadius: 6, backgroundColor: '#0B0C0D', borderWidth: 2, borderColor: '#3A3F43' },
  cell: { width: 14, height: 22, borderRadius: 2, shadowRadius: 6, shadowOffset: { width: 0, height: 0 } },
  loading: { fontFamily: Display.block, fontSize: 13, letterSpacing: 3, color: C.lime },
  coin: { fontFamily: Display.block, fontSize: 15, letterSpacing: 4, color: C.yellow },
});
