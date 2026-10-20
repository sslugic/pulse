import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { C } from '@/constants/theme';
import { t } from '@/lib/i18n';
import { SCENE_ELEMENTS, skyFor, type SceneElement } from '@/lib/scene';

import { Icon } from './icon';
import { T } from './ui';

// Where the supporting elements sit around the hero, as fractions of the panel.
const SPOTS = [
  { x: 0.16, y: 0.3, size: 34, rotate: -10 },
  { x: 0.84, y: 0.28, size: 30, rotate: 8 },
  { x: 0.8, y: 0.74, size: 28, rotate: -6 },
];

/** A comic-panel illustration of a journal moment, drawn from its scene elements instead of the photo. */
export function MomentArt({ scene, mood, photo, height = 150 }: { scene: SceneElement[]; mood?: number; photo?: boolean; height?: number }) {
  const [hero, ...rest] = scene;
  const h = SCENE_ELEMENTS[hero];
  // A seeded sprinkle of stars so each moment looks a little different but stays stable.
  const seed = scene.join('').split('').reduce((n, c) => (n * 31 + c.charCodeAt(0)) % 9973, 7);
  const dots = Array.from({ length: 14 }, (_, i) => ({ x: ((seed * (i + 3) * 37) % 100) / 100, y: ((seed * (i + 7) * 53) % 55) / 100, r: 0.8 + ((seed + i) % 3) * 0.6 }));

  return (
    <View style={[styles.panel, { height }]}>
      <LinearGradient colors={skyFor(mood)} style={StyleSheet.absoluteFill} />
      <Svg style={StyleSheet.absoluteFill} viewBox="0 0 100 100" preserveAspectRatio="none">
        {dots.map((d, i) => (
          <Circle key={i} cx={d.x * 100} cy={d.y * 100} r={d.r * 0.5} fill="#fff" opacity={0.35} />
        ))}
        <Path d="M0 78 Q 18 66 34 74 T 68 70 T 100 72 V100 H0 Z" fill="#0B0C0D" opacity={0.55} />
        <Path d="M0 86 Q 25 78 50 86 T 100 84 V100 H0 Z" fill="#0B0C0D" opacity={0.8} />
      </Svg>

      {/* Halftone-ish glow behind the hero */}
      <View style={[styles.heroWrap, { shadowColor: h.color }]}>
        <View style={[styles.hero, { borderColor: h.color }]}>
          <Icon name={h.icon} size={46} color={h.color} weight="bold" />
        </View>
      </View>

      {rest.map((k, i) => {
        const el = SCENE_ELEMENTS[k];
        const spot = SPOTS[i];
        return (
          <View
            key={k}
            style={[
              styles.sticker,
              { left: `${spot.x * 100}%`, top: `${spot.y * 100}%`, borderColor: el.color, transform: [{ translateX: -spot.size }, { translateY: -spot.size }, { rotate: `${spot.rotate}deg` }] },
            ]}>
            <Icon name={el.icon} size={spot.size} color={el.color} weight="bold" />
          </View>
        );
      })}

      {photo && (
        <View style={styles.badge}>
          <Icon name="camera" size={11} color={C.ink} weight="bold" />
          <T size={9} rounded color={C.ink}>
            {t('journal.photoMoment')}
          </T>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { borderRadius: 10, overflow: 'hidden', borderWidth: 3, borderColor: C.ink, alignItems: 'center', justifyContent: 'center' },
  heroWrap: { shadowOpacity: 0.9, shadowRadius: 18, shadowOffset: { width: 0, height: 0 } },
  hero: { width: 86, height: 86, borderRadius: 43, borderWidth: 3, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(11,12,13,0.78)' },
  sticker: { position: 'absolute', padding: 8, borderRadius: 12, borderWidth: 2, backgroundColor: 'rgba(11,12,13,0.7)' },
  badge: {
    position: 'absolute',
    left: 8,
    bottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    backgroundColor: C.yellow,
  },
});
