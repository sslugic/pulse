import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassButton, Icon } from '@/components/icon';
import { Card, Chip, SectionTitle, T, tap } from '@/components/ui';
import { ArcadeButton, Backdrop, Comic } from '@/components/underground';
import { C, MaxContentWidth, Space } from '@/constants/theme';
import { GOAL_INFO } from '@/lib/nutrition';
import { personaById } from '@/lib/personas';
import { mealKey, type MealSpan, type WorkoutSpan } from '@/lib/plans';
import { actions, PLAN_MEAL_XP, PLAN_WORKOUT_XP, useAiReady, useStore } from '@/lib/store';
import { useTodayKey } from '@/lib/use-today';

const AISLES = ['Produce', 'Meat & Fish', 'Dairy & Eggs', 'Bakery', 'Pantry', 'Frozen', 'Other'];

function dayLabel(k: string, todayKey: string) {
  const t = new Date(todayKey + 'T12:00');
  t.setDate(t.getDate() + 1);
  const tomorrow = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
  if (k === todayKey) return 'TODAY';
  if (k === tomorrow) return 'TOMORROW';
  return new Date(k + 'T12:00').toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' }).toUpperCase();
}

/** Meal and workout plans, made fresh each day automatically or ahead of time on request. */
export default function PlansScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ tab?: string }>();
  const [tab, setTab] = useState<'meals' | 'workouts'>(params.tab === 'workouts' ? 'workouts' : 'meals');
  const profile = useStore((s) => s.profile);
  const hasKey = useAiReady();
  const auto = useStore((s) => s.settings.autoPlans !== false);
  const persona = personaById(profile.persona);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Backdrop />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <T size={13} color={C.textDim} weight="600">
              {GOAL_INFO[profile.goal].label} · by {persona.name}
            </T>
            <Comic size={36}>YOUR PLANS</Comic>
          </View>
          <GlassButton icon="close" onPress={() => router.back()} />
        </View>

        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Chip label="🍽 Meals" active={tab === 'meals'} onPress={() => setTab('meals')} />
          <Chip label="🏋️ Workouts" active={tab === 'workouts'} onPress={() => setTab('workouts')} />
        </View>

        <Card style={{ gap: 6 }}>
          <View style={styles.between}>
            <T size={13} rounded color={C.text} style={{ flex: 1 }}>
              NEW PLAN EVERY DAY
            </T>
            <Switch value={auto} onValueChange={(v) => actions.setAutoPlans(v)} trackColor={{ true: C.lime }} />
          </View>
          <T size={12} color={C.textDim} style={{ lineHeight: 17 }}>
            {auto
              ? 'Each morning Pulse makes today’s meals and workout for your goal, unless you planned ahead. Finished days are scored against what you logged, then cleared.'
              : 'Plans are only made when you ask.'}
          </T>
          {!hasKey && (
            <T size={12} color={C.orange}>
              Add your Gemini key in Crew to make plans.
            </T>
          )}
        </Card>

        {tab === 'meals' ? <MealsTab hasKey={hasKey} /> : <WorkoutsTab hasKey={hasKey} />}
      </ScrollView>
    </View>
  );
}

function Maker<S extends string>({
  spans,
  span,
  setSpan,
  placeholder,
  onMake,
  hasKey,
  label,
}: {
  spans: { id: S; label: string }[];
  span: S;
  setSpan: (s: S) => void;
  placeholder: string;
  onMake: (prefs: string) => Promise<unknown>;
  hasKey: boolean;
  label: string;
}) {
  const [prefs, setPrefs] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <Card style={{ gap: 12 }} accent={C.orange + '88'}>
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        {spans.map((s) => (
          <Chip key={s.id} label={s.label} active={span === s.id} onPress={() => setSpan(s.id)} />
        ))}
      </View>
      <TextInput value={prefs} onChangeText={setPrefs} placeholder={placeholder} placeholderTextColor={C.textMute} style={styles.input} />
      <ArcadeButton
        label={busy ? 'PLANNING…' : label}
        size="md"
        disabled={busy || !hasKey}
        colors={['#FF9A3D', '#E8530E']}
        textColor="#fff"
        icon={busy ? <ActivityIndicator color="#fff" /> : undefined}
        onPress={async () => {
          tap();
          setBusy(true);
          setError(null);
          try {
            await onMake(prefs);
          } catch (e) {
            setError((e as Error).message || 'Couldn’t make a plan. Try again.');
          } finally {
            setBusy(false);
          }
        }}
      />
      {!!error && (
        <T size={12} color={C.danger}>
          {error}
        </T>
      )}
    </Card>
  );
}

function PlanHeader({ summary, auto, onClear }: { summary: string; auto: boolean; onClear: () => void }) {
  return (
    <Card style={{ gap: 6 }} accent={C.violet + '88'}>
      <View style={styles.between}>
        <T size={11} rounded color={C.violet}>
          {auto ? 'MADE FOR TODAY AUTOMATICALLY' : 'YOUR PLAN'}
        </T>
        <Pressable
          onPress={() =>
            Alert.alert('Clear this plan?', 'Your logged meals and workouts stay. A new plan is made tomorrow if daily plans are on.', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Clear', style: 'destructive', onPress: onClear },
            ])
          }
          hitSlop={8}>
          <T size={11} rounded color={C.danger}>
            CLEAR
          </T>
        </Pressable>
      </View>
      <T size={14} color={C.text} style={{ lineHeight: 20 }}>
        {summary}
      </T>
    </Card>
  );
}

function MealsTab({ hasKey }: { hasKey: boolean }) {
  const plan = useStore((s) => s.mealPlan);
  const todayKey = useTodayKey();
  const [span, setSpan] = useState<MealSpan>('today');
  const [view, setView] = useState<'meals' | 'grocery'>('meals');
  const entries = useStore((s) => s.entries);
  const byId = useMemo(() => new Map(entries.map((e) => [e.id, e])), [entries]);

  const grocery = useMemo(() => {
    const by = new Map<string, { item: string; qty: string }[]>();
    for (const g of plan?.grocery ?? []) {
      const aisle = AISLES.includes(g.aisle) ? g.aisle : 'Other';
      by.set(aisle, [...(by.get(aisle) ?? []), g]);
    }
    return AISLES.filter((a) => by.has(a)).map((a) => [a, by.get(a)!] as const);
  }, [plan]);

  return (
    <>
      <Maker
        spans={[
          { id: 'today', label: 'Rest of today' },
          { id: '3days', label: 'Next 3 days' },
        ]}
        span={span}
        setSpan={setSpan}
        placeholder="Preferences: vegetarian, no fish, quick dinners…"
        label={plan ? 'REPLACE MEAL PLAN' : 'MAKE MEAL PLAN'}
        hasKey={hasKey}
        onMake={(p) => actions.generateMealPlan(span, p)}
      />

      {plan && (
        <>
          <PlanHeader summary={plan.summary} auto={plan.auto} onClear={() => actions.clearMealPlan()} />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Chip label="Meals" active={view === 'meals'} onPress={() => setView('meals')} />
            <Chip label={`Groceries ${plan.checked.length}/${plan.grocery.length}`} active={view === 'grocery'} onPress={() => setView('grocery')} />
          </View>

          {view === 'meals'
            ? plan.days.map((d) => {
                const eatenCount = d.meals.filter((_, i) => plan.eaten[mealKey(d.day, i)]).length;
                return (
                  <View key={d.day}>
                    <SectionTitle right={<T size={12} rounded color={C.lime}>{eatenCount}/{d.meals.length} EATEN</T>}>{dayLabel(d.day, todayKey)}</SectionTitle>
                    <View style={{ gap: 8 }}>
                      {d.meals.map((m, i) => {
                        const matched = byId.get(plan.eaten[mealKey(d.day, i)] ?? '');
                        const canLog = d.day === todayKey && !matched;
                        return (
                          <Card key={i} style={{ gap: 8 }} accent={matched ? C.lime + '88' : undefined}>
                            <View style={styles.row}>
                              <T size={28}>{m.emoji}</T>
                              <View style={{ flex: 1 }}>
                                <T size={10} rounded color={C.orange}>
                                  {m.when.toUpperCase()}
                                </T>
                                <T size={16} rounded color={C.text}>
                                  {m.name}
                                </T>
                              </View>
                              <T size={18} rounded color={C.text}>
                                {Math.round(m.calories)}
                                <T size={11} color={C.textMute}> kcal</T>
                              </T>
                            </View>
                            <T size={12} rounded color={C.textDim}>
                              <T size={12} rounded color={C.protein}>P {Math.round(m.protein)}g</T>
                              {'  '}
                              <T size={12} rounded color={C.carbs}>C {Math.round(m.carbs)}g</T>
                              {'  '}
                              <T size={12} rounded color={C.fat}>F {Math.round(m.fat)}g</T>
                            </T>
                            {!matched && (
                              <>
                                <T size={12} color={C.textDim} style={{ lineHeight: 17 }}>
                                  {m.ingredients.join(' · ')}
                                </T>
                                <T size={12} color={C.textMute} style={{ lineHeight: 17 }}>
                                  {m.steps}
                                </T>
                              </>
                            )}
                            {matched ? (
                              <View style={styles.matched}>
                                <Icon name="check" size={14} color={C.lime} weight="bold" />
                                <T size={12} color={C.lime} style={{ flex: 1 }} numberOfLines={1}>
                                  Logged: {matched.title} · {Math.round(matched.nutrition?.calories ?? 0)} kcal
                                </T>
                              </View>
                            ) : (
                              canLog && (
                                <Pressable
                                  onPress={() => {
                                    tap();
                                    actions.logPlannedMeal(d.day, i);
                                  }}
                                  style={styles.action}>
                                  <Icon name="plus" size={14} color={C.lime} weight="bold" />
                                  <T size={12} rounded color={C.lime}>
                                    I ATE THIS · +{PLAN_MEAL_XP} XP
                                  </T>
                                </Pressable>
                              )
                            )}
                          </Card>
                        );
                      })}
                    </View>
                  </View>
                );
              })
            : grocery.map(([aisle, items]) => (
                <View key={aisle}>
                  <SectionTitle>{aisle}</SectionTitle>
                  <Card style={{ gap: 4 }}>
                    {items.map((g) => {
                      const done = plan.checked.includes(g.item);
                      return (
                        <Pressable
                          key={g.item}
                          onPress={() => {
                            tap();
                            actions.toggleGrocery(g.item);
                          }}
                          style={styles.groceryRow}
                          accessibilityRole="checkbox"
                          accessibilityState={{ checked: done }}>
                          <View style={[styles.box, done && { backgroundColor: C.lime, borderColor: C.lime }]}>{done && <Icon name="check" size={12} color={C.ink} weight="bold" />}</View>
                          <T size={14} color={done ? C.textMute : C.text} style={[{ flex: 1 }, done && { textDecorationLine: 'line-through' }]}>
                            {g.item}
                          </T>
                          <T size={12} color={C.textMute}>
                            {g.qty}
                          </T>
                        </Pressable>
                      );
                    })}
                  </Card>
                </View>
              ))}
          <T size={11} color={C.textMute} style={{ textAlign: 'center' }}>
            Meals you log through the Coach are matched to this plan automatically.
          </T>
        </>
      )}
    </>
  );
}

function WorkoutsTab({ hasKey }: { hasKey: boolean }) {
  const plan = useStore((s) => s.workoutPlan);
  const todayKey = useTodayKey();
  const [span, setSpan] = useState<WorkoutSpan>('today');
  const [open, setOpen] = useState<string | null>(todayKey);

  return (
    <>
      <Maker
        spans={[
          { id: 'today', label: 'Today' },
          { id: '3days', label: '3 days' },
          { id: '7days', label: '7 days' },
        ]}
        span={span}
        setSpan={setSpan}
        placeholder="Preferences: home only, dumbbells, bad knee, 30 min max…"
        label={plan ? 'REPLACE WORKOUT PLAN' : 'MAKE WORKOUT PLAN'}
        hasKey={hasKey}
        onMake={(p) => actions.generateWorkoutPlan(span, p)}
      />

      {plan && (
        <>
          <PlanHeader summary={plan.summary} auto={plan.auto} onClear={() => actions.clearWorkoutPlan()} />
          {plan.days.map((d) => {
            const done = !!plan.done[d.day];
            const expanded = open === d.day;
            return (
              <Card key={d.day} style={{ gap: 10 }} accent={done ? C.lime + '88' : d.day === todayKey ? C.orange + '88' : undefined}>
                <Pressable onPress={() => setOpen(expanded ? null : d.day)} style={styles.row} accessibilityRole="button">
                  <T size={28}>{d.emoji || (d.rest ? '🧘' : '🏋️')}</T>
                  <View style={{ flex: 1 }}>
                    <T size={10} rounded color={d.rest ? C.cyan : C.orange}>
                      {dayLabel(d.day, todayKey)} · {d.focus.toUpperCase()}
                    </T>
                    <T size={16} rounded color={C.text}>
                      {d.title}
                    </T>
                    <T size={11} color={C.textMute} weight="700">
                      {d.rest ? 'RECOVERY' : `${d.durationMin} MIN · ~${Math.round(d.estKcal)} KCAL · ${d.exercises.length} EXERCISES`}
                    </T>
                  </View>
                  {done ? <Icon name="check" size={20} color={C.lime} weight="bold" /> : <Icon name={expanded ? 'minus' : 'plus'} size={16} color={C.textMute} />}
                </Pressable>
                {expanded &&
                  d.exercises.map((x, i) => (
                    <View key={i} style={styles.exercise}>
                      <View style={styles.row}>
                        <T size={14} rounded color={C.text} style={{ flex: 1 }}>
                          {x.name}
                        </T>
                        <T size={12} rounded color={C.lime}>
                          {x.sets === '1' ? x.reps : `${x.sets} × ${x.reps}`}
                        </T>
                      </View>
                      <T size={11} color={C.textMute}>
                        Rest {x.rest} · {x.notes}
                      </T>
                    </View>
                  ))}
                {d.day === todayKey && !d.rest && !done && (
                  <Pressable
                    onPress={() => {
                      tap();
                      actions.completeWorkout(d.day);
                    }}
                    style={styles.action}>
                    <Icon name="check" size={14} color={C.lime} weight="bold" />
                    <T size={12} rounded color={C.lime}>
                      MARK DONE · +{PLAN_WORKOUT_XP} XP
                    </T>
                  </Pressable>
                )}
              </Card>
            );
          })}
          <T size={11} color={C.textMute} style={{ textAlign: 'center' }}>
            A workout you log through the Coach or Apple Health counts as today’s session.
          </T>
        </>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: Space.md, paddingTop: Space.lg, gap: Space.sm, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: Space.sm },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  input: { padding: 12, borderRadius: 10, backgroundColor: '#1D2023', borderWidth: 2, borderColor: '#3A3F43', color: C.text, fontSize: 14 },
  action: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8, borderRadius: 8, borderWidth: 2, borderColor: C.lime + '88', backgroundColor: '#1E2A16' },
  matched: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: 8, borderRadius: 8, backgroundColor: '#1E2A16' },
  exercise: { gap: 2, paddingTop: 8, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)' },
  groceryRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  box: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: C.textMute, alignItems: 'center', justifyContent: 'center' },
});
