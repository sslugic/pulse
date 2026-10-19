import { LinearGradient } from 'expo-linear-gradient';
import { useMemo, type ReactNode } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, G, Line, LinearGradient as SvgLinearGradient, Path, Pattern, Polygon, RadialGradient, Rect, Stop, Text as SvgText } from 'react-native-svg';

import { C, Display } from '@/constants/theme';
import { questXp } from '@/lib/quests';
import { crewRank, RANKS } from '@/lib/rank';
import { useStore } from '@/lib/store';

// One backdrop scene per crew rank, so the app's walls change every time the player ranks up.

export const WALL_NAMES = [
  'BACK ALLEY',
  'HANDBALL COURT',
  'NIGHT STREET',
  'BODEGA CORNER',
  'BASKETBALL COURT',
  'ROOFTOP',
  'SUBWAY STATION',
  'SUBWAY TUNNEL',
  'TRAIN YARD',
  'BRIDGE UNDERPASS',
  'NEON CLUB',
  'BLOCK PARTY',
  'BILLBOARD SQUARE',
  'HALL OF FAME',
  'PULSE TOWER',
] as const;

type Piece = { text: string; x: number; y: number; size: number; fill: string; rot: number };
type SceneProps = { w: number; h: number; tags: string[]; station: string };

/** Small deterministic PRNG so every scene draws the same way each render. */
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/** One graffiti "throw-up": dark outline, colour fill, highlight and paint drips. */
function GraffitiPiece({ p }: { p: Piece }) {
  const drips = [0.18, 0.42, 0.7].map((f, i) => ({ dx: p.size * p.text.length * 0.55 * f, len: p.size * (0.35 + ((i * 37) % 5) * 0.12) }));
  return (
    <G rotation={p.rot} originX={p.x} originY={p.y}>
      <SvgText x={p.x + 4} y={p.y + 5} fontSize={p.size} fontFamily={Display.tag} fill="#000" opacity={0.55}>
        {p.text}
      </SvgText>
      <SvgText x={p.x} y={p.y} fontSize={p.size} fontFamily={Display.tag} fill={p.fill} stroke="#0B0C0D" strokeWidth={p.size / 8} strokeLinejoin="round">
        {p.text}
      </SvgText>
      <SvgText x={p.x - 2} y={p.y - 3} fontSize={p.size} fontFamily={Display.tag} fill="#fff" opacity={0.18}>
        {p.text}
      </SvgText>
      {drips.map((d, i) => (
        <G key={i}>
          <Line x1={p.x + d.dx} y1={p.y + 2} x2={p.x + d.dx} y2={p.y + d.len} stroke={p.fill} strokeWidth={p.size / 14} strokeLinecap="round" />
          <Circle cx={p.x + d.dx} cy={p.y + d.len + 2} r={p.size / 18} fill={p.fill} />
        </G>
      ))}
    </G>
  );
}

/** Spray mist: coloured speckles scattered over the scene. */
function Mist({ w, h, n = 24, seed = 3, colors = [C.lime, C.violet, C.orange, C.pink] }: { w: number; h: number; n?: number; seed?: number; colors?: string[] }) {
  const r = rng(seed);
  return (
    <G>
      {Array.from({ length: n }, (_, i) => (
        <Circle key={i} cx={r() * w} cy={r() * h} r={1 + r() * 2.2} fill={colors[i % colors.length]} opacity={0.55} />
      ))}
    </G>
  );
}

/** City skyline silhouette with a scatter of lit windows. */
function Skyline({ w, top, bottom, seed, color = '#0D0F14', lit = '#FFD58A' }: { w: number; top: number; bottom: number; seed: number; color?: string; lit?: string }) {
  const r = rng(seed);
  const blocks: { x: number; bw: number; bh: number }[] = [];
  for (let x = -10; x < w + 10; ) {
    const bw = 28 + r() * 46;
    blocks.push({ x, bw, bh: (bottom - top) * (0.35 + r() * 0.65) });
    x += bw + 2;
  }
  return (
    <G>
      {blocks.map((b, i) => (
        <G key={i}>
          <Rect x={b.x} y={bottom - b.bh} width={b.bw} height={b.bh} fill={color} />
          {Array.from({ length: Math.floor(b.bh / 14) }, (_, row) =>
            Array.from({ length: Math.floor(b.bw / 11) }, (_, col) =>
              r() > 0.72 ? <Rect key={`${row}-${col}`} x={b.x + 4 + col * 11} y={bottom - b.bh + 6 + row * 14} width={5} height={7} fill={lit} opacity={0.35 + r() * 0.5} /> : null,
            ),
          )}
        </G>
      ))}
    </G>
  );
}

/** Shared finish: grime falling to the floor plus a vignette, so panels on top stay readable. */
function Finish({ w, h, id }: { w: number; h: number; id: string }) {
  return (
    <>
      <Defs>
        <SvgLinearGradient id={`grime${id}`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#000" stopOpacity="0.15" />
          <Stop offset="0.6" stopColor="#000" stopOpacity="0.35" />
          <Stop offset="1" stopColor="#000" stopOpacity="0.8" />
        </SvgLinearGradient>
        <RadialGradient id={`vig${id}`} cx="50%" cy="40%" r="80%">
          <Stop offset="0.5" stopColor="#000" stopOpacity="0" />
          <Stop offset="1" stopColor="#000" stopOpacity="0.75" />
        </RadialGradient>
      </Defs>
      <Rect width={w} height={h} fill={`url(#grime${id})`} />
      <Rect width={w} height={h} fill={`url(#vig${id})`} />
    </>
  );
}

function Glow({ cx, cy, r, color, id, strength = 0.55 }: { cx: number; cy: number; r: number; color: string; id: string; strength?: number }) {
  return (
    <>
      <Defs>
        <RadialGradient id={id} cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={color} stopOpacity={strength} />
          <Stop offset="1" stopColor={color} stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Ellipse cx={cx} cy={cy} rx={r} ry={r} fill={`url(#${id})`} />
    </>
  );
}

// ---------- Rookie: back alley ----------

function BackAlley({ w, h, tags }: SceneProps) {
  return (
    <>
      <Defs>
        <Pattern id="brickA" width="48" height="24" patternUnits="userSpaceOnUse">
          <Rect width="48" height="24" fill="#120E0C" />
          <Rect x="1" y="1" width="46" height="10" rx="1" fill="#4A3328" />
          <Rect x="-23" y="13" width="46" height="10" rx="1" fill="#43302A" />
          <Rect x="25" y="13" width="46" height="10" rx="1" fill="#4D372B" />
        </Pattern>
      </Defs>
      <Rect width={w} height={h} fill="url(#brickA)" opacity={0.75} />
      <Glow cx={w * 0.5} cy={h * 0.14} r={w * 0.55} color="#FFC46B" id="lampA" strength={0.35} />
      {/* wall lamp */}
      <Rect x={w * 0.5 - 18} y={h * 0.1} width={36} height={10} rx={3} fill="#1A1A1A" />
      <Path d={`M${w * 0.5 - 14} ${h * 0.1 + 10} L${w * 0.5 + 14} ${h * 0.1 + 10} L${w * 0.5 + 8} ${h * 0.1 + 20} L${w * 0.5 - 8} ${h * 0.1 + 20} Z`} fill="#FFD58A" opacity={0.85} />
      {/* steel door */}
      <Rect x={w * 0.08} y={h * 0.5} width={w * 0.3} height={h * 0.42} fill="#2E3236" stroke="#0B0C0D" strokeWidth={4} />
      {[0.56, 0.7, 0.84].map((f) => (
        <Line key={f} x1={w * 0.08} y1={h * f} x2={w * 0.38} y2={h * f} stroke="#1B1E21" strokeWidth={3} />
      ))}
      <Circle cx={w * 0.34} cy={h * 0.72} r={4} fill="#8A8F94" />
      {/* dumpster */}
      <Rect x={w * 0.56} y={h * 0.74} width={w * 0.4} height={h * 0.18} rx={4} fill="#1F3A2A" stroke="#0B0C0D" strokeWidth={4} />
      <Rect x={w * 0.54} y={h * 0.72} width={w * 0.44} height={h * 0.03} fill="#16291E" stroke="#0B0C0D" strokeWidth={3} />
      {/* puddle */}
      <Ellipse cx={w * 0.5} cy={h * 0.96} rx={w * 0.35} ry={12} fill="#FFC46B" opacity={0.12} />
      <G opacity={0.5}>
        <GraffitiPiece p={{ text: tags[0] ?? 'NEW', x: w * 0.46, y: h * 0.4, size: 44, fill: C.orange, rot: -6 }} />
        <SvgText x={w * 0.62} y={h * 0.62} fontSize={22} fontFamily={Display.tag} fill="#E8E2CC" rotation={-6} originX={w * 0.62} originY={h * 0.62}>
          rookie
        </SvgText>
      </G>
      <Mist w={w} h={h} n={10} seed={11} colors={[C.orange, '#E8E2CC']} />
      <Finish w={w} h={h} id="A" />
    </>
  );
}

// ---------- Street Crew: night street ----------

function NightStreet({ w, h, tags }: SceneProps) {
  const wallTop = h * 0.3;
  return (
    <>
      <Defs>
        <SvgLinearGradient id="skyB" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#0B1030" />
          <Stop offset="1" stopColor="#2A1C3A" />
        </SvgLinearGradient>
        <Pattern id="brickB" width="44" height="22" patternUnits="userSpaceOnUse">
          <Rect width="44" height="22" fill="#100C0E" />
          <Rect x="1" y="1" width="42" height="9" rx="1" fill="#3E2A2E" />
          <Rect x="-21" y="12" width="42" height="9" rx="1" fill="#382629" />
          <Rect x="23" y="12" width="42" height="9" rx="1" fill="#422C30" />
        </Pattern>
      </Defs>
      <Rect width={w} height={wallTop} fill="url(#skyB)" />
      <Skyline w={w} top={h * 0.08} bottom={wallTop} seed={21} />
      <Rect y={wallTop} width={w} height={h - wallTop} fill="url(#brickB)" opacity={0.85} />
      {/* fire escape */}
      <G stroke="#0B0C0D" strokeWidth={4} opacity={0.85}>
        {[0.38, 0.55, 0.72].map((f) => (
          <Line key={f} x1={w * 0.66} y1={h * f} x2={w * 0.98} y2={h * f} />
        ))}
        <Line x1={w * 0.7} y1={h * 0.38} x2={w * 0.94} y2={h * 0.55} />
        <Line x1={w * 0.94} y1={h * 0.55} x2={w * 0.7} y2={h * 0.72} />
      </G>
      {/* street lamp */}
      <Glow cx={w * 0.18} cy={h * 0.42} r={w * 0.5} color="#FFB347" id="lampB" strength={0.4} />
      <Line x1={w * 0.08} y1={h * 0.43} x2={w * 0.08} y2={h} stroke="#0B0C0D" strokeWidth={8} />
      <Path d={`M${w * 0.08} ${h * 0.43} Q ${w * 0.14} ${h * 0.4} ${w * 0.2} ${h * 0.42}`} stroke="#0B0C0D" strokeWidth={6} fill="none" />
      <Ellipse cx={w * 0.2} cy={h * 0.43} rx={12} ry={6} fill="#FFD58A" />
      {/* sidewalk */}
      <Rect y={h * 0.9} width={w} height={h * 0.1} fill="#1A1B1D" />
      <Rect y={h * 0.9} width={w} height={5} fill="#3A3D40" />
      <G opacity={0.6}>
        <GraffitiPiece p={{ text: tags[0] ?? 'NYC', x: w * 0.06, y: h * 0.62, size: 56, fill: C.violet, rot: -8 }} />
        <GraffitiPiece p={{ text: 'CREW', x: w * 0.36, y: h * 0.8, size: 62, fill: C.lime, rot: -4 }} />
        <GraffitiPiece p={{ text: tags[1] ?? 'PULSE', x: w * 0.3, y: h * 0.47, size: 40, fill: C.pink, rot: 6 }} />
      </G>
      <Mist w={w} h={h} seed={22} />
      <Finish w={w} h={h} id="B" />
    </>
  );
}

// ---------- Skyline Runner: rooftop ----------

function Rooftop({ w, h, tags }: SceneProps) {
  const r = rng(31);
  const roof = h * 0.74;
  return (
    <>
      <Defs>
        <SvgLinearGradient id="skyC" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#060A1C" />
          <Stop offset="0.7" stopColor="#1C1638" />
          <Stop offset="1" stopColor="#3A1F3A" />
        </SvgLinearGradient>
      </Defs>
      <Rect width={w} height={h} fill="url(#skyC)" />
      {Array.from({ length: 40 }, (_, i) => (
        <Circle key={i} cx={r() * w} cy={r() * h * 0.4} r={0.6 + r() * 1.2} fill="#fff" opacity={0.3 + r() * 0.5} />
      ))}
      <Glow cx={w * 0.8} cy={h * 0.12} r={70} color="#FFF1C2" id="moonC" strength={0.45} />
      <Circle cx={w * 0.8} cy={h * 0.12} r={22} fill="#FFF1C2" opacity={0.9} />
      <Skyline w={w} top={h * 0.3} bottom={roof} seed={33} color="#0A0C14" lit="#FFD58A" />
      {/* water tower */}
      <G fill="#0B0C0D">
        <Rect x={w * 0.1} y={h * 0.46} width={w * 0.2} height={h * 0.14} rx={6} />
        <Polygon points={`${w * 0.08},${h * 0.46} ${w * 0.2},${h * 0.4} ${w * 0.32},${h * 0.46}`} />
        <Rect x={w * 0.12} y={h * 0.6} width={5} height={roof - h * 0.6} />
        <Rect x={w * 0.27} y={h * 0.6} width={5} height={roof - h * 0.6} />
      </G>
      {/* antenna */}
      <Line x1={w * 0.86} y1={h * 0.5} x2={w * 0.86} y2={roof} stroke="#0B0C0D" strokeWidth={4} />
      <Circle cx={w * 0.86} cy={h * 0.5} r={4} fill={C.danger} />
      {/* parapet */}
      <Rect y={roof} width={w} height={h - roof} fill="#2B2E31" />
      <Rect y={roof} width={w} height={8} fill="#45494D" />
      <G opacity={0.65}>
        <GraffitiPiece p={{ text: 'SKY', x: w * 0.08, y: roof + 70, size: 60, fill: C.yellow, rot: -5 }} />
        <GraffitiPiece p={{ text: tags[1] ?? 'PULSE', x: w * 0.52, y: roof + 110, size: 42, fill: C.cyan, rot: 6 }} />
      </G>
      <Mist w={w} h={h} n={14} seed={34} colors={[C.yellow, C.cyan]} />
      <Finish w={w} h={h} id="C" />
    </>
  );
}

// ---------- Subway Rider: subway station ----------

function SubwayStation({ w, h, tags, station }: SceneProps) {
  const bandY = Math.round(h * 0.47);
  const pieces: Piece[] = [
    { text: tags[0] ?? 'NYC', x: w * 0.05, y: h * 0.11, size: 54, fill: C.violet, rot: -10 },
    { text: tags[1] ?? 'PULSE', x: w * 0.42, y: h * 0.56, size: 66, fill: C.lime, rot: -6 },
    { text: 'CREW', x: w * 0.04, y: h * 0.8, size: 46, fill: C.orange, rot: 8 },
    { text: 'GO!', x: w * 0.66, y: h * 0.22, size: 40, fill: C.pink, rot: 12 },
  ];
  return (
    <>
      <Defs>
        <Pattern id="tile" width="44" height="22" patternUnits="userSpaceOnUse">
          <Rect width="44" height="22" fill="#141616" />
          <Rect x="1.5" y="1.5" width="41" height="19" rx="2.5" fill="#8C918A" />
          <Rect x="3" y="3" width="38" height="5" rx="2" fill="#fff" opacity={0.12} />
        </Pattern>
        <Pattern id="mosaic" width="12" height="12" patternUnits="userSpaceOnUse">
          <Rect width="12" height="12" fill="#101211" />
          <Rect x="1" y="1" width="10" height="10" fill="#3F8F3A" />
        </Pattern>
        <Pattern id="mosaic2" width="12" height="12" patternUnits="userSpaceOnUse">
          <Rect width="12" height="12" fill="#101211" />
          <Rect x="1" y="1" width="10" height="10" fill="#C9A227" />
        </Pattern>
        <RadialGradient id="stain" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor="#3B2A12" stopOpacity="0.5" />
          <Stop offset="1" stopColor="#3B2A12" stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Rect width={w} height={h} fill="url(#tile)" opacity={0.55} />
      <Rect x={0} y={bandY} width={w} height={10} fill="url(#mosaic2)" opacity={0.7} />
      <Rect x={0} y={bandY + 10} width={w} height={44} fill="url(#mosaic)" opacity={0.75} />
      <Rect x={0} y={bandY + 54} width={w} height={10} fill="url(#mosaic2)" opacity={0.7} />
      <Rect x={w / 2 - 78} y={bandY + 14} width={156} height={36} fill="#0E100F" opacity={0.85} />
      <SvgText x={w / 2} y={bandY + 40} fontSize={22} fontFamily={Display.block} fill="#E8E2CC" textAnchor="middle" letterSpacing={3} opacity={0.85}>
        {station}
      </SvgText>
      <Ellipse cx={w * 0.18} cy={h * 0.47} rx={90} ry={160} fill="url(#stain)" />
      <Ellipse cx={w * 0.86} cy={h * 0.72} rx={110} ry={190} fill="url(#stain)" />
      <G opacity={0.55}>
        {pieces.map((p) => (
          <GraffitiPiece key={p.text} p={p} />
        ))}
        <SvgText x={w * 0.62} y={h * 0.93} fontSize={30} fontFamily={Display.tag} fill="#E8E2CC" rotation={-8} originX={w * 0.62} originY={h * 0.93}>
          skrap 99
        </SvgText>
      </G>
      <Mist w={w} h={h} n={26} seed={41} />
      <Finish w={w} h={h} id="D" />
    </>
  );
}

// ---------- Yard Bomber: train yard ----------

function TrainYard({ w, h, tags }: SceneProps) {
  const carTop = h * 0.3;
  const carBottom = h * 0.78;
  return (
    <>
      <Defs>
        <SvgLinearGradient id="skyE" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#0A0D16" />
          <Stop offset="1" stopColor="#1B1E28" />
        </SvgLinearGradient>
        <Pattern id="fenceE" width="18" height="18" patternUnits="userSpaceOnUse">
          <Path d="M0 0 L18 18 M18 0 L0 18" stroke="#5E6468" strokeWidth={1.2} />
        </Pattern>
        <SvgLinearGradient id="carE" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#8E959B" />
          <Stop offset="0.5" stopColor="#6E747A" />
          <Stop offset="1" stopColor="#4A4F54" />
        </SvgLinearGradient>
      </Defs>
      <Rect width={w} height={h} fill="url(#skyE)" />
      <Glow cx={w * 0.5} cy={h * 0.05} r={w * 0.7} color="#9CC8FF" id="floodE" strength={0.25} />
      <Rect width={w} height={carTop + 20} fill="url(#fenceE)" opacity={0.35} />
      {/* subway car */}
      <Rect x={-20} y={carTop} width={w + 40} height={carBottom - carTop} rx={14} fill="url(#carE)" stroke="#0B0C0D" strokeWidth={5} />
      {Array.from({ length: 9 }, (_, i) => (
        <Line key={i} x1={0} x2={w} y1={carTop + 16 + i * ((carBottom - carTop - 30) / 8)} y2={carTop + 16 + i * ((carBottom - carTop - 30) / 8)} stroke="#000" strokeOpacity={0.15} strokeWidth={2} />
      ))}
      {[0.04, 0.3, 0.56, 0.82].map((f) => (
        <Rect key={f} x={w * f} y={carTop + 14} width={w * 0.14} height={h * 0.07} rx={6} fill="#141820" stroke="#0B0C0D" strokeWidth={3} />
      ))}
      <Rect x={w * 0.2} y={carTop + 10} width={w * 0.08} height={carBottom - carTop - 20} fill="none" stroke="#0B0C0D" strokeWidth={3} />
      <Rect x={w * 0.72} y={carTop + 10} width={w * 0.08} height={carBottom - carTop - 20} fill="none" stroke="#0B0C0D" strokeWidth={3} />
      {/* whole-car burner */}
      <G opacity={0.78}>
        <GraffitiPiece p={{ text: 'BOMBER', x: w * 0.03, y: carTop + h * 0.25, size: 76, fill: C.orange, rot: -4 }} />
        <GraffitiPiece p={{ text: tags[1] ?? 'PULSE', x: w * 0.4, y: carTop + h * 0.4, size: 48, fill: C.cyan, rot: 3 }} />
      </G>
      {/* wheels and rails */}
      {[0.12, 0.3, 0.7, 0.88].map((f) => (
        <Circle key={f} cx={w * f} cy={carBottom + 6} r={14} fill="#1A1C1E" stroke="#0B0C0D" strokeWidth={3} />
      ))}
      <Rect y={carBottom + 20} width={w} height={6} fill="#9AA0A4" />
      <Rect y={h * 0.9} width={w} height={6} fill="#9AA0A4" />
      {Array.from({ length: 12 }, (_, i) => (
        <Rect key={i} x={i * (w / 11) - 8} y={carBottom + 18} width={14} height={h * 0.9 - carBottom} fill="#3B2A1C" opacity={0.7} />
      ))}
      <Mist w={w} h={h} n={18} seed={51} colors={[C.orange, C.cyan, C.yellow]} />
      <Finish w={w} h={h} id="E" />
    </>
  );
}

// ---------- Neon Ace: neon club ----------

function NeonTube({ d, color }: { d: string; color: string }) {
  return (
    <G>
      <Path d={d} stroke={color} strokeOpacity={0.18} strokeWidth={18} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <Path d={d} stroke={color} strokeOpacity={0.35} strokeWidth={9} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <Path d={d} stroke="#fff" strokeOpacity={0.9} strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </G>
  );
}

function NeonClub({ w, h }: SceneProps) {
  const horizon = h * 0.62;
  const vx = w / 2;
  return (
    <>
      <Defs>
        <SvgLinearGradient id="skyF" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#0B0614" />
          <Stop offset="1" stopColor="#25103A" />
        </SvgLinearGradient>
      </Defs>
      <Rect width={w} height={h} fill="url(#skyF)" />
      <Glow cx={vx} cy={horizon} r={w * 0.8} color={C.pink} id="hazeF" strength={0.3} />
      {/* perspective grid floor */}
      <G stroke={C.pink} strokeOpacity={0.45} strokeWidth={1.5}>
        {Array.from({ length: 15 }, (_, i) => {
          const x = -w + (i * (3 * w)) / 14;
          return <Line key={`v${i}`} x1={vx} y1={horizon} x2={x} y2={h} />;
        })}
        {Array.from({ length: 9 }, (_, i) => {
          const y = horizon + (h - horizon) * Math.pow(i / 8, 1.8);
          return <Line key={`h${i}`} x1={0} y1={y} x2={w} y2={y} />;
        })}
      </G>
      <Line x1={0} y1={horizon} x2={w} y2={horizon} stroke={C.violet} strokeWidth={3} />
      {/* neon signs, kept a touch dim so text on top stays readable */}
      <G opacity={0.7}>
      <NeonTube d={`M${w * 0.12} ${h * 0.14} L${w * 0.22} ${h * 0.26} L${w * 0.16} ${h * 0.27} L${w * 0.26} ${h * 0.4}`} color={C.yellow} />
      <NeonTube d={`M${w * 0.62} ${h * 0.2} a 48 48 0 1 0 96 0 a 48 48 0 1 0 -96 0`} color={C.cyan} />
      <NeonTube d={`M${w * 0.08} ${h * 0.5} L${w * 0.92} ${h * 0.5}`} color={C.violet} />
      </G>
      <G>
        <SvgText x={w / 2} y={h * 0.46} fontSize={64} fontFamily={Display.comic} textAnchor="middle" fill="none" stroke={C.pink} strokeOpacity={0.35} strokeWidth={10}>
          ACE
        </SvgText>
        <SvgText x={w / 2} y={h * 0.46} fontSize={64} fontFamily={Display.comic} textAnchor="middle" fill="none" stroke="#FFD1EA" strokeWidth={2}>
          ACE
        </SvgText>
      </G>
      <Mist w={w} h={h} n={30} seed={61} colors={[C.pink, C.cyan, C.violet]} />
      <Finish w={w} h={h} id="F" />
    </>
  );
}

// ---------- Hall of Famer: hall of fame ----------

function HallOfFame({ w, h, tags }: SceneProps) {
  const gold = '#E8B830';
  const cw = w * 0.3;
  const ch = cw * 0.5;
  const y0 = h * 0.35;
  return (
    <>
      <Defs>
        <Pattern id="concG" width="80" height="40" patternUnits="userSpaceOnUse">
          <Rect width="80" height="40" fill="#2A2620" />
          <Rect x="1" y="1" width="78" height="38" fill="#3A342A" />
        </Pattern>
      </Defs>
      <Rect width={w} height={h} fill="url(#concG)" opacity={0.85} />
      <Glow cx={w * 0.5} cy={h * 0.2} r={w * 0.75} color={gold} id="spotG" strength={0.4} />
      {/* spotlight cones */}
      <Polygon points={`${w * 0.15},0 ${w * 0.25},0 ${w * 0.55},${h * 0.7} ${w * 0.05},${h * 0.7}`} fill={gold} opacity={0.06} />
      <Polygon points={`${w * 0.75},0 ${w * 0.85},0 ${w * 0.95},${h * 0.7} ${w * 0.45},${h * 0.7}`} fill={gold} opacity={0.06} />
      {/* crown and plaque, sized from the width so they keep their shape on tall screens */}
      <G opacity={0.55}>
        <Path
          d={`M${w / 2 - cw / 2} ${y0 + ch} L${w / 2 - cw / 2} ${y0 + ch * 0.25} L${w / 2 - cw / 4} ${y0 + ch * 0.6} L${w / 2} ${y0} L${w / 2 + cw / 4} ${y0 + ch * 0.6} L${w / 2 + cw / 2} ${y0 + ch * 0.25} L${w / 2 + cw / 2} ${y0 + ch} Z`}
          fill={gold}
          stroke="#0B0C0D"
          strokeWidth={4}
          strokeLinejoin="round"
        />
        {[-cw / 2, 0, cw / 2].map((dx) => (
          <Circle key={dx} cx={w / 2 + dx} cy={dx === 0 ? y0 : y0 + ch * 0.25} r={5} fill={gold} stroke="#0B0C0D" strokeWidth={2} />
        ))}
        <Rect x={w / 2 - cw * 0.8} y={y0 + ch + 10} width={cw * 1.6} height={32} rx={4} fill="#1A1610" stroke={gold} strokeWidth={3} />
        <SvgText x={w / 2} y={y0 + ch + 32} fontSize={16} fontFamily={Display.block} fill={gold} textAnchor="middle" letterSpacing={3}>
          HALL OF FAME
        </SvgText>
      </G>
      <G opacity={0.6}>
        <GraffitiPiece p={{ text: 'KING', x: w * 0.04, y: h * 0.48, size: 58, fill: gold, rot: -8 }} />
        <GraffitiPiece p={{ text: tags[1] ?? 'PULSE', x: w * 0.42, y: h * 0.62, size: 60, fill: C.pink, rot: -3 }} />
        <GraffitiPiece p={{ text: 'FAME', x: w * 0.1, y: h * 0.82, size: 54, fill: C.cyan, rot: 6 }} />
        <GraffitiPiece p={{ text: tags[0] ?? 'NYC', x: w * 0.62, y: h * 0.9, size: 40, fill: C.lime, rot: 8 }} />
      </G>
      <Mist w={w} h={h} n={30} seed={71} colors={[gold, C.pink, C.cyan, '#fff']} />
      <Finish w={w} h={h} id="G" />
    </>
  );
}

// ---------- Tagger: handball court ----------

function HandballCourt({ w, h, tags }: SceneProps) {
  const top = h * 0.16;
  const floor = h * 0.84;
  return (
    <>
      <Defs>
        <Pattern id="fenceH" width="16" height="16" patternUnits="userSpaceOnUse">
          <Path d="M0 0 L16 16 M16 0 L0 16" stroke="#6A7076" strokeWidth={1.2} />
        </Pattern>
        <SvgLinearGradient id="wallH" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#5A6068" />
          <Stop offset="1" stopColor="#3A3F46" />
        </SvgLinearGradient>
      </Defs>
      <Rect width={w} height={top} fill="#0E1118" />
      <Rect width={w} height={top} fill="url(#fenceH)" opacity={0.5} />
      <Glow cx={w * 0.85} cy={top * 0.6} r={w * 0.6} color="#CFE3FF" id="floodH" strength={0.3} />
      {/* the handball wall: painted panel with the service line */}
      <Rect y={top} width={w} height={floor - top} fill="url(#wallH)" />
      <Rect x={w * 0.06} y={top + 20} width={w * 0.88} height={floor - top - 40} fill="#2F5E8C" opacity={0.55} stroke="#E8E2CC" strokeWidth={3} strokeOpacity={0.5} />
      <Line x1={w * 0.06} y1={h * 0.62} x2={w * 0.94} y2={h * 0.62} stroke="#E8E2CC" strokeWidth={4} opacity={0.6} />
      {/* court floor */}
      <Rect y={floor} width={w} height={h - floor} fill="#3B4A5A" />
      <Line x1={0} y1={floor + 26} x2={w} y2={floor + 26} stroke="#E8E2CC" strokeWidth={3} opacity={0.5} />
      <Circle cx={w * 0.72} cy={floor + 14} r={9} fill="#2F6FE0" stroke="#0B0C0D" strokeWidth={2} />
      <G opacity={0.6}>
        <GraffitiPiece p={{ text: 'TAG', x: w * 0.1, y: h * 0.4, size: 64, fill: C.yellow, rot: -7 }} />
        <GraffitiPiece p={{ text: tags[0] ?? 'NYC', x: w * 0.5, y: h * 0.54, size: 40, fill: C.pink, rot: 5 }} />
        <SvgText x={w * 0.2} y={h * 0.76} fontSize={26} fontFamily={Display.tag} fill="#E8E2CC" rotation={-5} originX={w * 0.2} originY={h * 0.76}>
          was here
        </SvgText>
      </G>
      <Mist w={w} h={h} n={14} seed={81} colors={[C.yellow, C.pink, '#E8E2CC']} />
      <Finish w={w} h={h} id="H" />
    </>
  );
}

// ---------- Corner Captain: bodega corner ----------

function BodegaCorner({ w, h, tags }: SceneProps) {
  const awning = h * 0.3;
  const floor = h * 0.88;
  const stripes = 9;
  return (
    <>
      <Defs>
        <Pattern id="brickI" width="44" height="22" patternUnits="userSpaceOnUse">
          <Rect width="44" height="22" fill="#140C0A" />
          <Rect x="1" y="1" width="42" height="9" rx="1" fill="#5A2E22" />
          <Rect x="-21" y="12" width="42" height="9" rx="1" fill="#52291F" />
          <Rect x="23" y="12" width="42" height="9" rx="1" fill="#5E3124" />
        </Pattern>
        <Pattern id="gateI" width="10" height="8" patternUnits="userSpaceOnUse">
          <Rect width="10" height="8" fill="#5C6266" />
          <Rect y="6" width="10" height="2" fill="#30343A" />
        </Pattern>
      </Defs>
      <Rect width={w} height={h} fill="url(#brickI)" opacity={0.8} />
      {/* striped awning */}
      {Array.from({ length: stripes }, (_, i) => (
        <Rect key={i} x={(i * w) / stripes} y={awning - 46} width={w / stripes + 1} height={46} fill={i % 2 ? '#E8E2CC' : '#C8322A'} opacity={0.8} />
      ))}
      <Path d={Array.from({ length: stripes }, (_, i) => `M${(i * w) / stripes} ${awning} q ${w / stripes / 2} 14 ${w / stripes} 0`).join(' ')} fill="#C8322A" opacity={0.8} />
      {/* lit shop window and neon */}
      <Glow cx={w * 0.3} cy={h * 0.5} r={w * 0.45} color="#FFD58A" id="shopI" strength={0.35} />
      <Rect x={w * 0.06} y={awning + 30} width={w * 0.5} height={h * 0.32} fill="#3A2C14" stroke="#0B0C0D" strokeWidth={5} />
      <Rect x={w * 0.06} y={awning + 30} width={w * 0.5} height={h * 0.32} fill="#FFD58A" opacity={0.18} />
      {[0.12, 0.22, 0.32, 0.42].map((f) => (
        <Rect key={f} x={w * f} y={awning + 30 + h * 0.22} width={w * 0.07} height={h * 0.1} fill="#0B0C0D" opacity={0.35} />
      ))}
      <NeonTube d={`M${w * 0.1} ${awning + 60} L${w * 0.24} ${awning + 60}`} color={C.pink} />
      <SvgText x={w * 0.31} y={awning + 98} fontSize={28} fontFamily={Display.block} fill="#FFD1EA" textAnchor="middle" letterSpacing={4} opacity={0.85}>
        DELI
      </SvgText>
      {/* roll-down gate */}
      <Rect x={w * 0.62} y={awning + 10} width={w * 0.34} height={floor - awning - 10} fill="url(#gateI)" stroke="#0B0C0D" strokeWidth={4} />
      <G opacity={0.7}>
        <GraffitiPiece p={{ text: 'CAPT', x: w * 0.63, y: h * 0.6, size: 40, fill: C.lime, rot: -6 }} />
        <GraffitiPiece p={{ text: tags[1] ?? 'PULSE', x: w * 0.08, y: h * 0.82, size: 46, fill: C.cyan, rot: -3 }} />
      </G>
      {/* sidewalk */}
      <Rect y={floor} width={w} height={h - floor} fill="#1E1F21" />
      <Rect y={floor} width={w} height={5} fill="#45484C" />
      <Mist w={w} h={h} n={16} seed={91} colors={[C.lime, C.cyan, C.pink]} />
      <Finish w={w} h={h} id="I" />
    </>
  );
}

// ---------- Block Boss: basketball court ----------

function BasketballCourt({ w, h, tags }: SceneProps) {
  const ground = h * 0.66;
  const bx = w / 2;
  return (
    <>
      <Defs>
        <SvgLinearGradient id="skyJ" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#070B16" />
          <Stop offset="1" stopColor="#1C2430" />
        </SvgLinearGradient>
        <Pattern id="fenceJ" width="18" height="18" patternUnits="userSpaceOnUse">
          <Path d="M0 0 L18 18 M18 0 L0 18" stroke="#7A8086" strokeWidth={1.2} />
        </Pattern>
      </Defs>
      <Rect width={w} height={h} fill="url(#skyJ)" />
      <Skyline w={w} top={h * 0.12} bottom={ground} seed={101} />
      <Rect y={h * 0.2} width={w} height={ground - h * 0.2} fill="url(#fenceJ)" opacity={0.35} />
      {/* floodlights */}
      <Glow cx={w * 0.12} cy={h * 0.14} r={w * 0.55} color="#E8F2FF" id="floodJ1" strength={0.35} />
      <Glow cx={w * 0.88} cy={h * 0.14} r={w * 0.55} color="#E8F2FF" id="floodJ2" strength={0.35} />
      <Rect x={w * 0.06} y={h * 0.12} width={w * 0.12} height={10} fill="#F2F6FF" opacity={0.9} />
      <Rect x={w * 0.82} y={h * 0.12} width={w * 0.12} height={10} fill="#F2F6FF" opacity={0.9} />
      {/* hoop */}
      <Rect x={bx - 4} y={h * 0.36} width={8} height={ground - h * 0.36} fill="#0B0C0D" />
      <Rect x={bx - w * 0.17} y={h * 0.28} width={w * 0.34} height={h * 0.1} fill="#E8E2CC" opacity={0.85} stroke="#0B0C0D" strokeWidth={4} />
      <Rect x={bx - w * 0.06} y={h * 0.32} width={w * 0.12} height={h * 0.05} fill="none" stroke={C.orange} strokeWidth={3} />
      <Ellipse cx={bx} cy={h * 0.385} rx={w * 0.07} ry={5} fill="none" stroke={C.orange} strokeWidth={4} />
      <Path d={`M${bx - w * 0.07} ${h * 0.39} L${bx - w * 0.04} ${h * 0.44} L${bx + w * 0.04} ${h * 0.44} L${bx + w * 0.07} ${h * 0.39} M${bx - w * 0.03} ${h * 0.39} L${bx - w * 0.02} ${h * 0.44} M${bx + w * 0.03} ${h * 0.39} L${bx + w * 0.02} ${h * 0.44}`} stroke="#E8E2CC" strokeWidth={1.5} fill="none" opacity={0.8} />
      {/* court */}
      <Rect y={ground} width={w} height={h - ground} fill="#2F5A4A" />
      <Path d={`M${bx - w * 0.22} ${h} L${bx - w * 0.16} ${ground} L${bx + w * 0.16} ${ground} L${bx + w * 0.22} ${h}`} fill={C.orange} opacity={0.35} stroke="#E8E2CC" strokeWidth={3} strokeOpacity={0.6} />
      <Ellipse cx={bx} cy={ground + (h - ground) * 0.55} rx={w * 0.2} ry={(h - ground) * 0.18} fill="none" stroke="#E8E2CC" strokeWidth={3} opacity={0.6} />
      <G opacity={0.65}>
        <GraffitiPiece p={{ text: 'BOSS', x: w * 0.04, y: h * 0.58, size: 58, fill: C.yellow, rot: -6 }} />
        <GraffitiPiece p={{ text: tags[0] ?? 'NYC', x: w * 0.64, y: h * 0.6, size: 36, fill: C.cyan, rot: 6 }} />
      </G>
      <Mist w={w} h={h} n={14} seed={102} colors={[C.yellow, C.orange, C.cyan]} />
      <Finish w={w} h={h} id="J" />
    </>
  );
}

// ---------- Subway King: subway tunnel ----------

function SubwayTunnel({ w, h, tags }: SceneProps) {
  const vx = w / 2;
  const vy = h * 0.44;
  const rings = 7;
  return (
    <>
      <Rect width={w} height={h} fill="#0A0A0A" />
      {/* tunnel rings receding to the vanishing point */}
      {Array.from({ length: rings }, (_, i) => {
        const k = Math.pow((rings - i) / rings, 1.6);
        const rw = w * 0.75 * k + 18;
        const rh = h * 0.62 * k + 24;
        return (
          <Path
            key={i}
            d={`M${vx - rw} ${vy + rh * 0.55} L${vx - rw} ${vy - rh * 0.2} Q ${vx - rw} ${vy - rh * 0.75} ${vx} ${vy - rh * 0.75} Q ${vx + rw} ${vy - rh * 0.75} ${vx + rw} ${vy - rh * 0.2} L${vx + rw} ${vy + rh * 0.55}`}
            fill="none"
            stroke="#3A3E42"
            strokeOpacity={0.3 + 0.1 * (rings - i) / rings}
            strokeWidth={4 + 6 * k}
          />
        );
      })}
      <Glow cx={vx} cy={vy} r={w * 0.35} color="#FFF1C2" id="lightK" strength={0.5} />
      <Circle cx={vx - 10} cy={vy} r={5} fill="#FFF8E0" />
      <Circle cx={vx + 10} cy={vy} r={5} fill="#FFF8E0" />
      {/* rails */}
      <G stroke="#9AA0A4" strokeWidth={4}>
        <Line x1={vx - 8} y1={vy + 10} x2={w * 0.12} y2={h} />
        <Line x1={vx + 8} y1={vy + 10} x2={w * 0.88} y2={h} />
      </G>
      {Array.from({ length: 8 }, (_, i) => {
        const t = Math.pow((i + 1) / 8, 1.8);
        const y = vy + 10 + (h - vy - 10) * t;
        const half = 8 + (w * 0.38 - 8) * t;
        return <Line key={i} x1={vx - half - 6} y1={y} x2={vx + half + 6} y2={y} stroke="#3B2A1C" strokeWidth={2 + 6 * t} />;
      })}
      {/* signal lights */}
      <Rect x={w * 0.08} y={h * 0.3} width={22} height={50} rx={5} fill="#141414" stroke="#0B0C0D" strokeWidth={3} />
      <Circle cx={w * 0.08 + 11} cy={h * 0.3 + 14} r={6} fill={C.danger} />
      <Circle cx={w * 0.08 + 11} cy={h * 0.3 + 34} r={6} fill="#2E7D32" opacity={0.4} />
      <Glow cx={w * 0.08 + 11} cy={h * 0.3 + 14} r={40} color={C.danger} id="sigK" strength={0.4} />
      <G opacity={0.55}>
        <GraffitiPiece p={{ text: 'KING', x: w * 0.56, y: h * 0.26, size: 50, fill: C.yellow, rot: 8 }} />
        <GraffitiPiece p={{ text: tags[1] ?? 'PULSE', x: w * 0.04, y: h * 0.7, size: 42, fill: C.lime, rot: -10 }} />
      </G>
      <Mist w={w} h={h} n={12} seed={111} colors={[C.yellow, C.lime]} />
      <Finish w={w} h={h} id="K" />
    </>
  );
}

// ---------- Legend: bridge underpass ----------

function BridgeUnderpass({ w, h, tags }: SceneProps) {
  const deck = h * 0.2;
  const water = h * 0.72;
  const r = rng(121);
  return (
    <>
      <Defs>
        <SvgLinearGradient id="skyL" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#0A1220" />
          <Stop offset="1" stopColor="#24304A" />
        </SvgLinearGradient>
        <SvgLinearGradient id="waterL" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#14223A" />
          <Stop offset="1" stopColor="#060A12" />
        </SvgLinearGradient>
      </Defs>
      <Rect width={w} height={water} fill="url(#skyL)" />
      <Skyline w={w} top={h * 0.4} bottom={water} seed={122} color="#0B1018" />
      {/* bridge deck with steel girders */}
      <Rect width={w} height={deck} fill="#1A1F26" />
      <G stroke="#3A4450" strokeWidth={5}>
        {Array.from({ length: 8 }, (_, i) => (
          <Line key={i} x1={(i * w) / 7} y1={deck} x2={((i + 1) * w) / 7} y2={0} />
        ))}
      </G>
      <Rect y={deck - 10} width={w} height={14} fill="#2C343E" stroke="#0B0C0D" strokeWidth={3} />
      {Array.from({ length: 9 }, (_, i) => (
        <Circle key={i} cx={(i + 0.5) * (w / 9)} cy={deck - 3} r={2.5} fill="#8A96A4" />
      ))}
      {/* stone pillars */}
      {[0.02, 0.7].map((f) => (
        <Rect key={f} x={w * f} y={deck} width={w * 0.28} height={h - deck} fill="#4A4642" stroke="#0B0C0D" strokeWidth={4} />
      ))}
      {/* river with city light reflections */}
      <Rect x={w * 0.3} y={water} width={w * 0.4} height={h - water} fill="url(#waterL)" />
      {Array.from({ length: 14 }, (_, i) => (
        <Rect key={i} x={w * 0.32 + r() * w * 0.34} y={water + 8 + r() * (h - water - 20)} width={10 + r() * 24} height={2} fill="#FFD58A" opacity={0.25 + r() * 0.35} />
      ))}
      <G opacity={0.7}>
        <GraffitiPiece p={{ text: 'LEG', x: w * 0.04, y: h * 0.48, size: 50, fill: C.orange, rot: -8 }} />
        <GraffitiPiece p={{ text: 'END', x: w * 0.72, y: h * 0.5, size: 50, fill: C.orange, rot: 8 }} />
        <GraffitiPiece p={{ text: tags[0] ?? 'NYC', x: w * 0.05, y: h * 0.78, size: 36, fill: C.cyan, rot: 4 }} />
        <GraffitiPiece p={{ text: tags[1] ?? 'PULSE', x: w * 0.71, y: h * 0.8, size: 30, fill: C.lime, rot: -4 }} />
      </G>
      <Mist w={w} h={h} n={18} seed={123} colors={[C.orange, C.cyan, C.lime]} />
      <Finish w={w} h={h} id="L" />
    </>
  );
}

// ---------- Underground Icon: block party ----------

function BlockParty({ w, h, tags }: SceneProps) {
  const floor = h * 0.8;
  const r = rng(131);
  const bulbs = [C.pink, C.yellow, C.cyan, C.lime, C.violet];
  const speaker = (x: number, y: number, s: number) => (
    <G key={`${x}-${y}`}>
      <Rect x={x} y={y} width={s} height={s * 1.3} rx={4} fill="#141414" stroke="#0B0C0D" strokeWidth={3} />
      <Circle cx={x + s / 2} cy={y + s * 0.38} r={s * 0.28} fill="#2A2A2A" stroke="#555" strokeWidth={2} />
      <Circle cx={x + s / 2} cy={y + s * 0.38} r={s * 0.1} fill="#555" />
      <Circle cx={x + s / 2} cy={y + s * 0.98} r={s * 0.18} fill="#2A2A2A" stroke="#555" strokeWidth={2} />
    </G>
  );
  return (
    <>
      <Defs>
        <Pattern id="brickM" width="44" height="22" patternUnits="userSpaceOnUse">
          <Rect width="44" height="22" fill="#0E0812" />
          <Rect x="1" y="1" width="42" height="9" rx="1" fill="#2E1A36" />
          <Rect x="-21" y="12" width="42" height="9" rx="1" fill="#2A1730" />
          <Rect x="23" y="12" width="42" height="9" rx="1" fill="#331D3A" />
        </Pattern>
      </Defs>
      <Rect width={w} height={h} fill="url(#brickM)" opacity={0.9} />
      {/* string lights */}
      {[0.1, 0.2].map((f, row) => (
        <G key={f}>
          <Path d={`M0 ${h * f} Q ${w / 2} ${h * f + 50} ${w} ${h * f}`} stroke="#0B0C0D" strokeWidth={2} fill="none" />
          {Array.from({ length: 12 }, (_, i) => {
            const t = (i + 0.5) / 12;
            const y = h * f + 100 * t * (1 - t);
            return <Circle key={i} cx={w * t} cy={y + 6} r={4} fill={bulbs[(i + row) % bulbs.length]} opacity={0.9} />;
          })}
        </G>
      ))}
      <Glow cx={w / 2} cy={h * 0.55} r={w * 0.7} color={C.violet} id="partyM" strength={0.3} />
      {/* speaker stacks and a boombox */}
      {speaker(w * 0.04, floor - w * 0.22 * 1.3 * 2, w * 0.22)}
      {speaker(w * 0.04, floor - w * 0.22 * 1.3, w * 0.22)}
      {speaker(w * 0.74, floor - w * 0.22 * 1.3 * 2, w * 0.22)}
      {speaker(w * 0.74, floor - w * 0.22 * 1.3, w * 0.22)}
      <Rect x={w * 0.34} y={floor - 60} width={w * 0.32} height={56} rx={8} fill="#1E1E22" stroke="#0B0C0D" strokeWidth={4} />
      <Path d={`M${w * 0.38} ${floor - 60} Q ${w / 2} ${floor - 96} ${w * 0.62} ${floor - 60}`} stroke="#0B0C0D" strokeWidth={6} fill="none" />
      <Circle cx={w * 0.4} cy={floor - 32} r={16} fill="#2A2A2A" stroke={C.pink} strokeWidth={2} />
      <Circle cx={w * 0.6} cy={floor - 32} r={16} fill="#2A2A2A" stroke={C.pink} strokeWidth={2} />
      <Rect x={w * 0.46} y={floor - 46} width={w * 0.08} height={14} fill={C.cyan} opacity={0.7} />
      <Rect y={floor} width={w} height={h - floor} fill="#141016" />
      {Array.from({ length: 8 }, (_, i) => (
        <SvgText key={i} x={w * (0.3 + r() * 0.4)} y={h * (0.3 + r() * 0.2)} fontSize={18 + r() * 10} fill={bulbs[i % bulbs.length]} opacity={0.5}>
          ♪
        </SvgText>
      ))}
      <G opacity={0.6}>
        <GraffitiPiece p={{ text: 'ICON', x: w * 0.27, y: h * 0.5, size: 60, fill: C.pink, rot: -5 }} />
        <GraffitiPiece p={{ text: tags[1] ?? 'PULSE', x: w * 0.32, y: h * 0.62, size: 34, fill: C.yellow, rot: 4 }} />
      </G>
      <Mist w={w} h={h} n={24} seed={132} colors={bulbs} />
      <Finish w={w} h={h} id="M" />
    </>
  );
}

// ---------- City Myth: billboard square ----------

function BillboardSquare({ w, h, tags }: SceneProps) {
  const street = h * 0.86;
  const boards: { x: number; y: number; bw: number; bh: number; color: string; text: string }[] = [
    { x: w * 0.04, y: h * 0.1, bw: w * 0.4, bh: h * 0.14, color: C.pink, text: 'MYTH' },
    { x: w * 0.52, y: h * 0.06, bw: w * 0.44, bh: h * 0.1, color: C.cyan, text: tags[1] ?? 'PULSE' },
    { x: w * 0.56, y: h * 0.22, bw: w * 0.38, bh: h * 0.16, color: C.yellow, text: '24/7' },
    { x: w * 0.04, y: h * 0.3, bw: w * 0.3, bh: h * 0.2, color: C.lime, text: 'GO' },
    { x: w * 0.38, y: h * 0.44, bw: w * 0.3, bh: h * 0.1, color: C.violet, text: tags[0] ?? 'NYC' },
  ];
  return (
    <>
      <Rect width={w} height={h} fill="#08060F" />
      <Skyline w={w} top={0} bottom={street} seed={141} color="#120E1E" lit="#9CC8FF" />
      {boards.map((b, i) => (
        <G key={i}>
          <Glow cx={b.x + b.bw / 2} cy={b.y + b.bh / 2} r={b.bw * 0.8} color={b.color} id={`bbN${i}`} strength={0.35} />
          <Rect x={b.x} y={b.y} width={b.bw} height={b.bh} fill={b.color} opacity={0.3} stroke={b.color} strokeWidth={3} />
          <SvgText x={b.x + b.bw / 2} y={b.y + b.bh / 2 + Math.min(b.bh * 0.25, 18)} fontSize={Math.min(b.bh * 0.55, 46)} fontFamily={Display.comic} fill="#fff" fillOpacity={0.75} textAnchor="middle">
            {b.text}
          </SvgText>
        </G>
      ))}
      {/* ticker strip */}
      <Rect y={h * 0.6} width={w} height={26} fill="#0B0C0D" />
      <SvgText x={8} y={h * 0.6 + 19} fontSize={15} fontFamily={Display.block} fill={C.orange} letterSpacing={2} opacity={0.85}>
        ★ STREAK CITY ★ NEW RECORD ★ CITY MYTH SPOTTED ★
      </SvgText>
      {/* crowd silhouettes */}
      {Array.from({ length: 14 }, (_, i) => {
        const x = (i + 0.5) * (w / 14);
        const s = 10 + ((i * 7) % 5) * 2;
        return (
          <G key={i} fill="#05040A">
            <Circle cx={x} cy={street - s * 3.2} r={s * 0.7} />
            <Rect x={x - s * 0.8} y={street - s * 2.5} width={s * 1.6} height={s * 2.5} rx={s * 0.5} />
          </G>
        );
      })}
      <Rect y={street} width={w} height={h - street} fill="#141218" />
      <Rect y={street + 20} width={w} height={4} fill={C.yellow} opacity={0.4} />
      <Mist w={w} h={h} n={26} seed={142} colors={[C.pink, C.cyan, C.yellow, C.lime]} />
      <Finish w={w} h={h} id="N" />
    </>
  );
}

// ---------- Pulse Immortal: pulse tower ----------

function PulseTower({ w, h, tags }: SceneProps) {
  const gold = '#E8B830';
  const r = rng(151);
  const ground = h * 0.82;
  const tx = w / 2;
  const tw = w * 0.16;
  const beat = `M0 ${h * 0.3} L${w * 0.3} ${h * 0.3} L${w * 0.36} ${h * 0.24} L${w * 0.42} ${h * 0.38} L${w * 0.48} ${h * 0.16} L${w * 0.54} ${h * 0.34} L${w * 0.6} ${h * 0.3} L${w} ${h * 0.3}`;
  return (
    <>
      <Defs>
        <SvgLinearGradient id="skyO" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#120A1E" />
          <Stop offset="0.55" stopColor="#4A2A20" />
          <Stop offset="1" stopColor="#8A5A1A" />
        </SvgLinearGradient>
        <SvgLinearGradient id="towerO" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#5A4210" />
          <Stop offset="0.5" stopColor={gold} />
          <Stop offset="1" stopColor="#5A4210" />
        </SvgLinearGradient>
      </Defs>
      <Rect width={w} height={h} fill="url(#skyO)" />
      {Array.from({ length: 36 }, (_, i) => (
        <Circle key={i} cx={r() * w} cy={r() * h * 0.45} r={0.6 + r() * 1.4} fill="#FFF1C2" opacity={0.3 + r() * 0.6} />
      ))}
      <Glow cx={tx} cy={h * 0.2} r={w * 0.8} color={gold} id="haloO" strength={0.45} />
      <Skyline w={w} top={h * 0.45} bottom={ground} seed={152} color="#1A1008" lit={gold} />
      {/* the tower */}
      <Polygon points={`${tx - tw / 2},${ground} ${tx - tw / 4},${h * 0.2} ${tx + tw / 4},${h * 0.2} ${tx + tw / 2},${ground}`} fill="url(#towerO)" stroke="#0B0C0D" strokeWidth={4} />
      <Line x1={tx} y1={h * 0.2} x2={tx} y2={h * 0.08} stroke="#0B0C0D" strokeWidth={5} />
      <Circle cx={tx} cy={h * 0.08} r={6} fill="#FFF1C2" />
      {Array.from({ length: 10 }, (_, i) => (
        <Line key={i} x1={tx - tw / 4 - (tw / 4) * (i / 10)} x2={tx + tw / 4 + (tw / 4) * (i / 10)} y1={h * 0.24 + i * ((ground - h * 0.24) / 10)} y2={h * 0.24 + i * ((ground - h * 0.24) / 10)} stroke="#0B0C0D" strokeOpacity={0.35} strokeWidth={2} />
      ))}
      {/* heartbeat across the sky */}
      <G opacity={0.75}>
        <NeonTube d={beat} color={gold} />
      </G>
      <Rect y={ground} width={w} height={h - ground} fill="#140C06" />
      <G opacity={0.6}>
        <GraffitiPiece p={{ text: 'IMMORTAL', x: w * 0.04, y: ground + 56, size: 48, fill: gold, rot: -4 }} />
        <GraffitiPiece p={{ text: tags[1] ?? 'PULSE', x: w * 0.5, y: ground + 100, size: 36, fill: C.pink, rot: 4 }} />
      </G>
      <Mist w={w} h={h} n={30} seed={153} colors={[gold, '#FFF1C2', C.pink]} />
      <Finish w={w} h={h} id="O" />
    </>
  );
}

// Index = RANKS[i].scene: one wall per rank, in rank order.
const SCENES = [BackAlley, HandballCourt, NightStreet, BodegaCorner, BasketballCourt, Rooftop, SubwayStation, SubwayTunnel, TrainYard, BridgeUnderpass, NeonClub, BlockParty, BillboardSquare, HallOfFame, PulseTower];
const BASE: readonly (readonly [string, string])[] = [
  ['#2A2622', '#141210'],
  ['#3A3E44', '#1A1C20'],
  ['#1A1426', '#0E0B12'],
  ['#2A1A14', '#120B08'],
  ['#1C2430', '#0A0E14'],
  ['#14122A', '#0B0A14'],
  ['#4A4F4C', '#2A2D2C'],
  ['#141414', '#060606'],
  ['#1B1E28', '#0A0D16'],
  ['#16202A', '#080C10'],
  ['#25103A', '#0B0614'],
  ['#2A1430', '#0E0612'],
  ['#1A1030', '#08060F'],
  ['#3A342A', '#1A1610'],
  ['#3A2A10', '#120C04'],
];

/** The wall this player sees: the one they picked, if they've unlocked it, else their current rank's. */
export function useWallLevel() {
  const entries = useStore((s) => s.entries);
  const claims = useStore((s) => s.game.claims);
  const picked = useStore((s) => s.game.wall);
  const frozen = useStore((s) => s.game.frozenDays);
  const level = useMemo(() => crewRank(entries, questXp(claims), frozen).level, [entries, claims, frozen]);
  return { level, wall: picked && picked <= level ? picked : level };
}

/**
 * Draws one rank's scene. The scene is always laid out at screen size, then scaled to fill the given box,
 * so thumbnails on the ranks screen look like a cropped view of the real wall rather than a squashed one.
 */
export function RankScene({ level, width, height, tags = ['NYC', 'PULSE'], station = 'PULSE ST' }: { level: number; width: number; height: number; tags?: string[]; station?: string }) {
  const screen = useWindowDimensions();
  // Several ranks share a wall; each rank names the scene it unlocks.
  const i = RANKS[Math.max(1, Math.min(level, RANKS.length)) - 1].scene;
  const Scene = SCENES[i];
  return (
    <View style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]} pointerEvents="none">
      <LinearGradient colors={BASE[i]} style={StyleSheet.absoluteFill} />
      <Svg width={width} height={height} viewBox={`0 0 ${screen.width} ${screen.height}`} preserveAspectRatio="xMidYMid slice" style={StyleSheet.absoluteFill}>
        <Scene w={screen.width} h={screen.height} tags={tags} station={station} />
      </Svg>
    </View>
  );
}

/** Full-screen backdrop behind every screen, themed to the player's rank. */
export function Backdrop({ tags = ['NYC', 'PULSE'], station = 'PULSE ST', children }: { tags?: string[]; station?: string; children?: ReactNode }) {
  const { width, height } = useWindowDimensions();
  const { wall } = useWallLevel();
  return (
    <>
      <RankScene level={wall} width={width} height={height} tags={tags} station={station} />
      {children}
    </>
  );
}
