import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { C, Radius } from '@/constants/theme';
import { fmtKg, fmtWater } from '@/lib/nutrition';
import { actions, useStore } from '@/lib/store';
import type { Entry } from '@/lib/types';

import { T, tap } from './ui';

const KIND_COLOR = { meal: C.eaten, exercise: C.burned, water: C.water, weight: C.violet } as const;

export function EntryRow({ entry, compact }: { entry: Entry; compact?: boolean }) {
  const units = useStore((s) => s.profile.units);
  const [open, setOpen] = useState(false);
  const color = KIND_COLOR[entry.kind];

  const value =
    entry.kind === 'meal' ? `${Math.round(entry.nutrition?.calories ?? 0)}`
    : entry.kind === 'exercise' ? `−${Math.round(entry.caloriesBurned ?? 0)}`
    : entry.kind === 'water' ? fmtWater(entry.waterMl ?? 0, units)
    : fmtKg(entry.weightKg ?? 0, units);
  const unit = entry.kind === 'meal' || entry.kind === 'exercise' ? 'kcal' : '';

  const sub =
    entry.kind === 'meal' && entry.nutrition
      ? `P ${Math.round(entry.nutrition.protein)}g · C ${Math.round(entry.nutrition.carbs)}g · F ${Math.round(entry.nutrition.fat)}g`
      : entry.kind === 'exercise'
        ? `${entry.durationMin ?? '?'} min${entry.intensity ? ` · ${entry.intensity}` : ''}`
        : entry.kind === 'water' ? 'Hydration' : 'Weigh-in';

  const time = new Date(entry.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  return (
    <Pressable
      onPress={() => {
        tap();
        setOpen((o) => !o);
      }}
      onLongPress={() =>
        Alert.alert('Remove entry?', entry.title, [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Remove', style: 'destructive', onPress: () => actions.removeEntry(entry.id) },
        ])
      }
      style={({ pressed }) => [styles.row, compact && styles.compact, pressed && { opacity: 0.8 }]}>
      <View style={styles.top}>
        <View style={[styles.emoji, { backgroundColor: color + '22' }]}>
          <T size={22}>{entry.emoji || '•'}</T>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <T size={15} weight="600" numberOfLines={1}>
            {entry.title}
          </T>
          <T size={12} color={C.textDim} numberOfLines={1}>
            {sub} · {time}
          </T>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <T size={17} weight="800" color={color} rounded>
            {value}
          </T>
          {!!unit && (
            <T size={10} color={C.textMute} weight="600">
              {unit}
            </T>
          )}
        </View>
      </View>

      {open && (
        <View style={styles.detail}>
          {entry.items?.map((it, i) => (
            <View key={i} style={styles.item}>
              <T size={13} color={C.textDim} style={{ flex: 1 }} numberOfLines={1}>
                {it.name} <T size={13} color={C.textMute}>· {it.amount}</T>
              </T>
              <T size={13} color={C.textDim} weight="600">
                {Math.round(it.calories)}
              </T>
            </View>
          ))}
          {entry.kind === 'meal' && entry.nutrition && (
            <T size={12} color={C.textMute}>
              {[
                entry.nutrition.fiber != null && `Fiber ${Math.round(entry.nutrition.fiber)}g`,
                entry.nutrition.sugar != null && `Sugar ${Math.round(entry.nutrition.sugar)}g`,
                entry.nutrition.sodium != null && `Sodium ${Math.round(entry.nutrition.sodium)}mg`,
              ]
                .filter(Boolean)
                .join(' · ')}
            </T>
          )}
          {!!entry.note && (
            <T size={13} color={C.text} style={{ marginTop: 4 }}>
              💡 {entry.note}
            </T>
          )}
          <T size={11} color={C.textMute} style={{ marginTop: 4 }}>
            {entry.confidence != null ? `AI confidence ${Math.round(entry.confidence * 100)}% · ` : ''}via {entry.source} · hold to
            remove
          </T>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    backgroundColor: C.surface,
    borderRadius: Radius.md,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.border,
  },
  compact: { backgroundColor: C.surfaceHi },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  emoji: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  detail: { marginTop: 10, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border, gap: 4 },
  item: { flexDirection: 'row', gap: 8 },
});
