import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import { tap } from '@/lib/haptics';

import { Icon, type IconName } from './icon';
import { T } from './ui';

type Tile = {
  title: string;
  sub: string;
  icon: IconName;
  deco: IconName;
  colors: readonly [string, string, string];
  glow: string;
};

const TALK: Tile = { title: 'Talk', sub: 'Just say what you ate or did', icon: 'mic', deco: 'waveform', colors: ['#6D3BFF', '#B844F5', '#FF4FA3'], glow: '#FFB3F0' };
const SNAP: Tile = { title: 'Snap', sub: 'Plate, label or screen', icon: 'camera', deco: 'viewfinder', colors: ['#FF8A3D', '#FF5F57', '#FF3D7F'], glow: '#FFD08A' };
const TYPE: Tile = { title: 'Type', sub: 'A few words', icon: 'bubble', deco: 'pencil', colors: ['#16D9F5', '#2F8BFF', '#4C5BFF'], glow: '#9DF4FF' };

/** Bento-style capture tiles: a wide voice tile on top, photo and text side by side. */
export function QuickTiles({ onTalk, onSnap, onType }: { onTalk: () => void; onSnap: () => void; onType: () => void }) {
  return (
    <View style={{ gap: 10 }}>
      <TileView tile={TALK} wide onPress={onTalk} />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <TileView tile={SNAP} onPress={onSnap} />
        <TileView tile={TYPE} onPress={onType} />
      </View>
    </View>
  );
}

function TileView({ tile, wide, onPress }: { tile: Tile; wide?: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={() => {
        tap();
        onPress();
      }}
      style={({ pressed }) => [{ flex: 1, transform: [{ scale: pressed ? 0.97 : 1 }] }]}>
      <LinearGradient colors={tile.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.tile, { height: wide ? 128 : 150 }]}>
        {/* Soft light blob for a mesh-gradient feel */}
        <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
          <Defs>
            <RadialGradient id={`g-${tile.title}`} cx="85%" cy="10%" r="70%">
              <Stop offset="0" stopColor={tile.glow} stopOpacity="0.55" />
              <Stop offset="1" stopColor={tile.glow} stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Rect width="100%" height="100%" fill={`url(#g-${tile.title})`} />
        </Svg>
        <LinearGradient colors={['rgba(255,255,255,0.22)', 'rgba(255,255,255,0)']} style={styles.gloss} pointerEvents="none" />

        {/* Oversized faded glyph */}
        <View style={[styles.deco, wide && { right: 14, bottom: -6 }]} pointerEvents="none">
          <Icon name={tile.deco} size={wide ? 112 : 96} color="rgba(255,255,255,0.16)" weight="bold" />
        </View>

        <View style={[styles.body, wide && styles.bodyWide]}>
          <View style={styles.iconWrap}>
            <Icon name={tile.icon} size={wide ? 30 : 26} color="#fff" weight="bold" />
          </View>
          <View style={{ flex: wide ? 1 : undefined, gap: 2 }}>
            <T size={wide ? 24 : 20} weight="900" color="#fff" rounded>
              {tile.title}
            </T>
            <T size={12} weight="600" color="rgba(255,255,255,0.82)" numberOfLines={1}>
              {tile.sub}
            </T>
          </View>
          {wide && <LiveWave />}
        </View>
      </LinearGradient>
    </Pressable>
  );
}

/** Idle equalizer that hints "talk to me". */
function LiveWave() {
  return (
    <View style={styles.wave}>
      {[0.5, 0.9, 0.6, 1, 0.7, 0.4, 0.8].map((h, i) => (
        <WaveBar key={i} peak={h} delay={i * 110} />
      ))}
    </View>
  );
}

function WaveBar({ peak, delay }: { peak: number; delay: number }) {
  const v = useSharedValue(0.3);
  useEffect(() => {
    v.value = withDelay(delay, withRepeat(withSequence(withTiming(peak, { duration: 520 }), withTiming(0.25, { duration: 520 })), -1));
  }, [delay, peak, v]);
  const style = useAnimatedStyle(() => ({ height: 8 + v.value * 30 }));
  return <Animated.View style={[styles.waveBar, style]} />;
}

const styles = StyleSheet.create({
  tile: { borderRadius: 28, overflow: 'hidden', padding: 16 },
  gloss: { position: 'absolute', top: 0, left: 0, right: 0, height: '50%' },
  deco: { position: 'absolute', right: -14, bottom: -14, transform: [{ rotate: '-12deg' }] },
  body: { flex: 1, justifyContent: 'space-between' },
  bodyWide: { flexDirection: 'row', alignItems: 'center', gap: 14, justifyContent: 'flex-start' },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  wave: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 40, marginRight: 4 },
  waveBar: { width: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.9)' },
});
