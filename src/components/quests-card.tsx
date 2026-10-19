import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { C, Display, Space } from '@/constants/theme';
import { fmtWater, macroTargets } from '@/lib/nutrition';
import type { Profile } from '@/lib/types';
import { dailyQuests, PERFECT_DAY, PERFECT_REWARD, tokenBalance, type QuestState } from '@/lib/quests';
import { actions, useStore } from '@/lib/store';

import { Icon, IconBadge } from './icon';
import { Bar, Card, T } from './ui';
import { Comic } from './underground';

const TIER_LABEL = { 1: 'EASY', 2: 'MEDIUM', 3: 'HARD' } as const;

/** Arcade token: a brass coin with a stamped P. */
export function TokenCoin({ size = 18 }: { size?: number }) {
  return (
    <View style={[styles.coin, { width: size, height: size, borderRadius: size / 2, borderWidth: Math.max(1.5, size / 10) }]}>
      <Text style={{ fontFamily: Display.block, fontSize: size * 0.55, color: '#7A4A00', lineHeight: size * 0.7 }}>P</Text>
    </View>
  );
}

export function TokenCount({ value, size = 16 }: { value: number; size?: number }) {
  return (
    <View style={styles.tokens}>
      <TokenCoin size={size + 2} />
      <T size={size} rounded color={C.yellow}>
        {value.toLocaleString()}
      </T>
    </View>
  );
}

export function QuestsCard({ todayKey }: { todayKey: string }) {
  const entries = useStore((s) => s.entries);
  const profile = useStore((s) => s.profile);
  const game = useStore((s) => s.game);
  const claims = game.claims;
  const quests = useMemo(() => dailyQuests(entries, macroTargets(profile), todayKey, claims), [entries, profile, todayKey, claims]);
  const balance = useMemo(() => tokenBalance(game), [game]);
  const cleared = quests.filter((q) => q.claimed).length;
  const perfect = claims.some((c) => c.day === todayKey && c.questId === PERFECT_DAY);

  return (
    <Card style={{ gap: 12, marginTop: Space.sm }} accent={C.yellow + '99'}>
      <View style={styles.head}>
        <Icon name="target" size={18} color={C.yellow} />
        <T size={13} rounded color={C.text} style={{ flex: 1 }}>
          DAILY QUESTS
        </T>
        <TokenCount value={balance} />
      </View>
      {quests.map((q) => (
        <QuestRow key={q.id} q={q} units={profile.units} onClaim={() => actions.claimQuest(todayKey, q.id)} />
      ))}
      <View style={styles.foot}>
        <T size={11} color={perfect ? C.lime : C.textMute} weight="700" style={{ flex: 1 }}>
          {perfect ? 'PERFECT DAY CLEARED. NEW QUESTS AT MIDNIGHT.' : `${cleared}/3 CLEARED · CLEAR ALL FOR PERFECT DAY`}
        </T>
        {!perfect && (
          <View style={styles.tokens}>
            <T size={11} rounded color={C.yellow}>
              +{PERFECT_REWARD.tokens}
            </T>
            <TokenCoin size={12} />
          </View>
        )}
      </View>
    </Card>
  );
}

function QuestRow({ q, units, onClaim }: { q: QuestState; units: Profile['units']; onClaim: () => void }) {
  const ready = q.done && !q.claimed;
  const fmt = (n: number) => (q.water ? fmtWater(n, units) : String(n));
  return (
    <View style={[styles.row, q.claimed && { opacity: 0.55 }]}>
      <IconBadge name={q.icon} color={q.color} size={38} />
      <View style={{ flex: 1, gap: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Comic size={18} color={q.claimed ? C.textDim : C.text}>
            {q.title}
          </Comic>
          <T size={9} rounded color={q.color}>
            {TIER_LABEL[q.tier]}
          </T>
        </View>
        <T size={12} color={C.textDim} numberOfLines={1}>
          {q.blurb}
        </T>
        {!q.claimed && <Bar value={q.value} max={q.goal} color={q.done ? C.lime : q.color} height={5} />}
      </View>
      {q.claimed ? (
        <View style={styles.stamp}>
          <Icon name="check" size={16} color={C.lime} weight="bold" />
        </View>
      ) : ready ? (
        <Pressable onPress={onClaim} style={({ pressed }) => [styles.claim, pressed && { transform: [{ translateY: 2 }], borderBottomWidth: 2 }]} accessibilityRole="button" accessibilityLabel={`Claim ${q.title}`}>
          <Comic size={16} color={C.ink} outline={C.yellow}>
            CLAIM
          </Comic>
        </Pressable>
      ) : (
        <View style={{ alignItems: 'flex-end', gap: 2, minWidth: 58 }}>
          <T size={11} rounded color={C.textMute}>
            {fmt(Math.min(q.value, q.goal))}/{fmt(q.goal)}
          </T>
          <View style={styles.tokens}>
            <T size={11} rounded color={C.yellow}>
              +{q.tokens}
            </T>
            <TokenCoin size={12} />
          </View>
          <T size={10} rounded color={C.lime}>
            +{q.xp} XP
          </T>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  foot: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 2 },
  coin: { backgroundColor: C.yellow, borderColor: '#B37400', alignItems: 'center', justifyContent: 'center' },
  tokens: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  stamp: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 2,
    borderColor: C.lime,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '-10deg' }],
  },
  claim: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: C.yellow,
    borderWidth: 2,
    borderColor: C.ink,
    borderBottomWidth: 4,
    shadowColor: C.yellow,
    shadowOpacity: 0.9,
    shadowRadius: 8,
  },
});
