import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';

import { C } from '@/constants/theme';
import type { BrainId, GameDef } from '@/lib/arcade';
import { CHEST_LOOK, PAID_WINS_PER_DAY, stars, winsToday, type RunResult } from '@/lib/brain';
import { tap } from '@/lib/haptics';
import { actions, useStore } from '@/lib/store';

import { ChestArt, ChestOpener } from './chest';
import { GlassButton, Icon } from './icon';
import { TokenCoin } from './quests-card';
import { Card, T } from './ui';
import { ArcadeButton, Comic } from './underground';

// Brain Gym: short scored challenges for memory and focus. Each game calls onEnd(score) once when the
// run is over; ChallengeShell handles the intro, scoring, rewards and the result screen.

type GameProps = { color: string; onEnd: (score: number) => void };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const buzz = () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});

/** Seconds left on a countdown that ends the run. */
function useCountdown(seconds: number, onDone: () => void) {
  const [left, setLeft] = useState(seconds);
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  }, [onDone]);
  useEffect(() => {
    const t = setInterval(() => setLeft((n) => n - 1), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (left === 0) done.current();
  }, [left]);
  return Math.max(0, left);
}

function Lives({ n, max = 3 }: { n: number; max?: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 4 }}>
      {Array.from({ length: max }, (_, i) => (
        <Icon key={i} name="heart" size={18} color={i < n ? C.pink : '#3A3E42'} />
      ))}
    </View>
  );
}

function Hud({ left, right }: { left: string; right?: React.ReactNode }) {
  return (
    <View style={styles.hud}>
      <T size={14} rounded color={C.text}>
        {left}
      </T>
      {right}
    </View>
  );
}

// ---------- Neon Echo: repeat a growing sequence ----------

const PADS = [C.cyan, C.pink, C.lime, C.yellow];

export function EchoGame({ onEnd }: GameProps) {
  const [seq, setSeq] = useState<number[]>(() => [Math.floor(Math.random() * 4)]);
  const [lit, setLit] = useState<number | null>(null);
  const [step, setStep] = useState(0);
  const [showing, setShowing] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setShowing(true);
      await sleep(700);
      // Faster as the pattern grows.
      const on = Math.max(260, 520 - seq.length * 25);
      for (const p of seq) {
        if (cancelled) return;
        setLit(p);
        tap();
        await sleep(on);
        setLit(null);
        await sleep(160);
      }
      if (!cancelled) {
        setStep(0);
        setShowing(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [seq]);

  const press = (p: number) => {
    if (showing) return;
    tap(Haptics.ImpactFeedbackStyle.Medium);
    setLit(p);
    setTimeout(() => setLit((x) => (x === p ? null : x)), 180);
    if (seq[step] !== p) {
      buzz();
      onEnd(seq.length - 1);
      return;
    }
    if (step + 1 === seq.length) {
      setShowing(true);
      setTimeout(() => setSeq((s) => [...s, Math.floor(Math.random() * 4)]), 400);
    } else setStep(step + 1);
  };

  return (
    <View style={styles.center}>
      <Hud
        left={`STEP ${seq.length}`}
        right={
          <T size={13} rounded color={showing ? C.textDim : C.lime}>
            {showing ? 'WATCH…' : 'YOUR TURN'}
          </T>
        }
      />
      <View style={styles.pads}>
        {PADS.map((c, i) => (
          <Pressable
            key={i}
            onPressIn={() => press(i)}
            accessibilityLabel={`Pad ${i + 1}`}
            style={[
              styles.pad,
              {
                backgroundColor: lit === i ? c : '#15181A',
                borderColor: c,
                shadowColor: c,
                shadowOpacity: lit === i ? 0.95 : 0,
              },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

// ---------- Grid Recall: remember which tiles flashed ----------

const GRID = 16;
const pick = (n: number) => {
  const all = Array.from({ length: GRID }, (_, i) => i).sort(() => Math.random() - 0.5);
  return new Set(all.slice(0, n));
};

export function GridGame({ color, onEnd }: GameProps) {
  const [level, setLevel] = useState(1);
  const [lives, setLives] = useState(3);
  const [target, setTarget] = useState(() => pick(3));
  const [found, setFound] = useState<Set<number>>(() => new Set());
  const [miss, setMiss] = useState<number | null>(null);
  const [showing, setShowing] = useState(true);

  // A new pattern shows for a moment, then hides; `next` sets showing back on with the new pattern.
  useEffect(() => {
    const t = setTimeout(() => setShowing(false), 900 + target.size * 150);
    return () => clearTimeout(t);
  }, [target]);

  const next = (lvl: number) => {
    setShowing(true);
    setFound(new Set());
    setMiss(null);
    setTarget(pick(Math.min(GRID - 3, lvl + 2)));
  };

  const press = (i: number) => {
    if (showing || found.has(i) || miss != null) return;
    if (target.has(i)) {
      tap();
      const f = new Set(found).add(i);
      setFound(f);
      if (f.size === target.size) {
        setShowing(true);
        setTimeout(() => {
          setLevel(level + 1);
          next(level + 1);
        }, 500);
      }
    } else {
      buzz();
      setMiss(i);
      const l = lives - 1;
      setLives(l);
      setShowing(true);
      setTimeout(() => (l === 0 ? onEnd(level - 1) : next(level)), 700);
    }
  };

  return (
    <View style={styles.center}>
      <Hud left={`LEVEL ${level} · ${target.size} TILES`} right={<Lives n={lives} />} />
      <View style={styles.grid}>
        {Array.from({ length: GRID }, (_, i) => {
          const on = (showing && miss == null && target.has(i)) || found.has(i);
          const bad = miss === i;
          const reveal = miss != null && target.has(i) && !found.has(i);
          return (
            <Pressable
              key={i}
              onPressIn={() => press(i)}
              accessibilityLabel={`Tile ${i + 1}`}
              style={[
                styles.tile,
                on && {
                  backgroundColor: color,
                  shadowColor: color,
                  shadowOpacity: 0.9,
                },
                bad && { backgroundColor: C.danger },
                reveal && { borderColor: color, borderStyle: 'dashed' },
              ]}
            />
          );
        })}
      </View>
      <T size={13} rounded color={showing ? C.textDim : C.lime}>
        {miss != null ? 'MISSED ONE' : showing ? 'REMEMBER THESE…' : `TAP THE ${target.size - found.size} LEFT`}
      </T>
    </View>
  );
}

// ---------- Color Clash: tap the ink colour, not the word ----------

const INKS = [
  { name: 'RED', color: '#FF4D4D' },
  { name: 'BLUE', color: '#3E8BFF' },
  { name: 'GREEN', color: '#5BE01E' },
  { name: 'YELLOW', color: '#FFD23A' },
];

const clashCard = () => {
  const word = Math.floor(Math.random() * 4);
  // Mostly mismatched, sometimes the same, so you can't just pick "anything but the word".
  const ink = Math.random() < 0.2 ? word : (word + 1 + Math.floor(Math.random() * 3)) % 4;
  return { word, ink, key: Math.random() };
};

export function ClashGame({ onEnd }: GameProps) {
  const [score, setScore] = useState(0);
  const [card, setCard] = useState(clashCard);
  const [flash, setFlash] = useState<'ok' | 'bad' | null>(null);
  const scoreRef = useRef(0);
  const left = useCountdown(45, () => onEnd(scoreRef.current));

  const answer = (i: number) => {
    const ok = i === card.ink;
    if (ok) tap();
    else buzz();
    scoreRef.current = Math.max(0, scoreRef.current + (ok ? 1 : -1));
    setScore(scoreRef.current);
    setFlash(ok ? 'ok' : 'bad');
    setTimeout(() => setFlash(null), 150);
    setCard(clashCard());
  };

  return (
    <View style={styles.center}>
      <Hud left={`SCORE ${score}`} right={<T size={18} rounded color={left <= 10 ? C.danger : C.text}>{`0:${String(left).padStart(2, '0')}`}</T>} />
      <View style={[styles.wordBox, flash === 'ok' && { borderColor: C.lime }, flash === 'bad' && { borderColor: C.danger }]}>
        <Animated.View key={card.key} entering={ZoomIn.duration(120)}>
          <Comic size={64} color={INKS[card.ink].color}>
            {INKS[card.word].name}
          </Comic>
        </Animated.View>
      </View>
      <T size={12} rounded color={C.textDim}>
        TAP THE INK COLOUR
      </T>
      <View style={styles.answers}>
        {INKS.map((ink, i) => (
          <Pressable key={ink.name} onPressIn={() => answer(i)} accessibilityLabel={ink.name} style={[styles.answer, { backgroundColor: ink.color }]}>
            <T size={15} rounded color={C.ink}>
              {ink.name}
            </T>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

// ---------- Mind Math: is the sum right? ----------

const rnd = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1));

function sum(level: number) {
  const ops = level < 8 ? ['+', '−'] : level < 16 ? ['+', '−', '×'] : ['+', '−', '×', '÷'];
  const op = ops[rnd(0, ops.length - 1)];
  const hi = level < 8 ? 12 : level < 16 ? 25 : 50;
  let a = rnd(2, hi);
  let b = rnd(2, hi);
  let c: number;
  if (op === '×') {
    a = rnd(2, 12);
    b = rnd(2, level < 16 ? 9 : 12);
    c = a * b;
  } else if (op === '÷') {
    b = rnd(2, 12);
    c = rnd(2, 12);
    a = b * c;
  } else if (op === '−') {
    if (b > a) [a, b] = [b, a];
    c = a - b;
  } else c = a + b;
  const right = Math.random() < 0.5;
  const shown = right ? c : c + (Math.random() < 0.5 ? -1 : 1) * rnd(1, op === '×' ? 10 : 3);
  return {
    text: `${a} ${op} ${b} = ${shown}`,
    right: right || shown === c,
    key: Math.random(),
  };
}

export function MathGame({ onEnd }: GameProps) {
  const [score, setScore] = useState(0);
  const [q, setQ] = useState(() => sum(0));
  const [flash, setFlash] = useState<'ok' | 'bad' | null>(null);
  const scoreRef = useRef(0);
  const left = useCountdown(45, () => onEnd(scoreRef.current));

  const answer = (yes: boolean) => {
    const ok = yes === q.right;
    if (ok) tap();
    else buzz();
    scoreRef.current = Math.max(0, scoreRef.current + (ok ? 1 : -1));
    setScore(scoreRef.current);
    setFlash(ok ? 'ok' : 'bad');
    setTimeout(() => setFlash(null), 150);
    setQ(sum(scoreRef.current));
  };

  return (
    <View style={styles.center}>
      <Hud left={`SCORE ${score}`} right={<T size={18} rounded color={left <= 10 ? C.danger : C.text}>{`0:${String(left).padStart(2, '0')}`}</T>} />
      <View style={[styles.wordBox, flash === 'ok' && { borderColor: C.lime }, flash === 'bad' && { borderColor: C.danger }]}>
        <Animated.View key={q.key} entering={ZoomIn.duration(120)}>
          <Comic size={44} color={C.text}>
            {q.text}
          </Comic>
        </Animated.View>
      </View>
      <View style={{ flexDirection: 'row', gap: 12, alignSelf: 'stretch' }}>
        <Pressable onPressIn={() => answer(false)} style={[styles.yesNo, { backgroundColor: C.danger }]} accessibilityLabel="Wrong">
          <Comic size={26} color="#fff">
            WRONG
          </Comic>
        </Pressable>
        <Pressable onPressIn={() => answer(true)} style={[styles.yesNo, { backgroundColor: '#3FB618' }]} accessibilityLabel="Right">
          <Comic size={26} color="#fff">
            RIGHT
          </Comic>
        </Pressable>
      </View>
    </View>
  );
}

// ---------- Code Crack: remember a number and type it back ----------

const code = (n: number) => Array.from({ length: n }, () => rnd(0, 9)).join('');

export function CodeGame({ color, onEnd }: GameProps) {
  const [len, setLen] = useState(3);
  const [best, setBest] = useState(0);
  const [lives, setLives] = useState(3);
  const [secret, setSecret] = useState(() => code(3));
  const [typed, setTyped] = useState('');
  const [showing, setShowing] = useState(true);
  const [verdict, setVerdict] = useState<'ok' | 'bad' | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setShowing(false), 1000 + secret.length * 450);
    return () => clearTimeout(t);
  }, [secret]);

  const newCode = (n: number) => {
    setShowing(true);
    setTyped('');
    setSecret(code(n));
  };

  const key = (d: string) => {
    if (showing || verdict) return;
    tap();
    const t = d === '⌫' ? typed.slice(0, -1) : typed + d;
    setTyped(t);
    if (t.length < secret.length) return;
    if (t === secret) {
      setVerdict('ok');
      setBest(len);
      setTimeout(() => {
        setVerdict(null);
        setLen(len + 1);
        newCode(len + 1);
      }, 600);
    } else {
      buzz();
      setVerdict('bad');
      const l = lives - 1;
      setLives(l);
      setTimeout(() => {
        setVerdict(null);
        if (l === 0) onEnd(best);
        else newCode(len);
      }, 1100);
    }
  };

  return (
    <View style={styles.center}>
      <Hud left={`${len} DIGITS`} right={<Lives n={lives} />} />
      <View style={[styles.wordBox, verdict === 'ok' && { borderColor: C.lime }, verdict === 'bad' && { borderColor: C.danger }]}>
        <Comic size={46} color={showing ? color : verdict === 'bad' ? C.danger : C.text} style={{ letterSpacing: 6 }}>
          {showing ? secret : verdict === 'bad' ? secret : typed.padEnd(secret.length, '•')}
        </Comic>
      </View>
      <T size={13} rounded color={showing ? C.textDim : C.lime}>
        {showing ? 'MEMORISE…' : verdict === 'bad' ? 'THAT WAS THE CODE' : 'TYPE IT IN'}
      </T>
      <View style={styles.keypad}>
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].map((d, i) =>
          d ? (
            <Pressable key={i} onPressIn={() => key(d)} style={[styles.key, (showing || !!verdict) && { opacity: 0.4 }]} accessibilityLabel={d === '⌫' ? 'Delete' : d}>
              <Comic size={26} color={C.text}>
                {d}
              </Comic>
            </Pressable>
          ) : (
            <View key={i} style={[styles.key, { backgroundColor: 'transparent', borderWidth: 0 }]} />
          ),
        )}
      </View>
    </View>
  );
}

const BRAIN_PLAY: Record<BrainId, (p: GameProps) => React.JSX.Element> = {
  echo: EchoGame,
  grid: GridGame,
  clash: ClashGame,
  math: MathGame,
  code: CodeGame,
};

// ---------- Frame: intro, play, result ----------

export function Stars({ n, size = 22 }: { n: number; size?: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 4 }}>
      {[1, 2, 3].map((i) => (
        <Icon key={i} name="star" size={size} color={i <= n ? C.yellow : '#3A3E42'} />
      ))}
    </View>
  );
}

export function ChallengeShell({ game, day, onExit }: { game: GameDef; day: string; onExit: () => void }) {
  const id = game.id as BrainId;
  const g = useStore((s) => s.game);
  const [phase, setPhase] = useState<'intro' | 'play' | 'result'>('intro');
  const [run, setRun] = useState(0);
  const [result, setResult] = useState<RunResult | null>(null);
  const [opening, setOpening] = useState<{
    id: string;
    tier: NonNullable<RunResult['chest']>;
  } | null>(null);
  const best = g.bests?.[id] ?? 0;
  const wins = winsToday(g.claims, day);
  const Game = BRAIN_PLAY[id];

  const end = useCallback(
    (score: number) => {
      setResult(actions.finishBrain(id, score, day));
      setPhase('result');
    },
    [id, day],
  );

  const start = () => {
    tap();
    setRun((r) => r + 1);
    setPhase('play');
  };

  return (
    <View style={{ flex: 1, gap: 12 }}>
      <View style={styles.head}>
        <View style={{ flex: 1 }}>
          <Comic size={30} color={game.color}>
            {game.title}
          </Comic>
        </View>
        <GlassButton icon="close" onPress={onExit} />
      </View>

      {phase === 'intro' && (
        <Animated.View entering={FadeIn} style={{ flex: 1, justifyContent: 'center', gap: 14 }}>
          <Card style={{ gap: 12 }} accent={game.color + '99'}>
            <T size={11} rounded color={C.textDim}>
              HOW TO PLAY
            </T>
            <T size={16} color={C.text} style={{ lineHeight: 23 }}>
              {game.howTo}
            </T>
            <View style={styles.goals}>
              <Goal label="WIN" value={`${game.win} ${game.unit}`} sub="tokens + chest" color={C.lime} />
              <Goal label="GOLD" value={`${game.great} ${game.unit}`} sub="gold chest" color={C.yellow} />
              <Goal label="YOUR BEST" value={best ? `${best}` : '—'} sub={best ? `${'★'.repeat(stars(game, best))}` : 'no runs yet'} color={game.color} />
            </View>
          </Card>
          <View style={styles.meta}>
            <T size={12} rounded color={wins >= PAID_WINS_PER_DAY ? C.textMute : C.text}>
              {`PAID WINS TODAY ${Math.min(wins, PAID_WINS_PER_DAY)}/${PAID_WINS_PER_DAY}`}
            </T>
            {!!g.doubler && (
              <T size={12} rounded color={C.orange}>
                {`⚡ DOUBLER ×${g.doubler}`}
              </T>
            )}
          </View>
          <ArcadeButton label="START" onPress={start} colors={['#B8FF4A', '#5BE01E']} textColor="#fff" />
        </Animated.View>
      )}

      {phase === 'play' && (
        <View key={run} style={{ flex: 1 }}>
          <Game color={game.color} onEnd={end} />
        </View>
      )}

      {phase === 'result' && result && (
        <Animated.View entering={FadeIn} style={{ flex: 1, justifyContent: 'center', gap: 14 }}>
          <Card style={{ alignItems: 'center', gap: 12 }} accent={(result.won ? C.lime : C.textMute) + '99'}>
            <Animated.View entering={ZoomIn.springify()}>
              <Comic size={48} color={result.won ? C.lime : C.text}>
                {result.won ? 'YOU WON!' : 'GOOD TRY'}
              </Comic>
            </Animated.View>
            <Stars n={stars(game, result.score)} size={34} />
            <T size={18} rounded color={C.text}>
              {`${result.score} ${game.unit}`}
            </T>
            {result.newBest && (
              <View style={[styles.badge, { backgroundColor: C.yellow }]}>
                <T size={11} rounded color={C.ink}>
                  NEW BEST
                </T>
              </View>
            )}
            {!result.won && (
              <T size={13} color={C.textDim} style={{ textAlign: 'center' }}>
                {`Reach ${game.win} ${(game.unit ?? '').toLowerCase()} to win tokens and a chest. ${game.win! - result.score} to go.`}
              </T>
            )}
            {(result.tokens > 0 || result.xp > 0) && (
              <View style={{ flexDirection: 'row', gap: 16, alignItems: 'center' }}>
                {result.tokens > 0 && (
                  <View
                    style={{
                      flexDirection: 'row',
                      gap: 6,
                      alignItems: 'center',
                    }}>
                    <Comic size={26} color={C.yellow}>{`+${result.tokens}`}</Comic>
                    <TokenCoin size={22} />
                  </View>
                )}
                {result.xp > 0 && <Comic size={26} color={C.lime}>{`+${result.xp} XP`}</Comic>}
                {result.doubled && (
                  <T size={12} rounded color={C.orange}>
                    ⚡ DOUBLED
                  </T>
                )}
              </View>
            )}
            {result.capped && (
              <T size={12} color={C.textMute} style={{ textAlign: 'center' }}>
                {`You’ve used today’s ${PAID_WINS_PER_DAY} paid wins. Best scores still count, and rewards reset tomorrow.`}
              </T>
            )}
            {result.chest && result.chestId && g.chests?.some((c) => c.id === result.chestId) && (
              <Pressable
                onPress={() => setOpening({ id: result.chestId!, tier: result.chest! })}
                style={styles.chestWon}
                accessibilityRole="button">
                <ChestArt tier={result.chest} size={64} bounce />
                <View style={{ flex: 1 }}>
                  <Comic size={20} color={CHEST_LOOK[result.chest].glow}>
                    {CHEST_LOOK[result.chest].name}
                  </Comic>
                  <T size={12} color={C.textDim}>
                    Tap to open it now
                  </T>
                </View>
              </Pressable>
            )}
          </Card>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <ArcadeButton label="AGAIN" size="md" colors={['#5FE2FF', '#1E8FE0']} textColor="#fff" onPress={start} style={{ flex: 1 }} />
            <ArcadeButton label="DONE" size="md" onPress={onExit} style={{ flex: 1 }} />
          </View>
        </Animated.View>
      )}
      <ChestOpener chest={opening} day={day} onClose={() => setOpening(null)} />
    </View>
  );
}

function Goal({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <View style={styles.goal}>
      <T size={10} rounded color={C.textDim}>
        {label}
      </T>
      <T size={15} rounded color={color} numberOfLines={1}>
        {value}
      </T>
      <T size={10} color={C.textMute} numberOfLines={1}>
        {sub}
      </T>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 22 },
  hud: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    alignSelf: 'stretch',
  },
  pads: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    width: 300,
    justifyContent: 'center',
  },
  pad: {
    width: 140,
    height: 140,
    borderRadius: 28,
    borderWidth: 4,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    width: 4 * 68 + 3 * 10,
  },
  tile: {
    width: 68,
    height: 68,
    borderRadius: 12,
    backgroundColor: '#2A2D30',
    borderWidth: 3,
    borderColor: C.ink,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
  },
  wordBox: {
    alignSelf: 'stretch',
    minHeight: 130,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    borderWidth: 3,
    borderColor: '#3A3E42',
    backgroundColor: '#15181A',
  },
  answers: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    alignSelf: 'stretch',
  },
  answer: {
    flexBasis: '47%',
    flexGrow: 1,
    height: 64,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderBottomWidth: 6,
    borderColor: C.ink,
  },
  yesNo: {
    flex: 1,
    height: 90,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderBottomWidth: 6,
    borderColor: C.ink,
  },
  keypad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    width: 3 * 84 + 2 * 10,
  },
  key: {
    width: 84,
    height: 58,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.surfaceHi,
    borderWidth: 2,
    borderBottomWidth: 5,
    borderColor: C.ink,
  },
  goals: { flexDirection: 'row', gap: 8 },
  goal: {
    flex: 1,
    gap: 2,
    padding: 8,
    borderRadius: 10,
    backgroundColor: '#00000055',
  },
  meta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  chestWon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    alignSelf: 'stretch',
    padding: 10,
    borderRadius: 14,
    backgroundColor: '#00000066',
  },
});
