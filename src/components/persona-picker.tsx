import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { C } from '@/constants/theme';
import { tap } from '@/lib/haptics';
import { t } from '@/lib/i18n';
import { isPersonaUnlocked, PERSONAS, personaById } from '@/lib/personas';
import { tokenBalance } from '@/lib/quests';
import { actions, useStore } from '@/lib/store';

import { Icon } from './icon';
import { TokenCoin, TokenCount } from './quests-card';
import { Card, T } from './ui';
import { Comic } from './underground';

/**
 * Pick who coaches you, from a side-scrolling row of portraits (like the walls). Locked coaches show
 * their token price; tapping one you can afford buys it.
 */
export function PersonaPicker() {
  const game = useStore((s) => s.game);
  const current = personaById(useStore((s) => s.profile.persona)).id;
  const balance = tokenBalance(game);
  const [short, setShort] = useState<string | null>(null);
  const shortOf = short ? personaById(short) : null;

  return (
    <Card style={{ gap: 12 }} accent={C.violet + '88'}>
      <View style={styles.head}>
        <T size={12} color={C.textDim} style={{ flex: 1, lineHeight: 17 }}>
          {shortOf ? t('crew.personaNeedTokens', { count: shortOf.price - balance }) : t('crew.personaIntro')}
        </T>
        <TokenCount value={balance} />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
        {PERSONAS.map((p) => {
          const open = isPersonaUnlocked(p.id, game.unlocked);
          const active = p.id === current;
          return (
            <Pressable
              key={p.id}
              onPress={() => {
                tap();
                setShort(actions.choosePersona(p.id) ? null : p.id);
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={open ? `${p.name}. ${p.tagline}` : t('crew.personaLockedA11y', { name: p.name, price: p.price })}
              style={({ pressed }) => [styles.cell, pressed && { opacity: 0.8 }]}>
              <View style={[styles.frame, active && styles.frameActive]}>
                {p.portrait ? (
                  <Image source={p.portrait} style={[styles.portrait, !open && styles.locked]} contentFit="cover" contentPosition="top" />
                ) : (
                  <View style={[styles.portrait, styles.emoji, !open && styles.locked]}>
                    <T size={40}>{p.emoji}</T>
                  </View>
                )}
                {!open && (
                  <View style={styles.price}>
                    <Icon name="lock" size={11} color={balance >= p.price ? C.yellow : C.text} />
                    <T size={12} rounded color={balance >= p.price ? C.yellow : C.text}>
                      {p.price}
                    </T>
                    <TokenCoin size={13} />
                  </View>
                )}
              </View>
              <Comic size={16} color={open ? C.text : C.textDim} style={{ textAlign: 'center' }}>
                {p.name.toUpperCase()}
              </Comic>
              <T size={10} color={active ? C.lime : C.textMute} numberOfLines={2} style={{ textAlign: 'center' }}>
                {active ? t('crew.personaActive') : p.tagline}
              </T>
            </Pressable>
          );
        })}
      </ScrollView>
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cell: { width: 96, gap: 4, alignItems: 'center' },
  frame: { width: 96, height: 128, borderRadius: 12, overflow: 'hidden', borderWidth: 2, borderColor: C.ink, backgroundColor: '#1D2023' },
  frameActive: { borderColor: C.lime },
  portrait: { width: '100%', height: '100%' },
  emoji: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#241B33' },
  locked: { opacity: 0.4 },
  price: { position: 'absolute', bottom: 6, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, backgroundColor: '#000000AA' },
});
