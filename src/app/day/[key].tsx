import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EntryRow } from '@/components/entry-row';
import { QuestsCard } from '@/components/quests-card';
import { GlassButton, Icon } from '@/components/icon';
import { Bar, Card, SectionTitle, T, tap } from '@/components/ui';
import { Backdrop, Comic } from '@/components/underground';
import { C, MaxContentWidth, Space } from '@/constants/theme';
import { locale, t } from '@/lib/i18n';
import { dayKey, fmtWater, macroTargets, summarize } from '@/lib/nutrition';
import { resultFor } from '@/lib/plans';
import { dailyQuests } from '@/lib/quests';
import { useStore } from '@/lib/store';
import { useTodayKey } from '@/lib/use-today';
import { dayWellbeing, LEVEL_COLOR, MOODS } from '@/lib/wellbeing';

const LEVEL_KEY = { low: 'log.levelLow', moderate: 'log.levelModerate', high: 'log.levelHigh', 'very high': 'log.levelVeryHigh' } as const;

const shift = (key: string, days: number) => {
  const d = new Date(key + 'T12:00');
  d.setDate(d.getDate() + days);
  return dayKey(d);
};

/** Read-only look back at one day: fuel, macros, water, mind and everything logged. */
export default function DayScreen() {
  const insets = useSafeAreaInsets();
  const todayKey = useTodayKey();
  const params = useLocalSearchParams<{ key: string }>();
  const key = /^\d{4}-\d{2}-\d{2}$/.test(params.key ?? '') ? params.key! : todayKey;

  const entries = useStore((s) => s.entries);
  const profile = useStore((s) => s.profile);
  const claims = useStore((s) => s.game.claims);
  const tg = macroTargets(profile);

  const day = useMemo(() => summarize(entries, key), [entries, key]);
  const list = useMemo(() => entries.filter((e) => dayKey(e.createdAt) === key), [entries, key]);
  const mind = useMemo(() => dayWellbeing(entries, key), [entries, key]);
  const mealPlan = useStore((s) => s.mealPlan);
  const workoutPlan = useStore((s) => s.workoutPlan);
  const history = useStore((s) => s.planHistory);
  const planResult = useMemo(() => resultFor(key, mealPlan, workoutPlan) ?? history[key], [key, mealPlan, workoutPlan, history]);
  const quests = useMemo(() => dailyQuests(entries, tg, key, claims), [entries, tg, key, claims]);

  const net = day.eaten - day.burned;
  const onTarget = day.eaten > 0 && Math.abs(net - tg.calories) <= tg.calories * 0.12;
  const isToday = key === todayKey;
  const title = isToday ? t('common.today') : new Date(key + 'T12:00').toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase();

  const go = (days: number) => {
    tap();
    router.setParams({ key: shift(key, days) });
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Backdrop />
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + Space.sm, paddingBottom: insets.bottom + 40 }]}>
        <View style={styles.header}>
          <GlassButton icon="back" onPress={() => router.back()} />
          <View style={{ flex: 1, alignItems: 'center' }}>
            <T size={12} color={C.textDim} weight="600">
              {t('log.dayLog')}
            </T>
            <Comic size={28}>{title}</Comic>
          </View>
          <View style={{ width: 44 }} />
        </View>

        <View style={styles.nav}>
          <Pressable onPress={() => go(-1)} style={styles.navBtn} accessibilityLabel={t('log.prevDay')}>
            <Icon name="back" size={16} color={C.text} weight="bold" />
            <T size={12} rounded>
              {t('log.prev')}
            </T>
          </Pressable>
          {onTarget ? (
            <T size={12} rounded color={C.lime}>
              {t('log.onTarget')}
            </T>
          ) : (
            <T size={12} rounded color={C.textMute}>
              {day.eaten > 0 ? t('log.offTarget') : t('log.noMeals')}
            </T>
          )}
          <Pressable onPress={() => go(1)} disabled={isToday} style={[styles.navBtn, isToday && { opacity: 0.3 }]} accessibilityLabel={t('log.nextDay')}>
            <T size={12} rounded>
              {t('log.next')}
            </T>
            <Icon name="chevron" size={16} color={C.text} weight="bold" />
          </Pressable>
        </View>

        {/* Fuel */}
        <Card style={{ gap: 12 }}>
          <View style={styles.row3}>
            <Stat label={t('common.eaten')} value={Math.round(day.eaten).toLocaleString(locale)} color={C.eaten} />
            <Stat label={t('common.burned')} value={Math.round(day.burned).toLocaleString(locale)} color={C.burned} />
            <Stat label={t('common.net')} value={Math.round(net).toLocaleString(locale)} sub={t('log.ofTarget', { n: tg.calories.toLocaleString(locale) })} color={onTarget ? C.lime : C.text} />
          </View>
          <Macro label={t('common.protein')} value={day.protein} target={tg.protein} color={C.protein} unit="g" />
          <Macro label={t('common.carbs')} value={day.carbs} target={tg.carbs} color={C.carbs} unit="g" />
          <Macro label={t('common.fat')} value={day.fat} target={tg.fat} color={C.fat} unit="g" />
          <View style={{ gap: 6 }}>
            <View style={styles.between}>
              <T size={13} rounded>
                {t('log.water')}
              </T>
              <T size={13} color={C.textDim}>
                <T size={13} rounded color={C.water}>
                  {fmtWater(day.water, profile.units)}
                </T>{' '}
                / {fmtWater(tg.waterMl, profile.units)}
              </T>
            </View>
            <Bar value={day.water} max={tg.waterMl} color={C.water} />
          </View>
          <T size={12} color={C.textMute} weight="700">
            {t('log.meals', { count: day.meals })} · {t('log.workouts', { count: day.workouts })} · {t('log.activeMin', { n: day.activeMin })}
          </T>
        </Card>

        {/* Mind */}
        <Card style={{ gap: 8, marginTop: Space.sm }} accent={mind.level ? LEVEL_COLOR[mind.level] + 'AA' : undefined}>
          <T size={12} rounded color={mind.level ? LEVEL_COLOR[mind.level] : C.textDim}>
            {mind.stress != null ? t('log.stressLevel', { n: mind.stress, level: mind.level ? t(LEVEL_KEY[mind.level]) : '' }) : t('log.noMindCheckIn')}
          </T>
          <View style={styles.row3}>
            <Stat label={t('log.sleep')} value={mind.sleepHours != null ? `${mind.sleepHours}h` : '—'} color={C.violet} />
            <Stat label={t('log.mood')} value={mind.mood ? MOODS[Math.round(mind.mood) - 1].emoji : '—'} color={C.text} />
            <Stat label={t('log.energy')} value={mind.energy ? `${mind.energy.toFixed(0)}/5` : '—'} color={C.lime} />
          </View>
        </Card>

        {/* How the day went against its plan */}
        {planResult && (
          <Card style={{ gap: 6, marginTop: Space.sm }} accent={C.violet + '88'}>
            <T size={12} rounded color={C.violet}>
              {t('log.plan')}
            </T>
            <View style={styles.between}>
              <T size={14} color={C.text}>
                {t('log.plannedMealsEaten')}
              </T>
              <T size={14} rounded color={planResult.mealsEaten >= planResult.mealsPlanned && planResult.mealsPlanned ? C.lime : C.text}>
                {planResult.mealsEaten}/{planResult.mealsPlanned}
              </T>
            </View>
            {planResult.workout && (
              <View style={styles.between}>
                <T size={14} color={C.text}>
                  {t('log.plannedWorkout')}
                </T>
                <T size={14} rounded color={planResult.workout === 'done' ? C.lime : planResult.workout === 'rest' ? C.cyan : isToday ? C.textDim : C.textMute}>
                  {planResult.workout === 'done' ? t('common.done') : planResult.workout === 'rest' ? t('log.restDay') : isToday ? t('log.toDo') : t('common.missed')}
                </T>
              </View>
            )}
          </Card>
        )}

        {/* Quests: today is live (same card as HQ, with Claim); past days show how they ended */}
        {isToday ? (
          <>
            <SectionTitle>{t('log.quests')}</SectionTitle>
            <QuestsCard todayKey={key} />
          </>
        ) : (
          <>
            <SectionTitle right={<T size={12} rounded color={C.textMute}>{t('log.questsClaimed', { n: quests.filter((q) => q.claimed).length })}</T>}>{t('log.quests')}</SectionTitle>
            <Card style={{ gap: 10 }}>
              {quests.map((q) => (
                <View key={q.id} style={styles.between}>
                  <T size={14} rounded color={q.done ? C.text : C.textMute}>
                    {q.title}
                  </T>
                  <T size={12} rounded color={q.claimed ? C.lime : q.done ? C.yellow : C.textMute}>
                    {q.claimed ? t('common.claimed') : q.done ? t('common.done') : t('common.missed')}
                  </T>
                </View>
              ))}
            </Card>
          </>
        )}

        {/* Log */}
        <SectionTitle right={<T size={12} rounded color={C.textMute}>{t('common.entries', { count: list.length })}</T>}>{t('log.logTitle')}</SectionTitle>
        {list.length === 0 ? (
          <Card style={{ alignItems: 'center', paddingVertical: Space.lg }}>
            <T size={13} color={C.textDim}>
              {t('log.nothingLogged')}
            </T>
          </Card>
        ) : (
          <View style={{ gap: 8 }}>
            {list.map((e) => (
              <EntryRow key={e.id} entry={e} />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function Stat({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <T size={11} rounded color={C.textDim}>
        {label}
      </T>
      <T size={24} rounded color={color}>
        {value}
      </T>
      {!!sub && (
        <T size={10} color={C.textMute} weight="700">
          {sub.toUpperCase()}
        </T>
      )}
    </View>
  );
}

function Macro({ label, value, target, color, unit }: { label: string; value: number; target: number; color: string; unit: string }) {
  return (
    <View style={{ gap: 6 }}>
      <View style={styles.between}>
        <T size={13} rounded>
          {label.toUpperCase()}
        </T>
        <T size={13} color={C.textDim}>
          <T size={13} rounded color={color}>
            {Math.round(value)}
          </T>{' '}
          / {target} {unit}
        </T>
      </View>
      <Bar value={value} max={target} color={color} />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: Space.md, gap: Space.sm, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: Space.xs },
  navBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: C.surfaceHi,
    borderWidth: 2,
    borderColor: C.ink,
  },
  row3: { flexDirection: 'row', gap: Space.sm },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
