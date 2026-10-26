import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Text, View } from 'react-native';
import Svg, { Circle, SvgXml } from 'react-native-svg';

import { C, Display } from '@/constants/theme';
import { AVATAR_ART } from '@/lib/avatar-art';
import { avatarById, type AvatarId } from '@/lib/avatars';

/**
 * Graffiti-tag avatar inside a steel ring: the user's initial sprayed on a colour splash, or a chosen
 * subway-graffiti sticker (see lib/avatar-art) that fills the frame.
 */
export function TagAvatar({
  size = 72,
  band = C.orange,
  online = true,
  letter = 'P',
  avatar,
  photo,
}: {
  size?: number;
  band?: string;
  online?: boolean;
  letter?: string;
  avatar?: AvatarId;
  /** A picture (e.g. a coach portrait) shown instead of the letter, cropped to the face. */
  photo?: number;
}) {
  const inner = size - 8;
  const art = avatar ? AVATAR_ART[avatarById(avatar).id] : undefined;
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
          {photo ? (
            <Image source={photo} style={{ position: 'absolute', width: inner, height: inner * 1.34, top: 0 }} contentFit="cover" contentPosition="top" />
          ) : art ? (
            <SvgXml xml={`<svg viewBox="0 0 100 100">${art}</svg>`} width={inner} height={inner} style={{ position: 'absolute' }} />
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

