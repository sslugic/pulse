import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Keyboard, Pressable, StyleSheet, TextInput, View, type LayoutChangeEvent } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { C } from '@/constants/theme';
import { GAME_SECONDS, type GameDef } from '@/lib/arcade';
import { tap } from '@/lib/haptics';
import { t } from '@/lib/i18n';

import { GlassButton, Icon, type IconName } from './icon';
import { Bar, Card, T } from './ui';
import { ArcadeButton, Comic } from './underground';

/** One-minute frame around a game: countdown, quit, and a cool-down screen at the end. */
export function GameShell({ game, onExit, onFinish, children }: { game: GameDef; onExit: () => void; onFinish: () => void; children: ReactNode }) {
  const [left, setLeft] = useState(GAME_SECONDS);
  const [round, setRound] = useState(0);
  const done = left <= 0;

  useEffect(() => {
    if (done) return;
    const t = setInterval(() => setLeft((n) => n - 1), 1000);
    return () => clearInterval(t);
  }, [done, round]);

  const finished = useRef(false);
  useEffect(() => {
    if (done && !finished.current) {
      finished.current = true;
      onFinish();
    }
  }, [done, onFinish]);

  return (
    <View style={{ flex: 1, gap: 12 }}>
      <View style={styles.head}>
        <View style={{ flex: 1 }}>
          <Comic size={30} color={game.color}>
            {game.title}
          </Comic>
        </View>
        <T size={22} rounded color={done ? C.lime : C.text}>
          {`0:${String(Math.max(0, left)).padStart(2, '0')}`}
        </T>
        <GlassButton icon="close" onPress={onExit} />
      </View>
      <Bar value={GAME_SECONDS - left} max={GAME_SECONDS} color={game.color} height={6} />
      {!done && (
        <View style={styles.howTo}>
          <Icon name={game.icon} size={14} color={game.color} />
          <T size={13} color={C.textDim} style={{ flex: 1, lineHeight: 18 }}>
            {game.howTo}
          </T>
        </View>
      )}
      {done ? (
        <View style={styles.done}>
          <Card style={{ alignItems: 'center', gap: 18, alignSelf: 'stretch' }} accent={C.lime + '99'}>
            <Comic size={44} color={C.lime}>
              {t('arcade.nice')}
            </Comic>
            <T size={15} color={C.textDim} style={{ textAlign: 'center', lineHeight: 21 }}>
              {t('arcade.coolDown')}
            </T>
            <View style={{ flexDirection: 'row', gap: 10, alignSelf: 'stretch' }}>
              <ArcadeButton
                label={t('arcade.again')}
                size="md"
                colors={['#5FE2FF', '#1E8FE0']}
                textColor="#fff"
                onPress={() => {
                  setLeft(GAME_SECONDS);
                  setRound((r) => r + 1);
                }}
                style={{ flex: 1 }}
              />
              <ArcadeButton label={t('arcade.done')} size="md" onPress={onExit} style={{ flex: 1 }} />
            </View>
          </Card>
        </View>
      ) : (
        <View key={round} style={styles.stage}>
          {children}
        </View>
      )}
    </View>
  );
}

// ---------- Box breathing ----------

const PHASES = [
  { label: t('arcade.breatheIn'), scale: 1 },
  { label: t('arcade.hold'), scale: 1 },
  { label: t('arcade.breatheOut'), scale: 0.45 },
  { label: t('arcade.hold'), scale: 0.45 },
];

export function BreatheGame() {
  const [tick, setTick] = useState(0);
  const phase = Math.floor(tick / 4) % 4;
  const scale = useSharedValue(0.45);

  useEffect(() => {
    const i = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(i);
  }, []);
  useEffect(() => {
    tap();
    scale.set(withTiming(PHASES[phase].scale, { duration: 4000, easing: Easing.inOut(Easing.quad) }));
  }, [phase, scale]);

  const ring = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <View style={styles.center}>
      <View style={styles.breathBox}>
        <Animated.View style={[styles.breathOrb, ring]} />
        <View style={styles.breathLabel}>
          <Comic size={30} color={C.text}>
            {PHASES[phase].label}
          </Comic>
          <T size={40} rounded color={C.cyan}>
            {4 - (tick % 4)}
          </T>
        </View>
      </View>
      <T size={13} color={C.textDim} style={{ textAlign: 'center' }}>
        {t('arcade.breatheHint')}
      </T>
    </View>
  );
}

// ---------- Bubble pop ----------

const BUBBLE_COLORS = [C.pink, C.cyan, C.lime, C.yellow, C.violet];

interface BubbleSpec {
  id: number;
  x: number;
  size: number;
  duration: number;
  color: string;
}

export function BubbleGame() {
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [bubbles, setBubbles] = useState<BubbleSpec[]>([]);
  const [pops, setPops] = useState(0);
  const next = useRef(0);

  useEffect(() => {
    if (!box.w) return;
    const i = setInterval(() => {
      const size = 44 + Math.random() * 40;
      const b: BubbleSpec = {
        id: next.current++,
        x: Math.random() * (box.w - size),
        size,
        duration: 4200 + Math.random() * 2600,
        color: BUBBLE_COLORS[Math.floor(Math.random() * BUBBLE_COLORS.length)],
      };
      setBubbles((bs) => [...bs, b]);
    }, 550);
    return () => clearInterval(i);
  }, [box.w]);

  const remove = (id: number) => setBubbles((bs) => bs.filter((b) => b.id !== id));

  return (
    <View style={{ flex: 1, gap: 8 }}>
      <T size={13} rounded color={C.textDim} style={{ textAlign: 'center' }}>
        {t('arcade.popped', { count: pops })}
      </T>
      <View style={styles.tank} onLayout={(e: LayoutChangeEvent) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
        {bubbles.map((b) => (
          <Bubble
            key={b.id}
            b={b}
            height={box.h}
            onGone={() => remove(b.id)}
            onPop={() => {
              setPops((n) => n + 1);
              remove(b.id);
            }}
          />
        ))}
      </View>
    </View>
  );
}

function Bubble({ b, height, onGone, onPop }: { b: BubbleSpec; height: number; onGone: () => void; onPop: () => void }) {
  const y = useSharedValue(height);
  const pop = useSharedValue(1);
  const popped = useRef(false);

  useEffect(() => {
    y.set(withTiming(-b.size, { duration: b.duration, easing: Easing.linear }));
    const t = setTimeout(() => !popped.current && onGone(), b.duration);
    return () => clearTimeout(t);
    // Each bubble launches once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const style = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }, { scale: pop.value }], opacity: 2 - pop.value }));

  return (
    <Animated.View style={[{ position: 'absolute', left: b.x, top: 0, width: b.size, height: b.size }, style]}>
      <Pressable
        onPressIn={() => {
          if (popped.current) return;
          popped.current = true;
          tap();
          pop.set(withTiming(1.7, { duration: 140 }));
          setTimeout(onPop, 150);
        }}
        style={[styles.bubble, { borderRadius: b.size / 2, borderColor: b.color, backgroundColor: b.color + '22', shadowColor: b.color }]}>
        <View style={[styles.shine, { width: b.size * 0.22, height: b.size * 0.22, borderRadius: b.size }]} />
      </Pressable>
    </Animated.View>
  );
}

// ---------- Spray wall ----------

const SPRAY_COLORS = [C.lime, C.pink, C.cyan, C.yellow, C.orange, C.violet];

export function SprayGame() {
  const [strokes, setStrokes] = useState<{ d: string; color: string }[]>([]);
  const [color, setColor] = useState<string>(SPRAY_COLORS[0]);
  const [live, setLive] = useState<string | null>(null);

  const at = (e: { nativeEvent: { locationX: number; locationY: number } }) => `${Math.round(e.nativeEvent.locationX)} ${Math.round(e.nativeEvent.locationY)}`;

  return (
    <View style={{ flex: 1, gap: 10 }}>
      <View
        style={styles.wall}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={(e) => {
          tap();
          setLive(`M${at(e)} L${at(e)}`);
        }}
        onResponderMove={(e) => {
          const p = at(e);
          setLive((d) => (d == null ? d : `${d} L${p}`));
        }}
        onResponderRelease={() => {
          if (live) setStrokes((s) => [...s.slice(-80), { d: live, color }]);
          setLive(null);
        }}>
        <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
          {[...strokes, ...(live ? [{ d: live, color }] : [])].map((s, i) => (
            <SprayStroke key={i} d={s.d} color={s.color} />
          ))}
        </Svg>
        {strokes.length === 0 && !live && (
          <View style={styles.wallHint} pointerEvents="none">
            <Comic size={26} color="#4A4E52">
              {t('arcade.tagIt')}
            </Comic>
          </View>
        )}
      </View>
      <View style={styles.palette}>
        {SPRAY_COLORS.map((c) => (
          <Pressable
            key={c}
            onPress={() => {
              tap();
              setColor(c);
            }}
            accessibilityLabel={t('arcade.sprayColor', { color: c })}
            style={[styles.can, { backgroundColor: c }, c === color && styles.canOn]}
          />
        ))}
        <Pressable
          onPress={() => {
            tap();
            setStrokes([]);
          }}
          style={styles.wipe}>
          <T size={12} rounded color={C.text}>
            {t('arcade.wipe')}
          </T>
        </Pressable>
      </View>
    </View>
  );
}

function SprayStroke({ d, color }: { d: string; color: string }) {
  return (
    <>
      <Path d={d} stroke={color} strokeOpacity={0.25} strokeWidth={26} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <Path d={d} stroke={color} strokeWidth={10} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </>
  );
}

// ---------- Fidget board ----------

const FIDGET_COLORS = [C.lime, C.pink, C.cyan, C.yellow, C.orange, C.violet];

export function FidgetGame() {
  const [lit, setLit] = useState<boolean[]>(() => Array(16).fill(false));
  const on = lit.filter(Boolean).length;
  const flip = (i: number) => {
    tap(Haptics.ImpactFeedbackStyle.Medium);
    setLit((l) => l.map((v, j) => (j === i ? !v : v)));
  };
  return (
    <View style={[styles.center, { gap: 18 }]}>
      <T size={13} rounded color={C.textDim}>
        {on === 16 ? t('arcade.allLit') : t('arcade.litCount', { n: on })}
      </T>
      <View style={styles.board}>
        {lit.map((v, i) => {
          const c = FIDGET_COLORS[i % FIDGET_COLORS.length];
          return (
            <Pressable
              key={i}
              onPressIn={() => flip(i)}
              accessibilityLabel={t('arcade.buttonN', { n: i + 1 })}
              style={({ pressed }) => [
                styles.fidget,
                { backgroundColor: v ? c : '#2A2D30', shadowColor: c, shadowOpacity: v ? 0.9 : 0 },
                pressed && { transform: [{ translateY: 3 }], borderBottomWidth: 2 },
              ]}
            />
          );
        })}
      </View>
      <Pressable
        onPress={() => {
          tap();
          setLit(Array(16).fill(false));
        }}
        style={styles.wipe}>
        <T size={12} rounded color={C.text}>
          {t('arcade.allOff')}
        </T>
      </Pressable>
    </View>
  );
}

// ---------- Worry shredder ----------

export function ShredderGame() {
  const [text, setText] = useState('');
  const [paper, setPaper] = useState<string | null>(null);
  const [count, setCount] = useState(0);
  const drop = useSharedValue(0);
  const strips = useSharedValue(0);

  const shred = () => {
    const worry = text.trim();
    if (!worry || paper) return;
    Keyboard.dismiss();
    tap(Haptics.ImpactFeedbackStyle.Heavy);
    setPaper(worry);
    setText('');
    drop.set(0);
    strips.set(0);
    drop.set(withTiming(1, { duration: 1100, easing: Easing.in(Easing.quad) }));
    strips.set(withTiming(1, { duration: 1500, easing: Easing.out(Easing.quad) }));
    setTimeout(() => {
      setPaper(null);
      setCount((n) => n + 1);
    }, 1550);
  };

  const card = useAnimatedStyle(() => ({ transform: [{ translateY: drop.value * 170 }] }));
  const fall = useAnimatedStyle(() => ({ transform: [{ translateY: strips.value * 120 }], opacity: 1 - strips.value }));

  return (
    <View style={{ flex: 1, gap: 14 }}>
      <TextInput
        value={text}
        onChangeText={setText}
        placeholder={t('arcade.worryPlaceholder')}
        placeholderTextColor={C.textMute}
        multiline
        maxLength={140}
        style={styles.worry}
      />
      <ArcadeButton label={t('arcade.shredIt')} size="md" colors={['#FF9A3D', '#E8530E']} textColor="#fff" disabled={!text.trim() || !!paper} onPress={shred} />
      <View style={{ alignItems: 'center', flex: 1 }}>
        <View style={styles.paperWell}>
          {paper && (
            <Animated.View style={[styles.paper, card]}>
              <T size={15} color={C.ink} style={{ lineHeight: 20 }} numberOfLines={5}>
                {paper}
              </T>
            </Animated.View>
          )}
        </View>
        <View style={styles.shredder}>
          <View style={styles.slot} />
          <Comic size={18} color={C.text}>
            {t('arcade.shredder')}
          </Comic>
        </View>
        <View style={styles.stripWell}>
          {paper && (
            <Animated.View style={[styles.strips, fall]}>
              {Array.from({ length: 9 }).map((_, i) => (
                <View key={i} style={[styles.strip, { height: 40 + ((i * 37) % 50) }]} />
              ))}
            </Animated.View>
          )}
        </View>
        <T size={13} rounded color={C.textDim}>
          {t('arcade.worriesShredded', { count })}
        </T>
      </View>
    </View>
  );
}

// ---------- Neon match ----------

const FACES: { icon: IconName; color: string }[] = [
  { icon: 'flame', color: C.orange },
  { icon: 'drop', color: C.cyan },
  { icon: 'bolt', color: C.yellow },
  { icon: 'leaf', color: C.lime },
  { icon: 'heart', color: C.pink },
  { icon: 'moon', color: C.violet },
];

const deal = () =>
  [...FACES, ...FACES]
    .map((f, i) => ({ ...f, key: i, r: Math.random() }))
    .sort((a, b) => a.r - b.r);

export function MemoryGame() {
  const [deck, setDeck] = useState(deal);
  const [up, setUp] = useState<number[]>([]);
  const [found, setFound] = useState<Set<string>>(() => new Set());
  const [rounds, setRounds] = useState(0);

  const flip = (i: number) => {
    if (up.length === 2 || up.includes(i) || found.has(deck[i].icon)) return;
    tap();
    const next = [...up, i];
    setUp(next);
    if (next.length < 2) return;
    const [a, b] = next;
    if (deck[a].icon === deck[b].icon) {
      const done = new Set(found).add(deck[a].icon);
      setFound(done);
      setUp([]);
      if (done.size === FACES.length) {
        setTimeout(() => {
          setRounds((r) => r + 1);
          setFound(new Set());
          setDeck(deal());
        }, 700);
      }
    } else {
      setTimeout(() => setUp([]), 750);
    }
  };

  return (
    <View style={[styles.center, { gap: 18 }]}>
      <T size={13} rounded color={C.textDim}>
        {t('arcade.pairs', { found: found.size, total: FACES.length })}
        {rounds ? t('arcade.roundsCleared', { count: rounds }) : ''}
      </T>
      <View style={styles.cards}>
        {deck.map((c, i) => {
          const shown = up.includes(i) || found.has(c.icon);
          return (
            <Pressable
              key={c.key}
              onPress={() => flip(i)}
              accessibilityLabel={shown ? c.icon : t('arcade.hiddenCard')}
              style={[styles.card, shown && { backgroundColor: '#15181A', borderColor: c.color, shadowColor: c.color, shadowOpacity: 0.8 }, found.has(c.icon) && { opacity: 0.5 }]}>
              {shown ? <Icon name={c.icon} size={34} color={c.color} /> : <Comic size={22} color="#4A4E52">?</Comic>}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stage: { flex: 1 },
  howTo: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, backgroundColor: '#00000066' },
  done: { flex: 1, justifyContent: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 28 },
  breathBox: { width: 280, height: 280, alignItems: 'center', justifyContent: 'center' },
  breathOrb: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: '#0F2D38',
    borderWidth: 4,
    borderColor: C.cyan,
    shadowColor: C.cyan,
    shadowOpacity: 0.9,
    shadowRadius: 24,
  },
  breathLabel: { alignItems: 'center', gap: 4 },
  tank: { flex: 1, overflow: 'hidden', borderRadius: 14, borderWidth: 2, borderColor: '#3A3F43', backgroundColor: 'rgba(12,13,14,0.7)' },
  bubble: { flex: 1, borderWidth: 3, shadowOpacity: 0.8, shadowRadius: 8 },
  shine: { position: 'absolute', top: '18%', left: '22%', backgroundColor: 'rgba(255,255,255,0.7)' },
  wall: { flex: 1, overflow: 'hidden', borderRadius: 14, borderWidth: 2, borderColor: '#3A3F43', backgroundColor: '#2A2D30' },
  wallHint: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  palette: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  can: { width: 38, height: 38, borderRadius: 19, borderWidth: 2, borderColor: C.ink },
  canOn: { borderColor: C.text, borderWidth: 3, transform: [{ scale: 1.12 }] },
  board: { width: 300, flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  fidget: { width: 66, height: 66, borderRadius: 14, borderWidth: 3, borderBottomWidth: 6, borderColor: C.ink, shadowRadius: 12 },
  worry: {
    minHeight: 90,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#1D2023',
    borderWidth: 2,
    borderColor: '#3A3F43',
    color: C.text,
    fontSize: 16,
    textAlignVertical: 'top',
  },
  paperWell: { width: 230, height: 130, overflow: 'hidden', justifyContent: 'flex-end' },
  paper: { backgroundColor: '#F3EEDC', padding: 12, borderRadius: 4, minHeight: 110, transform: [{ rotate: '-2deg' }] },
  shredder: {
    width: 260,
    paddingVertical: 10,
    alignItems: 'center',
    gap: 6,
    borderRadius: 10,
    backgroundColor: '#4A4F53',
    borderWidth: 3,
    borderColor: C.ink,
  },
  slot: { width: 210, height: 8, borderRadius: 4, backgroundColor: C.ink },
  stripWell: { width: 230, height: 110, overflow: 'hidden' },
  strips: { flexDirection: 'row', justifyContent: 'space-between' },
  strip: { width: 16, backgroundColor: '#F3EEDC', borderRadius: 2 },
  cards: { width: 320, flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center' },
  card: {
    width: 70,
    height: 88,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2A2D30',
    borderWidth: 3,
    borderColor: C.ink,
    shadowRadius: 10,
  },
  wipe: { marginLeft: 'auto', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8, backgroundColor: C.surfaceHi, borderWidth: 2, borderColor: C.ink },
});
