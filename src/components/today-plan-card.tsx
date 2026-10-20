import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { C, Space } from '@/constants/theme';
import { t } from '@/lib/i18n';
import { mealKey } from '@/lib/plans';
import { useAiReady, useStore } from '@/lib/store';

import { Icon } from './icon';
import { Card, T, tap } from './ui';

/** HQ summary of today's plan: next meal to eat and today's workout, each ticked off as it's logged. */
export function TodayPlanCard({ todayKey }: { todayKey: string }) {
  const meals = useStore((s) => s.mealPlan);
  const workouts = useStore((s) => s.workoutPlan);
  const hasKey = useAiReady();
  const md = meals?.days.find((d) => d.day === todayKey);
  const wd = workouts?.days.find((d) => d.day === todayKey);

  const open = (tab: 'meals' | 'workouts') => {
    tap();
    router.push({ pathname: '/plans', params: { tab } });
  };

  if (!md && !wd) {
    if (!hasKey) return null;
    return (
      <Card style={{ marginTop: Space.sm }} onPress={() => open('meals')}>
        <View style={styles.row}>
          <Icon name="calendar" size={18} color={C.orange} />
          <T size={13} rounded color={C.text} style={{ flex: 1 }}>
            {t('hq.planOnItsWay')}
          </T>
          <Icon name="chevron" size={14} color={C.textMute} />
        </View>
      </Card>
    );
  }

  const eaten = md ? md.meals.filter((_, i) => meals!.eaten[mealKey(todayKey, i)]).length : 0;
  const next = md?.meals.find((_, i) => !meals!.eaten[mealKey(todayKey, i)]);
  const done = !!workouts?.done[todayKey];

  return (
    <Card style={{ gap: 10, marginTop: Space.sm }} accent={C.violet + '88'}>
      <T size={13} rounded color={C.text}>
        {t('hq.todaysPlan')}
      </T>
      {md && (
        <Pressable onPress={() => open('meals')} style={styles.row} accessibilityRole="button">
          <T size={22}>{next?.emoji ?? '✅'}</T>
          <View style={{ flex: 1 }}>
            <T size={10} rounded color={C.orange}>
              {next ? t('hq.nextMeal', { when: next.when.toUpperCase() }) : t('hq.allMealsEaten')} · {eaten}/{md.meals.length}
            </T>
            <T size={14} rounded color={C.text} numberOfLines={1}>
              {next ? `${next.name} · ${Math.round(next.calories)} kcal` : t('hq.planComplete')}
            </T>
          </View>
          <Icon name="chevron" size={14} color={C.textMute} />
        </Pressable>
      )}
      {wd && (
        <Pressable onPress={() => open('workouts')} style={styles.row} accessibilityRole="button">
          <T size={22}>{done ? '✅' : wd.emoji || '🏋️'}</T>
          <View style={{ flex: 1 }}>
            <T size={10} rounded color={wd.rest ? C.cyan : done ? C.lime : C.orange}>
              {wd.rest ? t('hq.restDay') : done ? t('hq.workoutDone') : t('hq.workoutMin', { n: wd.durationMin })}
            </T>
            <T size={14} rounded color={C.text} numberOfLines={1}>
              {wd.title}
            </T>
          </View>
          <Icon name="chevron" size={14} color={C.textMute} />
        </Pressable>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});
