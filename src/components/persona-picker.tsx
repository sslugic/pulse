import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

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

/** Pick who coaches you. Locked personas show their token price; tapping one you can afford buys it. */
export function PersonaPicker() {
  const game = useStore((s) => s.game);
  const current = personaById(useStore((s) => s.profile.persona)).id;
  const balance = tokenBalance(game);
  const [short, setShort] = useState<string | null>(null);

  return (
    <Card style={{ gap: 10 }} accent={C.violet + '88'}>
      <View style={styles.head}>
        <T size={12} color={C.textDim} style={{ flex: 1, lineHeight: 17 }}>
          {t('crew.personaIntro')}
        </T>
        <TokenCount value={balance} />
      </View>
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
            accessibilityLabel={open ? p.name : t('crew.personaLockedA11y', { name: p.name, price: p.price })}
            style={({ pressed }) => [styles.row, active && styles.active, pressed && { opacity: 0.8 }]}>
            <View style={[styles.avatar, active && { borderColor: C.lime }]}>
              <T size={24}>{p.emoji}</T>
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Comic size={18} color={open ? C.text : C.textDim}>
                {p.name.toUpperCase()}
              </Comic>
              <T size={12} color={C.textDim}>
                {short === p.id ? t('crew.personaNeedTokens', { count: p.price - balance }) : p.tagline}
              </T>
            </View>
            {active ? (
              <T size={11} rounded color={C.lime}>
                {t('crew.personaActive')}
              </T>
            ) : open ? (
              <Icon name="chevron" size={14} color={C.textMute} />
            ) : (
              <View style={styles.price}>
                <Icon name="lock" size={12} color={balance >= p.price ? C.yellow : C.textMute} />
                <T size={13} rounded color={balance >= p.price ? C.yellow : C.textMute}>
                  {p.price}
                </T>
                <TokenCoin size={14} />
              </View>
            )}
          </Pressable>
        );
      })}
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 8, borderRadius: 10, borderWidth: 2, borderColor: 'transparent' },
  active: { borderColor: C.lime + '88', backgroundColor: '#1E2A16' },
  avatar: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1D2023', borderWidth: 2, borderColor: '#3A3F43' },
  price: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
