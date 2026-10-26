import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, useAnimatedStyle, useSharedValue, withSequence, withTiming, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChestOpener } from '@/components/chest';
import { GlassButton, Icon } from '@/components/icon';
import { Bar, Card, T, tap } from '@/components/ui';
import { ArcadeButton, Backdrop, Comic } from '@/components/underground';
import { C, MaxContentWidth, Space } from '@/constants/theme';
import { t } from '@/lib/i18n';
import { EMPTY_PUZZLE, PIECES_DAILY, PIECES_FULL_DAY, PIECES_GANG_WIN, PIECES_STREAK, PUZZLE_COLS, PUZZLE_PIECES, PUZZLE_ROWS, isPuzzleDone, puzzleImage } from '@/lib/puzzle';
import { playSfx } from '@/lib/sound';
import { actions, useStore } from '@/lib/store';
import { useTodayKey } from '@/lib/use-today';

const RATIO = 1376 / 768; // the walls' height / width

/** The Arcade puzzle: pick a piece from the tray, then tap the spot where it belongs. */
export default function PuzzleScreen() {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const puzzle = useStore((s) => s.game.puzzle) ?? EMPTY_PUZZLE;
  const day = useTodayKey();
  const [picked, setPicked] = useState<number | null>(null);
  const [hint, setHint] = useState(false);
  const [chest, setChest] = useState<{ id: string; tier: 'gold' } | null>(null);
  const shake = useSharedValue(0);
  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }] }));

  // Sized so the board and the tray of pieces fit on one screen.
  const boardH = Math.min((Math.min(width, MaxContentWidth) - Space.md * 2 - 6) * RATIO, height * 0.52);
  const boardW = boardH / RATIO;
  const tileW = boardW / PUZZLE_COLS;
  const tileH = boardH / PUZZLE_ROWS;
  const image = puzzleImage(puzzle.n);
  const placed = new Set(puzzle.placed);
  const done = isPuzzleDone(puzzle);

  const tryPlace = (spot: number) => {
    if (picked == null || placed.has(spot)) return;
    if (actions.placePuzzlePiece(picked, spot)) {
      tap();
      playSfx('reward');
      setPicked(null);
    } else {
      shake.set(withSequence(withTiming(-8, { duration: 50 }), withTiming(8, { duration: 50 }), withTiming(-5, { duration: 50 }), withTiming(0, { duration: 50 })));
    }
  };

  const collect = () => {
    const id = actions.finishPuzzle();
    if (id) setChest({ id, tier: 'gold' });
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Backdrop />
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + Space.sm, paddingBottom: insets.bottom + 40 }]}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <T size={13} color={C.textDim} weight="600">
              {image.name}
            </T>
            <Comic size={36}>{t('puzzle.title')}</Comic>
          </View>
          <GlassButton icon="close" onPress={() => router.back()} />
        </View>

        <Card style={{ gap: 8 }}>
          <View style={styles.row}>
            <T size={13} rounded color={C.lime} style={{ flex: 1 }}>
              {t('puzzle.progress', { placed: puzzle.placed.length, total: PUZZLE_PIECES })}
            </T>
            <Pressable onPress={() => setHint((h) => !h)} hitSlop={6} accessibilityRole="switch" accessibilityState={{ checked: hint }}>
              <T size={12} rounded color={hint ? C.yellow : C.cyan}>
                {hint ? t('puzzle.hideHint') : t('puzzle.showHint')}
              </T>
            </Pressable>
          </View>
          <Bar value={puzzle.placed.length} max={PUZZLE_PIECES} color={C.lime} height={8} />
        </Card>

        <Animated.View style={[styles.frame, shakeStyle]}>
        <View style={[styles.board, { width: boardW, height: boardH }]}>
          {hint && <Image source={image.art} style={[StyleSheet.absoluteFill, { opacity: 0.18 }]} contentFit="fill" />}
          {Array.from({ length: PUZZLE_PIECES }, (_, i) => {
            const col = i % PUZZLE_COLS;
            const row = Math.floor(i / PUZZLE_COLS);
            const isPlaced = placed.has(i);
            return (
              <Pressable
                key={i}
                onPress={() => tryPlace(i)}
                disabled={isPlaced || picked == null}
                accessibilityLabel={t('puzzle.spotA11y', { n: i + 1 })}
                style={[styles.slot, { left: col * tileW, top: row * tileH, width: tileW, height: tileH }, !isPlaced && picked != null && styles.slotActive]}>
                {isPlaced && (
                  <Animated.View entering={FadeIn.duration(250)} style={StyleSheet.absoluteFill}>
                    <Piece art={image.art} index={i} tileW={tileW} tileH={tileH} boardW={boardW} boardH={boardH} />
                  </Animated.View>
                )}
              </Pressable>
            );
          })}
        </View>
        </Animated.View>

        {done ? (
          <Animated.View entering={ZoomIn} style={{ gap: 10 }}>
            <Comic size={28} color={C.yellow} style={{ textAlign: 'center' }}>
              {t('puzzle.doneTitle')}
            </Comic>
            <T size={14} color={C.text} style={{ textAlign: 'center' }}>
              {t('puzzle.doneBody')}
            </T>
            <ArcadeButton label={t('puzzle.collect')} size="md" onPress={collect} />
          </Animated.View>
        ) : (
          <Card style={{ gap: 10 }}>
            <T size={13} color={C.textDim} style={{ lineHeight: 18 }}>
              {puzzle.got.length ? (picked == null ? t('puzzle.pickPiece') : t('puzzle.tapSpot')) : t('puzzle.noPieces')}
            </T>
            {puzzle.got.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {puzzle.got.map((i) => (
                  <Pressable
                    key={i}
                    onPress={() => (tap(), setPicked(picked === i ? null : i))}
                    accessibilityRole="button"
                    accessibilityState={{ selected: picked === i }}
                    accessibilityLabel={t('puzzle.pieceA11y')}
                    style={[styles.trayPiece, { width: tileW * 1.6, height: tileH * 1.6 }, picked === i && styles.trayPicked]}>
                    <Piece art={image.art} index={i} tileW={tileW * 1.6} tileH={tileH * 1.6} boardW={boardW * 1.6} boardH={boardH * 1.6} />
                  </Pressable>
                ))}
              </ScrollView>
            )}
          </Card>
        )}

        <Card style={{ gap: 6 }}>
          <T size={12} rounded color={C.cyan}>
            {t('puzzle.howToGet')}
          </T>
          <Source icon="sun" text={t('puzzle.srcDaily', { count: PIECES_DAILY })} />
          <Source icon="check" text={t('puzzle.srcFullDay', { count: PIECES_FULL_DAY })} />
          <Source icon="flame" text={t('puzzle.srcStreak', { count: PIECES_STREAK })} />
          <Source icon="gift" text={t('puzzle.srcChests')} />
          <Source icon="trophy" text={t('puzzle.srcGang', { count: PIECES_GANG_WIN })} />
        </Card>
      </ScrollView>
      <ChestOpener chest={chest} day={day} onClose={() => setChest(null)} />
    </View>
  );
}

/** One piece: the picture cropped to its spot. */
function Piece({ art, index, tileW, tileH, boardW, boardH }: { art: number; index: number; tileW: number; tileH: number; boardW: number; boardH: number }) {
  const col = index % PUZZLE_COLS;
  const row = Math.floor(index / PUZZLE_COLS);
  return (
    <View style={{ width: tileW, height: tileH, overflow: 'hidden' }}>
      <Image source={art} style={{ position: 'absolute', width: boardW, height: boardH, left: -col * tileW, top: -row * tileH }} contentFit="fill" />
    </View>
  );
}

function Source({ icon, text }: { icon: React.ComponentProps<typeof Icon>['name']; text: string }) {
  return (
    <View style={styles.row}>
      <Icon name={icon} size={14} color={C.textDim} />
      <T size={12} color={C.textDim} style={{ flex: 1 }}>
        {text}
      </T>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: Space.md, gap: Space.md, maxWidth: MaxContentWidth, width: '100%', alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  frame: { alignSelf: 'center', padding: 3, borderRadius: 10, backgroundColor: C.ink },
  board: { borderRadius: 7, overflow: 'hidden', backgroundColor: '#14101F' },
  slot: { position: 'absolute', borderWidth: StyleSheet.hairlineWidth, borderColor: '#FFFFFF22' },
  slotActive: { borderColor: C.lime + '66' },
  trayPiece: { borderRadius: 6, overflow: 'hidden', borderWidth: 2, borderColor: C.ink },
  trayPicked: { borderColor: C.lime, transform: [{ scale: 1.08 }] },
});
