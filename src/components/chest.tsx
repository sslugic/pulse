import { useEffect, useState } from 'react';
import { Image } from 'expo-image';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import Animated, { FadeInDown, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withSpring, withTiming, ZoomIn } from 'react-native-reanimated';

import { C } from '@/constants/theme';
import type { ChestTier } from '@/lib/arcade';
import { CHEST_LOOK, type Loot } from '@/lib/brain';
import { tap } from '@/lib/haptics';
import { t } from '@/lib/i18n';
import { shareCard } from '@/lib/share-card';
import { actions, getState } from '@/lib/store';

import { Icon } from './icon';
import { TokenCoin } from './quests-card';
import { TagAvatar } from './tag-avatar';
import { T } from './ui';
import { ArcadeButton, Comic } from './underground';

/** A treasure chest drawn from plain views: body, trim bands, lock and a lid that can swing open. */
export function ChestArt({ tier, size = 80, open = false, bounce = false }: { tier: ChestTier; size?: number; open?: boolean; bounce?: boolean }) {
  const look = CHEST_LOOK[tier];
  const lid = useSharedValue(0);
  const hop = useSharedValue(0);

  useEffect(() => {
    lid.set(withSpring(open ? 1 : 0, { damping: 9 }));
  }, [open, lid]);
  useEffect(() => {
    hop.set(bounce ? withRepeat(withSequence(withTiming(-size * 0.06, { duration: 500 }), withTiming(0, { duration: 500 })), -1) : withTiming(0));
  }, [bounce, hop, size]);

  const lidStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -lid.value * size * 0.16 }, { translateX: -lid.value * size * 0.06 }, { rotate: `${-lid.value * 12}deg` }],
  }));
  const hopStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: hop.value }],
  }));
  const w = size;
  const bodyH = size * 0.5;
  const lidH = size * 0.32;
  const band = Math.max(3, size * 0.07);

  return (
    <Animated.View style={[{ width: w, height: bodyH + lidH + 4, justifyContent: 'flex-end' }, hopStyle]}>
      {open && (
        <Svg width={w * 2} height={w * 2} style={{ position: 'absolute', left: -w / 2, top: -w * 0.75 }} pointerEvents="none">
          <Defs>
            <RadialGradient id={`chestGlow${tier}`} cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={look.glow} stopOpacity={0.55} />
              <Stop offset="1" stopColor={look.glow} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle cx={w} cy={w} r={w} fill={`url(#chestGlow${tier})`} />
        </Svg>
      )}
      <View
        style={[
          styles.body,
          {
            height: bodyH,
            backgroundColor: look.body,
            borderRadius: size * 0.08,
          },
        ]}>
        <View style={[styles.bandV, { left: w * 0.14, width: band, backgroundColor: look.trim }]} />
        <View style={[styles.bandV, { right: w * 0.14, width: band, backgroundColor: look.trim }]} />
        <View
          style={[
            styles.lock,
            {
              width: size * 0.18,
              height: size * 0.2,
              marginLeft: -size * 0.09,
              borderRadius: size * 0.04,
              backgroundColor: look.trim,
            },
          ]}
        />
      </View>
      <Animated.View
        style={[
          styles.lid,
          {
            height: lidH,
            bottom: bodyH - 2,
            borderTopLeftRadius: size * 0.22,
            borderTopRightRadius: size * 0.22,
            backgroundColor: look.body,
          },
          lidStyle,
        ]}>
        <View style={[styles.bandV, { left: w * 0.14, width: band, backgroundColor: look.trim }]} />
        <View style={[styles.bandV, { right: w * 0.14, width: band, backgroundColor: look.trim }]} />
        <View style={[styles.lidRim, { height: band, backgroundColor: look.trim }]} />
      </Animated.View>
    </Animated.View>
  );
}

function LootRow({ l, i }: { l: Loot; i: number }) {
  const row = (icon: React.ReactNode, title: string, sub: string, color: string) => (
    <Animated.View entering={FadeInDown.delay(250 + i * 280).duration(300)} style={[styles.loot, { borderColor: color }]}>
      <View style={styles.lootIcon}>{icon}</View>
      <View style={{ flex: 1 }}>
        <Comic size={22} color={color}>
          {title}
        </Comic>
        <T size={12} color={C.textDim}>
          {sub}
        </T>
      </View>
    </Animated.View>
  );
  switch (l.kind) {
    case 'tokens':
      return row(<TokenCoin size={30} />, t('arcade.lootTokens', { n: l.amount }), t('arcade.lootTokensSub'), C.yellow);
    case 'xp':
      return row(<Icon name="bolt" size={28} color={C.lime} />, t('arcade.lootXp', { n: l.amount }), t('arcade.lootXpSub'), C.lime);
    case 'freeze':
      return row(<T size={28}>🧊</T>, t('arcade.streakFreeze'), t('arcade.lootFreezeSub'), C.cyan);
    case 'doubler':
      return row(<T size={28}>⚡</T>, t('arcade.tokenDoubler'), t('arcade.lootDoublerSub', { wins: l.wins }), C.orange);
    case 'game':
      return row(<Icon name={l.game.icon} size={28} color={l.game.color} />, t('arcade.lootGame', { game: l.game.title }), t('arcade.lootGameSub'), l.game.color);
    case 'avatar':
      return row(<TagAvatar size={34} online={false} avatar={l.avatar.id} />, t('arcade.lootAvatar', { name: l.avatar.name }), t('arcade.lootAvatarSub'), l.avatar.band);
    case 'track':
      return row(<T size={28}>{l.track.emoji}</T>, t('arcade.lootTrack', { name: l.track.name }), t('arcade.lootTrackSub'), C.violet);
    case 'icon':
      return row(<Image source={l.icon.thumb} style={{ width: 34, height: 34, borderRadius: 8 }} />, t('arcade.lootIcon', { name: l.icon.name }), t('arcade.lootIconSub'), C.yellow);
  }
}

/** One line of loot for a share card. */
function lootLine(l: Loot) {
  switch (l.kind) {
    case 'tokens':
      return t('arcade.lootTokens', { n: l.amount });
    case 'xp':
      return t('arcade.lootXp', { n: l.amount });
    case 'freeze':
      return `🧊 ${t('arcade.streakFreeze')}`;
    case 'doubler':
      return `⚡ ${t('arcade.tokenDoubler')}`;
    case 'game':
      return t('arcade.lootGame', { game: l.game.title });
    case 'avatar':
      return t('arcade.lootAvatar', { name: l.avatar.name });
    case 'track':
      return t('arcade.lootTrack', { name: l.track.name });
    case 'icon':
      return t('arcade.lootIcon', { name: l.icon.name });
  }
}

/**
 * Full-screen chest opening: the chest bounces until tapped, shakes, pops open and the loot slides in
 * one item at a time.
 */
export function ChestOpener({ chest, day, onClose }: { chest: { id: string; tier: ChestTier } | null; day: string; onClose: () => void }) {
  // Keyed by chest so each one starts closed.
  return chest ? <ChestModal key={chest.id} chest={chest} day={day} onClose={onClose} /> : null;
}

function ChestModal({ chest, day, onClose }: { chest: { id: string; tier: ChestTier }; day: string; onClose: () => void }) {
  const [loot, setLoot] = useState<Loot[] | null>(null);
  const shake = useSharedValue(0);

  const shakeStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${shake.value}deg` }],
  }));

  const open = () => {
    if (loot) return;
    tap();
    shake.set(withSequence(withTiming(-8, { duration: 70 }), withTiming(8, { duration: 70 }), withTiming(-10, { duration: 70 }), withTiming(10, { duration: 70 }), withTiming(0, { duration: 80 })));
    setTimeout(() => setLoot(actions.openChest(chest.id, day) ?? []), 380);
  };

  const look = CHEST_LOOK[chest.tier];
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.scrim}>
        <Comic size={34} color={look.glow}>
          {loot ? t('arcade.youGot') : look.name}
        </Comic>
        <Pressable onPress={open} accessibilityRole="button" accessibilityLabel={t('arcade.openChest')} style={{ marginTop: 56, marginBottom: 28 }}>
          <Animated.View entering={ZoomIn.duration(300)} style={shakeStyle}>
            <ChestArt tier={chest.tier} size={170} open={!!loot} bounce={!loot} />
          </Animated.View>
        </Pressable>
        {loot ? (
          <View style={{ gap: 10, alignSelf: 'stretch' }}>
            {loot.map((l, i) => (
              <LootRow key={i} l={l} i={i} />
            ))}
            <Animated.View entering={FadeInDown.delay(300 + loot.length * 280)} style={{ gap: 12 }}>
              <ArcadeButton label={t('arcade.collect')} size="md" onPress={onClose} style={{ marginTop: 8 }} />
              {loot.length > 0 && (
                <Pressable
                  onPress={() => shareCard({ kind: 'chest', tier: chest.tier, lines: loot.map(lootLine), name: getState().profile.name })}
                  style={styles.share}
                  accessibilityRole="button">
                  <Icon name="share" size={16} color={C.text} />
                  <T size={14} rounded color={C.text}>
                    {t('share.shareThis')}
                  </T>
                </Pressable>
              )}
            </Animated.View>
          </View>
        ) : (
          <T size={15} rounded color={C.textDim}>
            {t('arcade.tapChestToOpen')}
          </T>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  body: { borderWidth: 3, borderColor: C.ink, overflow: 'hidden' },
  lid: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderWidth: 3,
    borderColor: C.ink,
    overflow: 'hidden',
  },
  lidRim: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  bandV: { position: 'absolute', top: 0, bottom: 0 },
  lock: {
    position: 'absolute',
    left: '50%',
    top: '18%',
    borderWidth: 2,
    borderColor: C.ink,
  },
  scrim: {
    flex: 1,
    backgroundColor: '#000000E6',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 14,
    borderWidth: 2,
    backgroundColor: C.surface,
  },
  share: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 10 },
  lootIcon: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
