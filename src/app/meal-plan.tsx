import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassButton, Icon } from '@/components/icon';
import { Card, Chip, SectionTitle, T, tap } from '@/components/ui';
import { ArcadeButton, Backdrop, Comic } from '@/components/underground';
import { C, MaxContentWidth, Space } from '@/constants/theme';
import { personaById } from '@/lib/personas';
import { actions, useStore } from '@/lib/store';

const AISLES = ['Produce', 'Meat & Fish', 'Dairy & Eggs', 'Bakery', 'Pantry', 'Frozen', 'Other'];

/** AI meal plan that fits today's remaining macros (or 3 full days), with one-tap logging and a grocery checklist. */
export default function MealPlanScreen() {
  const insets = useSafeAreaInsets();
  const saved = useStore((s) => s.mealPlan);
  const hasKey = useStore((s) => !!s.settings.apiKey);
  const persona = personaById(useStore((s) => s.profile.persona));
  const [span, setSpan] = useState<'today' | '3days'>(saved?.span ?? 'today');
  const [prefs, setPrefs] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'meals' | 'grocery'>('meals');

  const generate = async () => {
    tap();
    setBusy(true);
    setError(null);
    try {
      await actions.generateMealPlan(span, prefs);
      setTab('meals');
    } catch (e) {
      setError((e as Error).message || 'Couldn’t make a plan. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const grocery = useMemo(() => {
    const by = new Map<string, { item: string; qty: string }[]>();
    for (const g of saved?.plan.grocery ?? []) {
      const aisle = AISLES.includes(g.aisle) ? g.aisle : 'Other';
      by.set(aisle, [...(by.get(aisle) ?? []), g]);
    }
    return AISLES.filter((a) => by.has(a)).map((a) => [a, by.get(a)!] as const);
  }, [saved]);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Backdrop />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <T size={13} color={C.textDim} weight="600">
              Built around your targets by {persona.name}
            </T>
            <Comic size={36}>MEAL PLAN</Comic>
          </View>
          <GlassButton icon="close" onPress={() => router.back()} />
        </View>

        <Card style={{ gap: 12 }} accent={C.orange + '99'}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Chip label="Rest of today" active={span === 'today'} onPress={() => setSpan('today')} />
            <Chip label="Next 3 days" active={span === '3days'} onPress={() => setSpan('3days')} />
          </View>
          <TextInput
            value={prefs}
            onChangeText={setPrefs}
            placeholder="Preferences (optional): vegetarian, no fish, quick dinners…"
            placeholderTextColor={C.textMute}
            style={styles.input}
          />
          <ArcadeButton
            label={busy ? 'COOKING…' : saved ? 'MAKE A NEW PLAN' : 'MAKE MY PLAN'}
            size="md"
            disabled={busy || !hasKey}
            onPress={generate}
            colors={['#FF9A3D', '#E8530E']}
            textColor="#fff"
            icon={busy ? <ActivityIndicator color="#fff" /> : <Icon name="fork" size={20} color="#fff" weight="bold" />}
          />
          {!hasKey && (
            <T size={12} color={C.orange}>
              Add your Gemini key in Crew to make plans.
            </T>
          )}
          {!!error && (
            <T size={12} color={C.danger}>
              {error}
            </T>
          )}
        </Card>

        {saved && (
          <>
            <Card style={{ gap: 6, marginTop: Space.sm }} accent={C.violet + '88'}>
              <T size={11} rounded color={C.violet}>
                {persona.name.toUpperCase()} SAYS
              </T>
              <T size={14} color={C.text} style={{ lineHeight: 20 }}>
                {saved.plan.summary}
              </T>
            </Card>

            <View style={{ flexDirection: 'row', gap: 8, marginTop: Space.sm }}>
              <Chip label={`Meals (${saved.plan.days.reduce((n, d) => n + d.meals.length, 0)})`} active={tab === 'meals'} onPress={() => setTab('meals')} />
              <Chip label={`Groceries ${saved.checked.length}/${saved.plan.grocery.length}`} active={tab === 'grocery'} onPress={() => setTab('grocery')} />
            </View>

            {tab === 'meals'
              ? saved.plan.days.map((d, di) => (
                  <View key={d.label + di}>
                    {saved.plan.days.length > 1 && <SectionTitle>{d.label}</SectionTitle>}
                    <View style={{ gap: 8, marginTop: saved.plan.days.length > 1 ? 0 : Space.sm }}>
                      {d.meals.map((m, mi) => {
                        const key = `${di}-${mi}`;
                        const logged = saved.logged.includes(key);
                        return (
                          <Card key={key} style={{ gap: 8 }}>
                            <View style={styles.mealHead}>
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
                              <T size={12} rounded color={C.protein}>
                                P {Math.round(m.protein)}g
                              </T>
                              {'  '}
                              <T size={12} rounded color={C.carbs}>
                                C {Math.round(m.carbs)}g
                              </T>
                              {'  '}
                              <T size={12} rounded color={C.fat}>
                                F {Math.round(m.fat)}g
                              </T>
                            </T>
                            <T size={12} color={C.textDim} style={{ lineHeight: 17 }}>
                              {m.ingredients.join(' · ')}
                            </T>
                            <T size={12} color={C.textMute} style={{ lineHeight: 17 }}>
                              {m.steps}
                            </T>
                            <Pressable
                              disabled={logged}
                              onPress={() => {
                                tap();
                                actions.logPlannedMeal(key, m);
                              }}
                              style={[styles.log, logged && { opacity: 0.5 }]}>
                              <Icon name={logged ? 'check' : 'plus'} size={14} color={C.lime} weight="bold" />
                              <T size={12} rounded color={C.lime}>
                                {logged ? 'LOGGED' : 'I ATE THIS'}
                              </T>
                            </Pressable>
                          </Card>
                        );
                      })}
                    </View>
                  </View>
                ))
              : grocery.map(([aisle, items]) => (
                  <View key={aisle}>
                    <SectionTitle>{aisle}</SectionTitle>
                    <Card style={{ gap: 4 }}>
                      {items.map((g) => {
                        const done = saved.checked.includes(g.item);
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
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: Space.md, paddingTop: Space.lg, gap: Space.sm, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: Space.sm },
  input: { padding: 12, borderRadius: 10, backgroundColor: '#1D2023', borderWidth: 2, borderColor: '#3A3F43', color: C.text, fontSize: 14 },
  mealHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  log: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8, borderRadius: 8, borderWidth: 2, borderColor: C.lime + '88', backgroundColor: '#1E2A16' },
  groceryRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  box: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: C.textMute, alignItems: 'center', justifyContent: 'center' },
});
