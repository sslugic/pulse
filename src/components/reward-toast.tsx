import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FullWindowOverlay } from 'react-native-screens';

import { C } from '@/constants/theme';
import { actions, useStore } from '@/lib/store';

import { TokenCoin } from './quests-card';
import { T } from './ui';
import { Comic } from './underground';

/** Arcade "+XP" pop-up shown over every screen after a log or a quest claim. */
export function RewardToast() {
  const reward = useStore((s) => s.reward);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!reward) return;
    const id = reward.id;
    const t = setTimeout(() => actions.clearReward(id), 1800);
    return () => clearTimeout(t);
  }, [reward]);

  if (!reward) return null;
  // Native stack screens draw above ordinary siblings, so the pop-up needs its own window layer.
  return (
    <FullWindowOverlay>
      <View pointerEvents="none" style={[styles.wrap, { top: insets.top + 8 }]}>
        <Animated.View key={reward.id} entering={FadeInDown.duration(220)} exiting={FadeOutUp.duration(250)} style={styles.toast}>
          <T size={11} rounded color={C.textDim}>
            {reward.label}
          </T>
          {reward.xp > 0 && (
            <Comic size={24} color={C.lime}>
              {`+${reward.xp} XP`}
            </Comic>
          )}
          {reward.tokens > 0 && (
            <View style={styles.tokens}>
              <Comic size={24} color={C.yellow}>
                {`+${reward.tokens}`}
              </Comic>
              <TokenCoin size={20} />
            </View>
          )}
        </Animated.View>
      </View>
    </FullWindowOverlay>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 100,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(11,12,13,0.92)',
    borderWidth: 2,
    borderColor: C.lime,
    shadowColor: C.lime,
    shadowOpacity: 0.7,
    shadowRadius: 10,
  },
  tokens: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
