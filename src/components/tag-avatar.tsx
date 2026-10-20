import { LinearGradient } from 'expo-linear-gradient';
import { Text, View } from 'react-native';
import Svg, { Circle, Rect } from 'react-native-svg';

import { C, Display } from '@/constants/theme';
import { avatarById, type AvatarId } from '@/lib/avatars';

/**
 * Graffiti-tag avatar: the user's initial (or a chosen 8-bit sprite) sprayed on a colour splash inside
 * a steel ring. With `avatar`, the sprite's own splash colour replaces `band`.
 */
export function TagAvatar({ size = 72, band = C.orange, online = true, letter = 'P', avatar }: { size?: number; band?: string; online?: boolean; letter?: string; avatar?: AvatarId }) {
  const inner = size - 8;
  const def = avatar ? avatarById(avatar) : null;
  const sprite = def?.sprite.length ? def : null;
  if (def) band = def.band;
  return (
    <View style={{ width: size, height: size }}>
      <LinearGradient
        colors={['#C9CDD0', '#6A7074', '#33383B']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ width: size, height: size, borderRadius: size / 2, padding: 4 }}>
        <View
          style={{
            width: inner,
            height: inner,
            borderRadius: inner / 2,
            overflow: 'hidden',
            backgroundColor: '#1C1F21',
            borderWidth: 2,
            borderColor: C.ink,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Svg width={inner} height={inner} viewBox="0 0 100 100" style={{ position: 'absolute' }}>
            <Circle cx={52} cy={50} r={34} fill={band} opacity={0.9} />
            <Circle cx={82} cy={24} r={6} fill={band} opacity={0.8} />
            <Circle cx={18} cy={78} r={5} fill={band} opacity={0.8} />
            <Circle cx={88} cy={70} r={3} fill={band} opacity={0.7} />
          </Svg>
          {sprite ? (
            <PixelSprite rows={sprite.sprite} colors={sprite.colors} size={inner * 0.62} />
          ) : (
            <Text
              style={{
                fontFamily: Display.comic,
                fontSize: inner * 0.62,
                color: C.text,
                textShadowColor: C.ink,
                textShadowOffset: { width: 2, height: 3 },
                textShadowRadius: 0,
                marginTop: inner * 0.04,
              }}>
              {letter.toUpperCase()}
            </Text>
          )}
        </View>
      </LinearGradient>
      {online && (
        <View
          style={{
            position: 'absolute',
            right: 2,
            bottom: 4,
            width: size * 0.2,
            height: size * 0.2,
            borderRadius: size,
            backgroundColor: C.lime,
            borderWidth: 3,
            borderColor: C.ink,
          }}
        />
      )}
    </View>
  );
}

/** Draws pixel rows ('.' is empty, letters index `colors`) as crisp squares with a hard ink shadow. */
export function PixelSprite({ rows, colors, size }: { rows: string[]; colors: Record<string, string>; size: number }) {
  const w = Math.max(...rows.map((r) => r.length));
  const side = Math.max(w, rows.length);
  const dx = (side - w) / 2;
  const dy = (side - rows.length) / 2;
  const cells = rows.flatMap((r, y) => [...r].flatMap((ch, x) => (ch === '.' ? [] : [{ x: x + dx, y: y + dy, fill: colors[ch] ?? C.text }])));
  return (
    <Svg width={size} height={size} viewBox={`-0.6 -0.6 ${side + 1.2} ${side + 1.2}`}>
      {cells.map((c) => (
        <Rect key={`s${c.x}-${c.y}`} x={c.x + 0.35} y={c.y + 0.45} width={1.02} height={1.02} fill={C.ink} />
      ))}
      {cells.map((c) => (
        <Rect key={`p${c.x}-${c.y}`} x={c.x} y={c.y} width={1.02} height={1.02} fill={c.fill} />
      ))}
    </Svg>
  );
}
