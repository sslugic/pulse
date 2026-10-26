'use dom';

import { useEffect, useRef } from 'react';

// Gang Wars, level 1: a Double Dragon style side-scrolling brawler in a subway station, drawn as
// chunky pixel art on a 320 x 180 canvas. You start alone; fighters join your gang as you clear the
// platform. Pick up bats, spray cans, trash cans and protein shakes. Trains roll through behind you.
// The boss steps off the last train. You have 5 minutes. How hard you hit and how much you can take
// come from the XP earned in Pulse (power, passed in from the app).

export interface GangResult {
  won: boolean;
  seconds: number;
  kos: number;
  gang: number;
}

interface Props {
  /** XP earned in Pulse: sets health and damage. */
  xp: number;
  /** Safe-area insets of the screen, so the exit button clears the notch. */
  insets: { top: number; bottom: number };
  /** Labels in the player's language. */
  text: Record<'start' | 'tapToStart' | 'go' | 'joins' | 'boss' | 'clear' | 'over' | 'timeUp' | 'again' | 'exit' | 'power' | 'controls', string>;
  onEnd: (result: GangResult) => Promise<void>;
  onExit: () => Promise<void>;
  dom?: import('expo/dom').DOMProps;
}

// A slightly narrow view (bigger pixels on a phone) with a deep floor to move around on.
const W = 272;
const H = 200;
const FLOOR_TOP = 112;
const FLOOR_BOTTOM = 190;
const LEVEL_END = 2240;
const TIME_LIMIT = 300;

type Kind = 'hero' | 'ally' | 'thug' | 'punk' | 'boss';
type ItemKind = 'bat' | 'spray' | 'can' | 'shake';
type Act = 'idle' | 'walk' | 'punch' | 'kick' | 'hurt' | 'down' | 'jump' | 'throw' | 'spray' | 'swing';

interface Look {
  skin: string;
  hair: string;
  top: string;
  pants: string;
  shoes: string;
  band?: string;
  mohawk?: boolean;
  bald?: boolean;
}

interface Fighter {
  id: number;
  kind: Kind;
  name?: string;
  look: Look;
  x: number;
  y: number;
  z: number; // height above the floor (jumps)
  vz: number;
  face: 1 | -1;
  hp: number;
  max: number;
  act: Act;
  t: number; // time left in the current action
  hits: number; // hits taken in a row (3 knocks down)
  cool: number; // attack cooldown
  speed: number;
  dmg: number;
  scale: number;
  holding?: { kind: ItemKind; uses: number };
  dead?: boolean;
  fade?: number;
  hitDone?: boolean;
  think?: number;
  /** Can't be hit again for a moment after being hit. */
  safe?: number;
}

interface Item {
  kind: ItemKind;
  x: number;
  y: number;
  z: number;
  vx: number;
  flying?: boolean;
  owner?: number;
  taken?: boolean;
}

interface Wave {
  at: number; // camera stops here until it's cleared
  enemies: { kind: Kind; dx: number; dy: number }[];
  items?: { kind: ItemKind; dx: number; dy: number }[];
  ally?: { name: string; look: Look };
  boss?: boolean;
}

const HERO: Look = { skin: '#E8B48A', hair: '#3A2A1E', top: '#F2F2F2', pants: '#2F5FB3', shoes: '#1A1A1A', band: '#FF3B5C' };
const THUGS: Look[] = [
  { skin: '#C98E68', hair: '#111111', top: '#7A3FC9', pants: '#2B2B33', shoes: '#111111' },
  { skin: '#8D5B3E', hair: '#111111', top: '#2FA35A', pants: '#3A3A44', shoes: '#222222' },
  { skin: '#F0C9A5', hair: '#C9A227', top: '#C93F3F', pants: '#22334F', shoes: '#111111' },
];
const PUNK: Look = { skin: '#E8C0A0', hair: '#9CFF2E', top: '#1E1E1E', pants: '#3A1E4F', shoes: '#111111', mohawk: true };
const BOSS: Look = { skin: '#B07850', hair: '#000000', top: '#5A2A10', pants: '#1E1E28', shoes: '#000000', bald: true };
const RAY: Look = { skin: '#7A4A2E', hair: '#111111', top: '#38D6FF', pants: '#1E2A3A', shoes: '#F2F2F2', band: '#38D6FF' };
const LOLA: Look = { skin: '#D9A07A', hair: '#2A1A12', top: '#FF4FA0', pants: '#1E1E2A', shoes: '#FF4FA0', band: '#FFD23F' };

const WAVES: Wave[] = [
  { at: 0, enemies: [{ kind: 'thug', dx: 260, dy: 20 }, { kind: 'thug', dx: 300, dy: 50 }], items: [{ kind: 'shake', dx: 120, dy: 50 }] },
  { at: 420, enemies: [{ kind: 'thug', dx: 280, dy: 10 }, { kind: 'thug', dx: -40, dy: 40 }, { kind: 'punk', dx: 320, dy: 45 }], items: [{ kind: 'bat', dx: 160, dy: 30 }], ally: { name: 'RAY', look: RAY } },
  { at: 860, enemies: [{ kind: 'punk', dx: 280, dy: 15 }, { kind: 'thug', dx: 320, dy: 50 }, { kind: 'thug', dx: -40, dy: 30 }, { kind: 'thug', dx: 340, dy: 30 }], items: [{ kind: 'spray', dx: 150, dy: 20 }, { kind: 'can', dx: 210, dy: 52 }] },
  { at: 1320, enemies: [{ kind: 'punk', dx: 280, dy: 10 }, { kind: 'punk', dx: -40, dy: 50 }, { kind: 'thug', dx: 320, dy: 30 }, { kind: 'thug', dx: 360, dy: 45 }], items: [{ kind: 'shake', dx: 140, dy: 40 }, { kind: 'can', dx: 230, dy: 20 }], ally: { name: 'LOLA', look: LOLA } },
  { at: LEVEL_END - W, boss: true, enemies: [{ kind: 'boss', dx: 250, dy: 30 }, { kind: 'thug', dx: 290, dy: 10 }, { kind: 'punk', dx: -30, dy: 45 }], items: [{ kind: 'bat', dx: 100, dy: 50 }, { kind: 'shake', dx: 60, dy: 15 }] },
];

const STATS: Record<Kind, { hp: number; dmg: number; speed: number; scale: number }> = {
  hero: { hp: 100, dmg: 8, speed: 62, scale: 1 },
  ally: { hp: 80, dmg: 7, speed: 56, scale: 1 },
  thug: { hp: 34, dmg: 3, speed: 34, scale: 1 },
  punk: { hp: 50, dmg: 4, speed: 42, scale: 1 },
  boss: { hp: 900, dmg: 9, speed: 30, scale: 1.45 },
};

export default function GangWarsGame({ xp, insets, text, onEnd, onExit }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const pad = useRef<HTMLDivElement>(null);
  // The app may hand over new callback and label objects on any render; the game keeps running.
  const endRef = useRef(onEnd);
  const textRef = useRef(text);
  useEffect(() => {
    endRef.current = onEnd;
    textRef.current = text;
  });

  useEffect(() => {
    const cv = canvas.current!;
    const ctx = cv.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    const text = textRef.current;

    // ---------- Power from XP ----------
    const power = Math.min(1, xp / 12000); // 0 to 1
    const heroHp = Math.round(100 + 150 * power);
    const heroDmg = 1 + 1.4 * power;

    // ---------- Sound (tiny synth) ----------
    let audio: AudioContext | null = null;
    const beep = (freq: number, dur: number, type: OscillatorType = 'square', vol = 0.08, noise = false) => {
      try {
        audio = audio ?? new AudioContext();
        const g = audio.createGain();
        g.gain.setValueAtTime(vol, audio.currentTime);
        g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + dur);
        g.connect(audio.destination);
        if (noise) {
          const buf = audio.createBuffer(1, Math.floor(audio.sampleRate * dur), audio.sampleRate);
          const d = buf.getChannelData(0);
          for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
          const src = audio.createBufferSource();
          src.buffer = buf;
          src.connect(g);
          src.start();
        } else {
          const o = audio.createOscillator();
          o.type = type;
          o.frequency.setValueAtTime(freq, audio.currentTime);
          o.frequency.exponentialRampToValueAtTime(Math.max(40, freq / 3), audio.currentTime + dur);
          o.connect(g);
          o.start();
          o.stop(audio.currentTime + dur);
        }
      } catch {
        // no audio: play silently
      }
    };
    const sfx = {
      hit: () => (beep(0, 0.09, 'square', 0.12, true), beep(160, 0.08)),
      whiff: () => beep(500, 0.05, 'triangle', 0.03),
      down: () => beep(90, 0.25, 'sawtooth', 0.1),
      pick: () => beep(880, 0.1, 'square', 0.05),
      heal: () => (beep(520, 0.1), setTimeout(() => beep(780, 0.15), 90)),
      join: () => [440, 554, 659, 880].forEach((f, i) => setTimeout(() => beep(f, 0.12), i * 90)),
      train: () => beep(0, 1.6, 'square', 0.05, true),
      spray: () => beep(0, 0.3, 'square', 0.05, true),
    };

    // ---------- State ----------
    let nextId = 1;
    const make = (kind: Kind, look: Look, x: number, y: number, name?: string): Fighter => {
      const s = STATS[kind];
      const max = kind === 'hero' ? heroHp : s.hp;
      return { id: nextId++, kind, name, look, x, y, z: 0, vz: 0, face: kind === 'hero' || kind === 'ally' ? 1 : -1, hp: max, max, act: 'idle', t: 0, hits: 0, cool: 0, speed: s.speed, dmg: s.dmg, scale: s.scale };
    };

    let hero: Fighter;
    let fighters: Fighter[];
    let items: Item[];
    let cam: number;
    let wave: number;
    let waveLive: boolean;
    let time: number;
    let kos: number;
    let phase: 'title' | 'play' | 'won' | 'lost';
    let banner: { text: string; t: number } | null;
    let train: { x: number; t: number; dir: 1 | -1 } | null;
    let trainTimer: number;
    let clouds: { x: number; y: number; t: number; face: number }[];
    let shakeT: number;
    let reported: boolean;

    const reset = () => {
      nextId = 1;
      hero = make('hero', HERO, 60, 140);
      fighters = [hero];
      items = [];
      cam = 0;
      wave = 0;
      waveLive = false;
      time = TIME_LIMIT;
      kos = 0;
      banner = null;
      train = null;
      trainTimer = 6;
      clouds = [];
      shakeT = 0;
      reported = false;
    };
    reset();
    phase = 'title';

    const startWave = (i: number) => {
      const w = WAVES[i];
      waveLive = true;
      for (const e of w.enemies) {
        const look = e.kind === 'boss' ? BOSS : e.kind === 'punk' ? PUNK : THUGS[(nextId + i) % THUGS.length];
        const f = make(e.kind, look, w.at + e.dx, FLOOR_TOP + e.dy);
        if (e.kind !== 'boss') {
          f.max = f.hp = Math.round(f.hp * (1 + i * 0.12));
          f.dmg = Math.round(f.dmg * (1 + i * 0.1));
        }
        fighters.push(f);
      }
      for (const it of w.items ?? []) items.push({ kind: it.kind, x: w.at + it.dx, y: FLOOR_TOP + it.dy, z: 0, vx: 0 });
      if (w.boss) {
        banner = { text: text.boss, t: 2.5 };
        train = { x: cam + W + 40, t: 0, dir: -1 };
        sfx.train();
      }
    };

    // ---------- Input ----------
    const keys = { up: false, down: false, left: false, right: false, punch: false, kick: false, jump: false, grab: false };
    const pressed = { punch: false, kick: false, jump: false, grab: false };
    const press = (k: keyof typeof keys, on: boolean) => {
      if (on && !keys[k] && k in pressed) pressed[k as keyof typeof pressed] = true;
      keys[k] = on;
    };

    const touches = new Map<number, string>();
    const padEl = pad.current!;
    const route = (target: EventTarget | null): string | null => {
      const el = target as HTMLElement | null;
      return el?.closest?.('[data-k]')?.getAttribute('data-k') ?? null;
    };
    const stickEl = padEl.querySelector('[data-stick]') as HTMLElement;
    const stick = (x: number, y: number) => {
      const r = stickEl.getBoundingClientRect();
      const dx = x - (r.left + r.width / 2);
      const dy = y - (r.top + r.height / 2);
      const dead = r.width * 0.14;
      keys.left = dx < -dead;
      keys.right = dx > dead;
      keys.up = dy < -dead;
      keys.down = dy > dead;
    };
    const onStart = (e: TouchEvent) => {
      e.preventDefault();
      if (phase !== 'play') return tapScreen();
      for (const t of Array.from(e.changedTouches)) {
        const k = route(t.target);
        if (!k) continue;
        touches.set(t.identifier, k);
        if (k === 'stick') stick(t.clientX, t.clientY);
        else press(k as keyof typeof keys, true);
      }
    };
    const onMove = (e: TouchEvent) => {
      e.preventDefault();
      for (const t of Array.from(e.changedTouches)) if (touches.get(t.identifier) === 'stick') stick(t.clientX, t.clientY);
    };
    const onEndTouch = (e: TouchEvent) => {
      e.preventDefault();
      for (const t of Array.from(e.changedTouches)) {
        const k = touches.get(t.identifier);
        touches.delete(t.identifier);
        if (k === 'stick') keys.left = keys.right = keys.up = keys.down = false;
        else if (k) press(k as keyof typeof keys, false);
      }
    };
    padEl.addEventListener('touchstart', onStart, { passive: false });
    padEl.addEventListener('touchmove', onMove, { passive: false });
    padEl.addEventListener('touchend', onEndTouch, { passive: false });
    padEl.addEventListener('touchcancel', onEndTouch, { passive: false });
    const tapCanvas = (e: Event) => {
      e.preventDefault();
      tapScreen();
    };
    cv.addEventListener('touchstart', tapCanvas, { passive: false });
    cv.addEventListener('click', tapCanvas);

    const KEYMAP: Record<string, keyof typeof keys> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', z: 'punch', x: 'kick', c: 'jump', v: 'grab' };
    const onKey = (e: KeyboardEvent) => {
      const k = KEYMAP[e.key];
      if (!k) return;
      if (e.type === 'keydown' && phase !== 'play') tapScreen();
      press(k, e.type === 'keydown');
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKey);

    function tapScreen() {
      if (phase === 'title') {
        phase = 'play';
        startWave(0);
        banner = { text: text.start, t: 2 };
      } else if (phase === 'won' || phase === 'lost') {
        reset();
        phase = 'play';
        startWave(0);
      }
    }

    // ---------- Combat ----------
    const enemiesOf = (f: Fighter) => fighters.filter((o) => !o.dead && o.act !== 'down' && (f.kind === 'hero' || f.kind === 'ally' ? o.kind === 'thug' || o.kind === 'punk' || o.kind === 'boss' : o.kind === 'hero' || o.kind === 'ally'));

    const hurt = (target: Fighter, dmg: number, from: Fighter, knock = false) => {
      if (target.dead || target.act === 'down' || (target.safe ?? 0) > 0) return;
      // The hero and the gang get a short breather after each hit, so a crowd can't juggle them.
      if (target.kind === 'hero' || target.kind === 'ally') target.safe = 0.45;
      target.hp -= dmg;
      target.hits++;
      target.face = from.x < target.x ? -1 : 1;
      sfx.hit();
      if (target.kind === 'boss' || target.kind === 'hero') shakeT = 0.12;
      const knocked = knock || target.hp <= 0 || target.hits >= (target.kind === 'boss' ? 5 : 3);
      if (knocked) {
        target.act = 'down';
        target.t = target.hp <= 0 ? 1.4 : 1.1;
        target.hits = 0;
        target.vz = 70;
        target.z = 1;
        sfx.down();
        if (target.holding && target.holding.kind !== 'bat') target.holding = undefined;
      } else {
        target.act = 'hurt';
        target.t = 0.28;
      }
      target.x += from.x < target.x ? 6 : -6;
    };

    const strike = (f: Fighter, reach: number, dmg: number, knock = false) => {
      let landed = false;
      for (const o of enemiesOf(f)) {
        const dx = (o.x - f.x) * f.face;
        if (dx > -4 && dx < reach * f.scale + 6 * o.scale && Math.abs(o.y - f.y) < 10 + 4 * o.scale && Math.abs(o.z - f.z) < 20) {
          hurt(o, dmg, f, knock);
          landed = true;
        }
      }
      if (!landed) sfx.whiff();
      return landed;
    };

    const attack = (f: Fighter, kind: 'punch' | 'kick') => {
      if (f.cool > 0 || f.act === 'hurt' || f.act === 'down') return;
      const mult = f.kind === 'hero' ? heroDmg : 1;
      if (kind === 'punch' && f.holding?.kind === 'bat') {
        f.act = 'swing';
        f.t = 0.32;
        f.cool = 0.42;
        f.hitDone = false;
        return;
      }
      if (kind === 'punch' && f.holding?.kind === 'spray') {
        f.act = 'spray';
        f.t = 0.4;
        f.cool = 0.6;
        clouds.push({ x: f.x + f.face * 20, y: f.y, t: 0.6, face: f.face });
        sfx.spray();
        for (const o of enemiesOf(f)) {
          const dx = (o.x - f.x) * f.face;
          if (dx > 0 && dx < 46 && Math.abs(o.y - f.y) < 16) {
            o.act = 'hurt';
            o.t = 2.2; // coughing, can't fight back
            o.hp -= 4 * mult;
          }
        }
        f.holding.uses--;
        if (f.holding.uses <= 0) f.holding = undefined;
        return;
      }
      f.act = f.z > 0 ? 'kick' : kind;
      f.t = kind === 'kick' ? 0.3 : 0.2;
      f.cool = kind === 'kick' ? 0.42 : 0.26;
      f.hitDone = false;
    };

    const grab = (f: Fighter) => {
      if (f.act === 'hurt' || f.act === 'down') return;
      if (f.holding && (f.holding.kind === 'can')) {
        // Throw it.
        items.push({ kind: 'can', x: f.x + f.face * 10, y: f.y, z: 18, vx: f.face * 190, flying: true, owner: f.id });
        f.holding = undefined;
        f.act = 'throw';
        f.t = 0.25;
        return;
      }
      if (f.holding) {
        // Drop what you're holding.
        items.push({ kind: f.holding.kind, x: f.x + f.face * 8, y: f.y, z: 0, vx: 0 });
        f.holding = undefined;
        return;
      }
      const it = items.find((i) => !i.taken && !i.flying && Math.abs(i.x - f.x) < 18 && Math.abs(i.y - f.y) < 12);
      if (!it) return;
      it.taken = true;
      items = items.filter((i) => i !== it);
      if (it.kind === 'shake') {
        f.hp = Math.min(f.max, f.hp + 40);
        sfx.heal();
        return;
      }
      f.holding = { kind: it.kind, uses: it.kind === 'bat' ? 14 : it.kind === 'spray' ? 6 : 1 };
      sfx.pick();
    };

    // ---------- AI ----------
    const brain = (f: Fighter, dt: number) => {
      const foes = enemiesOf(f);
      let target: Fighter | undefined;
      let best = Infinity;
      for (const o of foes) {
        const d = Math.abs(o.x - f.x) + Math.abs(o.y - f.y) * 2;
        if (d < best) {
          best = d;
          target = o;
        }
      }
      if (!target) {
        // Allies follow the hero when there's nobody to fight.
        if (f.kind === 'ally') {
          const tx = hero.x - 30 * hero.face + (f.id % 2 ? 0 : -18);
          const ty = hero.y + (f.id % 2 ? 14 : -14);
          moveTo(f, tx, ty, dt, 6);
        } else f.act = 'idle';
        return;
      }
      f.think = (f.think ?? 0) - dt;
      const dx = target.x - f.x;
      const dy = target.y - f.y;
      const reach = 22 * f.scale;
      if (Math.abs(dx) > reach || Math.abs(dy) > 6) {
        // Line up beside the target, not on top of it.
        const tx = target.x - Math.sign(dx || 1) * reach * 0.8;
        moveTo(f, tx, target.y, dt, 3);
        return;
      }
      f.face = dx >= 0 ? 1 : -1;
      if (f.cool <= 0 && (f.think ?? 0) <= 0) {
        attack(f, f.kind === 'boss' || Math.random() < 0.35 ? 'kick' : 'punch');
        f.cool += f.kind === 'ally' ? 0.25 : f.kind === 'boss' ? 0.7 : 1.1 + Math.random() * 0.8;
        f.think = f.kind === 'ally' ? 0.1 : 0.3 + Math.random() * 0.5;
      } else f.act = 'idle';
    };

    const moveTo = (f: Fighter, tx: number, ty: number, dt: number, near: number) => {
      const dx = tx - f.x;
      const dy = ty - f.y;
      if (Math.abs(dx) < near && Math.abs(dy) < near) {
        f.act = 'idle';
        return;
      }
      const len = Math.hypot(dx, dy * 1.6) || 1;
      f.x += (dx / len) * f.speed * dt;
      f.y += ((dy * 1.6) / len) * f.speed * 0.6 * dt;
      if (Math.abs(dx) > 2) f.face = dx > 0 ? 1 : -1;
      f.act = 'walk';
    };

    // ---------- Update ----------
    const update = (dt: number) => {
      if (banner) {
        banner.t -= dt;
        if (banner.t <= 0) banner = null;
      }
      shakeT = Math.max(0, shakeT - dt);
      // Trains roll through the station now and then.
      trainTimer -= dt;
      if (!train && trainTimer <= 0) {
        train = { x: Math.random() < 0.5 ? cam - 520 : cam + W + 40, t: 0, dir: Math.random() < 0.5 ? 1 : -1 };
        train.x = train.dir === 1 ? cam - 520 : cam + W + 40;
        trainTimer = 14 + Math.random() * 10;
        sfx.train();
      }
      if (train) {
        train.t += dt;
        train.x += train.dir * 260 * dt;
        if (train.t > 4) train = null;
      }
      if (phase !== 'play') return;

      time -= dt;
      if (time <= 0) {
        time = 0;
        lose(text.timeUp);
        return;
      }

      // Hero controls.
      if (hero.act !== 'hurt' && hero.act !== 'down') {
        const busy = hero.t > 0 && hero.act !== 'walk' && hero.act !== 'jump';
        if (!busy) {
          let mx = 0;
          let my = 0;
          if (keys.left) mx -= 1;
          if (keys.right) mx += 1;
          if (keys.up) my -= 1;
          if (keys.down) my += 1;
          hero.x += mx * hero.speed * dt;
          hero.y += my * hero.speed * 0.6 * dt;
          if (mx) hero.face = mx > 0 ? 1 : -1;
          if (hero.z === 0) hero.act = mx || my ? 'walk' : 'idle';
        }
        if (pressed.jump && hero.z === 0) {
          hero.vz = 150;
          hero.z = 1;
          hero.act = 'jump';
        }
        if (pressed.punch) attack(hero, 'punch');
        if (pressed.kick) attack(hero, 'kick');
        if (pressed.grab) grab(hero);
      }
      pressed.punch = pressed.kick = pressed.jump = pressed.grab = false;

      for (const f of fighters) {
        if (f.dead) continue;
        f.cool = Math.max(0, f.cool - dt);
        if (f.safe) f.safe = Math.max(0, f.safe - dt);
        // Jumps and knock-downs.
        if (f.z > 0 || f.vz > 0) {
          f.z += f.vz * dt;
          f.vz -= 420 * dt;
          if (f.z <= 0) {
            f.z = 0;
            f.vz = 0;
            if (f.act === 'jump' || f.act === 'kick') f.act = 'idle';
          }
        }
        if (f.t > 0) {
          f.t -= dt;
          // The hit lands partway through the move.
          if (!f.hitDone && (f.act === 'punch' || f.act === 'kick' || f.act === 'swing') && f.t < (f.act === 'kick' ? 0.2 : 0.12)) {
            f.hitDone = true;
            const mult = f.kind === 'hero' ? heroDmg : 1;
            if (f.act === 'swing') {
              if (strike(f, 34, Math.round(16 * mult), Math.random() < 0.4) && f.holding) {
                f.holding.uses--;
                if (f.holding.uses <= 0) f.holding = undefined;
              }
            } else strike(f, f.act === 'kick' ? 26 : 20, Math.round((f.act === 'kick' ? f.dmg * 1.4 : f.dmg) * mult), f.act === 'kick' && f.z > 0);
          }
          if (f.t <= 0) {
            if (f.act === 'down') {
              if (f.hp <= 0) {
                if (f.kind === 'hero') return lose(text.over);
                if (f.kind === 'ally') {
                  // Gang members get back up after a breather.
                  f.hp = Math.round(f.max * 0.5);
                  f.act = 'idle';
                } else {
                  f.dead = true;
                  f.fade = 0.8;
                  kos++;
                }
              } else f.act = 'idle';
            } else if (f.act !== 'walk') f.act = 'idle';
          }
        } else if (f.kind !== 'hero' && f.act !== 'down') brain(f, dt);
        f.y = Math.max(FLOOR_TOP, Math.min(FLOOR_BOTTOM, f.y));
        const minX = cam + 8;
        const maxX = waveLive ? cam + W - 8 : LEVEL_END - 8;
        if (f.kind === 'hero' || f.kind === 'ally') f.x = Math.max(minX, Math.min(maxX, f.x));
      }
      for (const f of fighters) if (f.fade != null) f.fade -= dt;
      fighters = fighters.filter((f) => !f.dead || (f.fade ?? 0) > 0);

      // Thrown things.
      for (const it of items) {
        if (!it.flying) continue;
        it.x += it.vx * dt;
        it.z = Math.max(0, it.z - 30 * dt);
        const thrower = fighters.find((f) => f.id === it.owner) ?? hero;
        for (const o of enemiesOf(thrower)) {
          if (Math.abs(o.x - it.x) < 12 && Math.abs(o.y - it.y) < 12) {
            hurt(o, Math.round(26 * (thrower.kind === 'hero' ? heroDmg : 1)), thrower, true);
            it.flying = false;
            it.vx = 0;
            it.taken = true;
          }
        }
        if (Math.abs(it.x - thrower.x) > 220) it.flying = false;
      }
      items = items.filter((i) => !i.taken);
      clouds = clouds.filter((c) => (c.t -= dt) > 0);

      // Camera and waves.
      if (waveLive) {
        const left = fighters.filter((f) => !f.dead && (f.kind === 'thug' || f.kind === 'punk' || f.kind === 'boss'));
        if (!left.length) {
          waveLive = false;
          const w = WAVES[wave];
          if (w.boss) return win();
          if (w.ally) {
            const a = make('ally', w.ally.look, cam - 20, hero.y + 10, w.ally.name);
            fighters.push(a);
            banner = { text: `${w.ally.name} ${text.joins}`, t: 2.4 };
            sfx.join();
          } else banner = { text: text.go, t: 1.6 };
          wave++;
        }
      } else {
        const target = Math.min(hero.x - 120, LEVEL_END - W);
        if (target > cam) cam = Math.min(target, cam + 120 * dt);
        if (wave < WAVES.length && cam >= WAVES[wave].at) {
          cam = WAVES[wave].at;
          startWave(wave);
        }
      }
    };

    const win = () => {
      phase = 'won';
      banner = null;
      sfx.join();
      report(true);
    };
    const lose = (why: string) => {
      phase = 'lost';
      banner = { text: why, t: 99 };
      report(false);
    };
    const report = (won: boolean) => {
      if (reported) return;
      reported = true;
      endRef.current({ won, seconds: Math.round(TIME_LIMIT - time), kos, gang: fighters.filter((f) => f.kind === 'ally').length }).catch(() => {});
    };

    // ---------- Drawing ----------
    const px = (x: number, y: number, w: number, h: number, c: string) => {
      ctx.fillStyle = c;
      ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
    };

    const TAGS = ['#FF4FA0', '#9CFF2E', '#38D6FF', '#FF9A3D', '#A267FF', '#FFD23F'];
    const drawStation = () => {
      // Ceiling and lights.
      px(0, 0, W, 18, '#140C24');
      for (let x = -((cam * 0.5) % 64); x < W; x += 64) {
        px(x + 20, 14, 24, 3, '#FFF6C8');
        px(x + 16, 17, 32, 4, '#FFF6C833');
      }
      // Back wall with tiles and graffiti.
      px(0, 18, W, 50, '#2A1F3D');
      const off = (cam * 0.6) % 16;
      for (let y = 18; y < 68; y += 8) for (let x = -off - ((y / 8) % 2) * 8; x < W; x += 16) px(x, y, 15, 7, '#33264B');
      for (let i = Math.floor((cam * 0.6) / 90) - 1; i < Math.floor((cam * 0.6 + W) / 90) + 1; i++) {
        const x = i * 90 - cam * 0.6;
        const c = TAGS[Math.abs(i) % TAGS.length];
        const c2 = TAGS[Math.abs(i + 2) % TAGS.length];
        px(x + 10, 30 + (i % 3) * 4, 46, 14, c + '99');
        px(x + 14, 33 + (i % 3) * 4, 10, 8, c2);
        px(x + 28, 32 + (i % 3) * 4, 8, 10, c2);
        px(x + 40, 34 + (i % 3) * 4, 12, 6, c2);
      }
      // Track bed behind the platform edge, and the train.
      px(0, 68, W, 30, '#0D0912');
      px(0, 92, W, 3, '#3A3A44');
      if (train) {
        const tx = train.x - cam * 0.8;
        for (let car = 0; car < 4; car++) {
          const cx = tx + car * 132;
          px(cx, 56, 128, 40, '#9AA3AD');
          px(cx, 56, 128, 4, '#C9D0D6');
          for (let w = 0; w < 5; w++) px(cx + 8 + w * 24, 64, 16, 12, '#FFE7A0');
          px(cx + 4, 80, 120, 6, TAGS[car % TAGS.length]);
          px(cx + 30, 82, 40, 10, TAGS[(car + 2) % TAGS.length] + 'CC');
        }
      }
      // Platform floor.
      px(0, 98, W, 4, '#FFD23F');
      for (let x = -((cam) % 12); x < W; x += 12) px(x, 98, 6, 4, '#1A1A1A');
      px(0, 102, W, H - 102, '#3B3446');
      for (let y = 104; y < H; y += 10) px(0, y, W, 1, '#443C52');
      // Pillars in front of the wall.
      for (let i = Math.floor(cam / 200) - 1; i < Math.floor((cam + W) / 200) + 1; i++) {
        const x = i * 200 + 120 - cam;
        px(x, 18, 18, 86, '#4A4060');
        px(x + 2, 18, 3, 86, '#5E5378');
        px(x, 60, 18, 10, TAGS[Math.abs(i) % TAGS.length] + 'AA');
      }
    };

    const drawFighter = (f: Fighter) => {
      const s = f.scale;
      const x = f.x - cam;
      const y = f.y - f.z;
      const L = f.look;
      const flash = f.act === 'hurt' && Math.floor(f.t * 20) % 2 === 0;
      if (f.fade != null && Math.floor(f.fade * 12) % 2 === 0) return;
      // Shadow.
      ctx.fillStyle = '#00000055';
      ctx.beginPath();
      ctx.ellipse(x, f.y + 1, 9 * s, 3 * s, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.save();
      ctx.translate(Math.round(x), Math.round(y));
      ctx.scale(f.face * s, s);
      const skin = flash ? '#FFFFFF' : L.skin;
      if (f.act === 'down') {
        // Lying on the floor.
        px(-14, -6, 8, 6, skin);
        px(-6, -7, 12, 7, L.top);
        px(6, -6, 10, 5, L.pants);
        px(16, -6, 3, 5, L.shoes);
        ctx.restore();
        return;
      }
      const walk = f.act === 'walk' ? Math.sin(performance.now() / 90 + f.id) : 0;
      const bob = f.act === 'idle' ? Math.round(Math.sin(performance.now() / 300 + f.id)) : 0;
      // Legs.
      const kick = f.act === 'kick';
      px(-5, -12, 4, 10 + (walk > 0 ? 1 : 0), L.pants);
      if (kick) {
        px(0, -13, 12, 4, L.pants);
        px(12, -14, 3, 5, L.shoes);
      } else px(1, -12, 4, 10 + (walk < 0 ? 1 : 0), L.pants);
      px(-6, -2 + (walk > 0 ? 1 : 0), 5, 2, L.shoes);
      if (!kick) px(1, -2 + (walk < 0 ? 1 : 0), 5, 2, L.shoes);
      // Body.
      px(-6, -24 + bob, 12, 13, L.top);
      px(-6, -13 + bob, 12, 2, '#00000033');
      // Arms.
      const punch = f.act === 'punch' || f.act === 'throw' || f.act === 'spray';
      const swing = f.act === 'swing';
      px(-8, -23 + bob, 3, 9, skin);
      if (punch) {
        px(5, -22 + bob, 11, 3, skin);
        px(15, -23 + bob, 3, 4, skin);
      } else px(5, -23 + bob, 3, 9, skin);
      // Held item.
      if (f.holding?.kind === 'bat') {
        if (swing) px(8, -22 + bob, 18, 3, '#C9A06A');
        else px(6, -34 + bob, 3, 18, '#C9A06A');
      }
      if (f.holding?.kind === 'spray') px(7, -18 + bob, 4, 6, '#9CFF2E');
      if (f.holding?.kind === 'can') px(-7, -38 + bob, 14, 12, '#7C8A96');
      // Head.
      px(-4, -33 + bob, 9, 9, skin);
      px(2, -30 + bob, 2, 2, '#111111');
      if (!L.bald) px(-5, -35 + bob, 10, 4, L.hair);
      if (L.mohawk) px(-1, -39 + bob, 3, 5, L.hair);
      if (L.band) px(-5, -32 + bob, 10, 2, L.band);
      ctx.restore();
      // Name tag for gang members.
      if (f.kind === 'ally' && f.name) {
        ctx.fillStyle = L.top;
        ctx.font = '6px monospace';
        ctx.fillText(f.name, x - 8, y - 42 * s);
      }
    };

    const drawItem = (it: Item) => {
      const x = it.x - cam;
      const y = it.y - it.z;
      ctx.fillStyle = '#00000044';
      ctx.fillRect(x - 6, it.y, 12, 2);
      if (it.kind === 'bat') {
        px(x - 9, y - 3, 18, 3, '#C9A06A');
        px(x + 7, y - 4, 3, 5, '#8A6A40');
      }
      if (it.kind === 'spray') {
        px(x - 2, y - 8, 5, 8, '#9CFF2E');
        px(x - 1, y - 10, 3, 2, '#F2F2F2');
      }
      if (it.kind === 'can') {
        px(x - 6, y - 12, 12, 12, '#7C8A96');
        px(x - 6, y - 12, 12, 2, '#C9D0D6');
      }
      if (it.kind === 'shake') {
        px(x - 3, y - 10, 7, 10, '#FF4FA0');
        px(x - 2, y - 13, 5, 3, '#F2F2F2');
        px(x, y - 16, 1, 4, '#FFD23F');
      }
    };

    const bar = (x: number, y: number, w: number, v: number, max: number, c: string) => {
      px(x, y, w + 2, 6, '#000000');
      px(x + 1, y + 1, Math.max(0, (w * v) / max), 4, c);
    };

    const label = (s: string, x: number, y: number, size: number, c: string, align: CanvasTextAlign = 'center') => {
      ctx.font = `bold ${size}px "Courier New", monospace`;
      ctx.textAlign = align;
      ctx.fillStyle = '#000000';
      ctx.fillText(s, x + 1, y + 1);
      ctx.fillStyle = c;
      ctx.fillText(s, x, y);
      ctx.textAlign = 'left';
    };

    const draw = () => {
      ctx.save();
      if (shakeT > 0) ctx.translate(Math.round((Math.random() - 0.5) * 4), Math.round((Math.random() - 0.5) * 3));
      drawStation();
      const things: { y: number; draw: () => void }[] = [];
      for (const it of items) things.push({ y: it.y, draw: () => drawItem(it) });
      for (const f of fighters) things.push({ y: f.y, draw: () => drawFighter(f) });
      things.sort((a, b) => a.y - b.y).forEach((t) => t.draw());
      for (const c of clouds) {
        ctx.fillStyle = `rgba(156,255,46,${c.t})`;
        for (let i = 0; i < 6; i++) ctx.fillRect(c.x - cam + i * 5 * c.face, c.y - 22 + Math.sin(i + c.t * 10) * 4, 7, 7);
      }
      ctx.restore();

      // HUD.
      label('PULSE', 6, 10, 8, '#FFD23F', 'left');
      bar(6, 13, 80, Math.max(0, hero.hp), hero.max, '#9CFF2E');
      const m = Math.floor(time / 60);
      const sec = Math.floor(time % 60);
      label(`${m}:${String(sec).padStart(2, '0')}`, W / 2, 11, 10, time < 30 ? '#FF4141' : '#F2F2F2');
      label(`KO ${kos}`, W - 6, 10, 8, '#38D6FF', 'right');
      const gang = fighters.filter((f) => f.kind === 'ally');
      gang.forEach((a, i) => {
        px(W - 70 + i * 22, 14, 6, 6, a.look.top);
        bar(W - 63 + i * 22, 14, 12, Math.max(0, a.hp), a.max, a.look.top);
      });
      if (hero.holding) label(hero.holding.kind.toUpperCase() + (hero.holding.kind !== 'can' ? ` ${hero.holding.uses}` : ''), 6, 30, 7, '#FFD23F', 'left');
      const boss = fighters.find((f) => f.kind === 'boss' && !f.dead);
      if (boss) {
        label('BOSS', W / 2 - 60, H - 6, 7, '#FF4141', 'left');
        bar(W / 2 - 38, H - 12, 100, Math.max(0, boss.hp), boss.max, '#FF4141');
      }
      if (!waveLive && phase === 'play' && wave < WAVES.length && Math.floor(performance.now() / 300) % 2) label('GO ▶', W - 30, 60, 12, '#FFD23F');
      if (banner) label(banner.text, W / 2, 56, 13, '#FFD23F');

      if (phase === 'title') {
        px(0, 0, W, H, '#000000AA');
        label('GANG WARS', W / 2, 58, 24, '#FF4FA0');
        label('LEVEL 1 · SUBWAY', W / 2, 76, 10, '#38D6FF');
        label(`${text.power} ${Math.round(100 + power * 140)}%`, W / 2, 96, 9, '#9CFF2E');
        label(text.controls, W / 2, 112, 7, '#F2F2F2');
        if (Math.floor(performance.now() / 400) % 2) label(text.tapToStart, W / 2, 140, 10, '#FFD23F');
      }
      if (phase === 'won') {
        px(0, 0, W, H, '#000000AA');
        label(text.clear, W / 2, 70, 20, '#9CFF2E');
        label(`${Math.floor((TIME_LIMIT - time) / 60)}:${String(Math.floor((TIME_LIMIT - time) % 60)).padStart(2, '0')} · KO ${kos}`, W / 2, 90, 10, '#F2F2F2');
        label(text.again, W / 2, 130, 9, '#FFD23F');
      }
      if (phase === 'lost') {
        px(0, 0, W, H, '#000000AA');
        label(banner?.text ?? text.over, W / 2, 74, 18, '#FF4141');
        label(text.again, W / 2, 130, 9, '#FFD23F');
      }
    };

    // ---------- Loop ----------
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      update(dt);
      draw();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      padEl.removeEventListener('touchstart', onStart);
      padEl.removeEventListener('touchmove', onMove);
      padEl.removeEventListener('touchend', onEndTouch);
      padEl.removeEventListener('touchcancel', onEndTouch);
      cv.removeEventListener('touchstart', tapCanvas);
      cv.removeEventListener('click', tapCanvas);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKey);
      audio?.close().catch(() => {});
    };
  }, [xp]);

  return (
    <div style={css.root}>
      <style>{`html,body{margin:0;padding:0;background:#07040E;overscroll-behavior:none;-webkit-user-select:none;user-select:none;touch-action:none}`}</style>
      <div style={{ ...css.top, paddingTop: insets.top + 4 }}>
        <button style={css.exit} onClick={() => onExit()}>
          ✕ {text.exit}
        </button>
      </div>
      <canvas ref={canvas} width={W} height={H} style={css.canvas} />
      <div ref={pad} style={{ ...css.pad, paddingBottom: insets.bottom + 24 }}>
        <div data-k="stick" data-stick style={css.stick}>
          <div style={css.stickDot} />
          <span style={{ ...css.arrow, top: 6, left: '50%', transform: 'translateX(-50%)' }}>▲</span>
          <span style={{ ...css.arrow, bottom: 6, left: '50%', transform: 'translateX(-50%)' }}>▼</span>
          <span style={{ ...css.arrow, left: 8, top: '50%', transform: 'translateY(-50%)' }}>◀</span>
          <span style={{ ...css.arrow, right: 8, top: '50%', transform: 'translateY(-50%)' }}>▶</span>
        </div>
        <div style={css.buttons}>
          <div data-k="grab" style={{ ...css.btn, background: '#38D6FF', gridArea: 'a' }}>GRAB</div>
          <div data-k="jump" style={{ ...css.btn, background: '#FFD23F', gridArea: 'b' }}>JUMP</div>
          <div data-k="kick" style={{ ...css.btn, background: '#FF9A3D', gridArea: 'c' }}>KICK</div>
          <div data-k="punch" style={{ ...css.btn, background: '#FF4FA0', gridArea: 'd' }}>PUNCH</div>
        </div>
      </div>
    </div>
  );
}

const css: Record<string, React.CSSProperties> = {
  root: { position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', background: '#07040E', fontFamily: '"Courier New", monospace', color: '#F2F2F2' },
  top: { display: 'flex', justifyContent: 'flex-end', padding: '8px 10px 4px' },
  exit: { background: '#1D1430', color: '#F2F2F2', border: '2px solid #3A2A55', borderRadius: 10, padding: '6px 12px', fontFamily: 'inherit', fontWeight: 700, fontSize: 13 },
  canvas: { width: '100%', aspectRatio: `${W} / ${H}`, imageRendering: 'pixelated', borderTop: '3px solid #FF4FA0', borderBottom: '3px solid #38D6FF', background: '#000' },
  pad: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px 28px', gap: 12 },
  stick: { position: 'relative', width: 150, height: 150, borderRadius: 75, background: 'radial-gradient(circle,#2A1F3D 0%,#140C24 70%)', border: '3px solid #3A2A55', flexShrink: 0 },
  stickDot: { position: 'absolute', left: '50%', top: '50%', width: 44, height: 44, marginLeft: -22, marginTop: -22, borderRadius: 22, background: '#5E5378', border: '3px solid #8A7AA8', pointerEvents: 'none' },
  arrow: { position: 'absolute', color: '#8A7AA8', fontSize: 14, pointerEvents: 'none' },
  buttons: { display: 'grid', gridTemplateAreas: '". a" "b c" ". d"', gridTemplateColumns: '72px 72px', gridTemplateRows: '56px 56px 56px', gap: 8 },
  btn: { borderRadius: 36, border: '3px solid #0B0B0C', color: '#0B0B0C', fontWeight: 900, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 0 #0B0B0C' },
};
