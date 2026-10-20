import { Image } from 'expo-image';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { C, Radius } from '@/constants/theme';
import { locale, t } from '@/lib/i18n';
import { journalPhotoUri } from '@/lib/media';
import { fmtKg, fmtWater } from '@/lib/nutrition';
import { moodEmoji } from '@/lib/wellbeing';
import { actions, useStore } from '@/lib/store';
import type { Entry } from '@/lib/types';

import { T, tap } from './ui';

const SOURCE_KEY = { text: 'log.sourceText', voice: 'log.sourceVoice', photo: 'log.sourcePhoto', quick: 'log.sourceQuick' } as const;
const INTENSITY_KEY = { low: 'log.intensityLow', moderate: 'log.intensityModerate', high: 'log.intensityHigh' } as const;

const KIND_COLOR = { meal: C.eaten, exercise: C.burned, water: C.water, weight: C.violet, journal: C.pink } as const;

function journalSub(e: Entry) {
  const bits = [
    e.sleepHours != null && t('log.sleptHours', { h: e.sleepHours }),
    e.stress != null && t('log.stressScore', { n: Math.round(e.stress) }),
    e.energy != null && t('log.energyScore', { n: Math.round(e.energy) }),
    e.photo && t('log.photo'),
  ].filter(Boolean);
  return bits.length ? bits.join(' · ') : (e.tags ?? []).slice(0, 2).join(' · ') || t('log.journal');
}

export function EntryRow({ entry, compact }: { entry: Entry; compact?: boolean }) {
  const units = useStore((s) => s.profile.units);
  const [open, setOpen] = useState(false);
  const color = KIND_COLOR[entry.kind];

  const value =
    entry.kind === 'meal' ? `${Math.round(entry.nutrition?.calories ?? 0)}`
    : entry.kind === 'exercise' ? `−${Math.round(entry.caloriesBurned ?? 0)}`
    : entry.kind === 'water' ? fmtWater(entry.waterMl ?? 0, units)
    : entry.kind === 'journal' ? (entry.mood ? moodEmoji(entry.mood) : entry.sleepHours != null ? `${entry.sleepHours}h` : '')
    : fmtKg(entry.weightKg ?? 0, units);
  const unit = entry.kind === 'meal' || entry.kind === 'exercise' ? 'kcal' : '';

  const sub =
    entry.kind === 'meal' && entry.nutrition
      ? t('log.macroLine', { p: Math.round(entry.nutrition.protein), c: Math.round(entry.nutrition.carbs), f: Math.round(entry.nutrition.fat) })
      : entry.passive
        ? t('log.fromHealthLive')
      : entry.kind === 'exercise'
        ? `${t('log.minutes', { n: entry.durationMin ?? '?' })}${entry.intensity ? ` · ${t(INTENSITY_KEY[entry.intensity])}` : ''}`
        : entry.kind === 'water' ? t('log.hydration')
        : entry.kind === 'journal' ? journalSub(entry)
        : t('log.weighIn');

  const time = new Date(entry.createdAt).toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' });

  return (
    <Pressable
      onPress={() => {
        tap();
        setOpen((o) => !o);
      }}
      onLongPress={() =>
        Alert.alert(t('log.removeTitle'), entry.title, [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('common.remove'), style: 'destructive', onPress: () => actions.removeEntry(entry.id) },
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
                entry.nutrition.fiber != null && t('log.fiber', { n: Math.round(entry.nutrition.fiber) }),
                entry.nutrition.sugar != null && t('log.sugar', { n: Math.round(entry.nutrition.sugar) }),
                entry.nutrition.sodium != null && t('log.sodium', { n: Math.round(entry.nutrition.sodium) }),
              ]
                .filter(Boolean)
                .join(' · ')}
            </T>
          )}
          {entry.kind === 'journal' && !!entry.summary && (
            <T size={14} color={C.text} style={{ lineHeight: 20 }}>
              “{entry.summary}”
            </T>
          )}
          {!!entry.photo && <Image source={{ uri: journalPhotoUri(entry.photo) }} style={styles.photo} contentFit="cover" />}
          {!!entry.tags?.length && (
            <View style={styles.tags}>
              {entry.tags.map((tag) => (
                <View key={tag} style={styles.tag}>
                  <T size={11} weight="700" color={C.pink}>
                    {tag}
                  </T>
                </View>
              ))}
            </View>
          )}
          {!!entry.note && (
            <T size={13} color={C.text} style={{ marginTop: 4 }}>
              💡 {entry.note}
            </T>
          )}
          <T size={11} color={C.textMute} style={{ marginTop: 4 }}>
            {entry.confidence != null ? t('log.aiConfidence', { pct: Math.round(entry.confidence * 100) }) : ''}
            {t('log.viaHoldToRemove', { source: t(SOURCE_KEY[entry.source]) })}
          </T>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    backgroundColor: '#25292D',
    borderRadius: Radius.md,
    padding: 12,
    borderWidth: 2,
    borderColor: '#4E5458',
    borderBottomWidth: 4,
    borderBottomColor: '#0E1011',
  },
  compact: { backgroundColor: '#2C3135' },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  emoji: { width: 44, height: 44, borderRadius: 10, borderWidth: 2, borderColor: '#0E1011', alignItems: 'center', justifyContent: 'center' },
  detail: { marginTop: 10, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border, gap: 4 },
  item: { flexDirection: 'row', gap: 8 },
  photo: { width: '100%', aspectRatio: 4 / 3, borderRadius: 14, marginTop: 4 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 },
  tag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: C.pink + '1F' },
});
