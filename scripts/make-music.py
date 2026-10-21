"""Composes Pulse's background music: six original 80s-style loops (synthwave, darkwave, italo,
training montage, retro chill, outrun), synthesized here so there's no licensing.

Run: python3 scripts/make-music.py   (needs numpy and scipy)
Writes assets/audio/music-<id>.wav (mono, 32 kHz PCM so the loops repeat without a gap). Echo and
reverb wrap around the end of each loop, so the seam is seamless too.
"""

import os
import wave

import numpy as np
from scipy.signal import butter, lfilter

SR = 32000
RNG = np.random.default_rng(80)
NAMES = {'C': -9, 'D': -7, 'E': -5, 'F': -4, 'G': -2, 'A': 0, 'B': 2}


def hz(note):
    n = NAMES[note[0]]
    rest = note[1:]
    while rest and rest[0] in '#b':
        n += 1 if rest[0] == '#' else -1
        rest = rest[1:]
    return 440.0 * 2 ** ((n + (int(rest) - 4) * 12) / 12)


def tt(n):
    return np.arange(n) / SR


def env(n, a=0.005, d=0.1, s=0.6, r=0.08):
    a, d, r = (max(1, int(x * SR)) for x in (a, d, r))
    sl = max(0, n - a - d - r)
    e = np.concatenate([np.linspace(0, 1, a), np.linspace(1, s, d), np.full(sl, s), np.linspace(s, 0, r)])
    return e[:n] if len(e) >= n else np.pad(e, (0, n - len(e)))


def lp(x, f, order=2):
    b, a = butter(order, min(f, SR / 2 - 200) / (SR / 2), 'low')
    return lfilter(b, a, x)


def hp(x, f, order=2):
    b, a = butter(order, f / (SR / 2), 'high')
    return lfilter(b, a, x)


def ph(f, n, vib=0.0, rate=5.0):
    freq = np.full(n, f, float)
    if vib:
        t = tt(n)
        freq *= 1 + vib * np.clip(t / 0.3, 0, 1) * np.sin(2 * np.pi * rate * t)
    return np.cumsum(freq) / SR


def saw(f, n, **k):
    return 2 * (ph(f, n, **k) % 1) - 1


def sq(f, n, duty=0.5, **k):
    return np.where((ph(f, n, **k) % 1) < duty, 1.0, -1.0)


def sine(f, n, **k):
    return np.sin(2 * np.pi * ph(f, n, **k))


def noise(n):
    return RNG.uniform(-1, 1, n)


def sweep_lp(x, start, end):
    # A filter that opens (or closes) across the note: done in slices.
    out = np.zeros_like(x)
    k = 8
    edges = np.linspace(0, len(x), k + 1).astype(int)
    for i in range(k):
        f = start + (end - start) * i / (k - 1)
        seg = x[edges[i]:edges[i + 1]]
        if len(seg):
            out[edges[i]:edges[i + 1]] = lp(seg, f)
    return out


# ---------- Instruments ----------

def bass_analog(f, n, cut=700, decay=0.12):
    s = saw(f, n) + 0.6 * sq(f / 2, n, 0.5)
    filt = sweep_lp(s, cut * 2.2, cut)
    return filt * env(n, a=0.003, d=decay, s=0.55, r=0.03)


def bass_sub(f, n):
    return (sine(f, n) + 0.3 * saw(f, n)) * env(n, a=0.004, d=0.2, s=0.7, r=0.05)


def juno_pad(notes, n, cut=1800):
    s = 0
    for x in notes:
        f = hz(x)
        s = s + saw(f, n, vib=0.003, rate=0.6) + saw(f * 1.006, n, vib=0.003, rate=0.7) + saw(f * 0.994, n)
    s = s / (3 * len(notes))
    return lp(s, cut) * env(n, a=0.6, d=0.4, s=0.85, r=0.6)


def brass_stab(notes, n):
    s = sum(saw(hz(x), n) + saw(hz(x) * 1.008, n) for x in notes) / (2 * len(notes))
    return sweep_lp(s, 4500, 1400) * env(n, a=0.01, d=0.18, s=0.45, r=0.12)


def lead(f, n, bright=3000):
    s = sq(f, n, 0.42, vib=0.006, rate=5.5) * 0.6 + saw(f * 1.003, n, vib=0.006, rate=5.5) * 0.6
    return lp(s, bright) * env(n, a=0.02, d=0.2, s=0.75, r=0.15)


def bell(f, n):
    t = tt(n)
    s = sine(f, n) + 0.5 * sine(f * 2.76, n) * np.exp(-t * 5) + 0.25 * sine(f * 5.4, n) * np.exp(-t * 9)
    return s * np.exp(-t * 2.8) * env(n, a=0.002, d=0.05, s=1, r=0.05)


def arp_pluck(f, n, cut=2600):
    s = saw(f, n) + 0.5 * sq(f * 2, n, 0.3)
    return lp(s, cut) * env(n, a=0.002, d=0.09, s=0.12, r=0.04)


def epiano(f, n):
    t = tt(n)
    s = sine(f, n) + 0.3 * sine(f * 2, n) * np.exp(-t * 5) + 0.1 * sine(f * 7.1, n) * np.exp(-t * 30)
    return s * (1 + 0.15 * np.sin(2 * np.pi * 3.8 * t)) * env(n, a=0.003, d=0.8, s=0.3, r=0.2)


def kick(punch=1.0, n=None):
    n = n or int(0.3 * SR)
    t = tt(n)
    body = np.sin(2 * np.pi * (48 + 120 * np.exp(-t * 30)) * t) * np.exp(-t * 9)
    click = hp(noise(n), 2000) * np.exp(-t * 300) * 0.3
    return (body + click) * punch


def gated_snare(n=None):
    # The 80s sound: a snare drowned in a big reverb that's chopped off short.
    n = n or int(0.32 * SR)
    t = tt(n)
    dry = hp(noise(n), 1200) * np.exp(-t * 20) + 0.5 * np.sin(2 * np.pi * 190 * t) * np.exp(-t * 25)
    tail = lp(hp(noise(n), 900), 7000) * 0.55
    gate = np.where(t < 0.24, 1.0, np.exp(-(t - 0.24) * 120))
    return (dry + tail) * gate * 0.9


def clap(n=None):
    n = n or int(0.25 * SR)
    t = tt(n)
    e = np.zeros(n)
    for k in range(3):
        o = int(k * 0.012 * SR)
        e[o:] += np.exp(-np.arange(n - o) / SR * (90 if k < 2 else 18))
    return lp(hp(noise(n), 900), 6000) * e * 0.55


def hat(open_=False):
    n = int((0.2 if open_ else 0.05) * SR)
    return hp(noise(n), 8000) * np.exp(-tt(n) * (14 if open_ else 80))


def tom(f=110, n=None):
    n = n or int(0.4 * SR)
    t = tt(n)
    return np.sin(2 * np.pi * (f + 60 * np.exp(-t * 12)) * t) * np.exp(-t * 7)


# ---------- Track with buses ----------

class Track:
    def __init__(self, bpm, bars):
        self.beat = 60 / bpm
        self.bars = bars
        self.n = int(round(bars * 4 * self.beat * SR))
        self.bus = {k: np.zeros(self.n) for k in ('drums', 'bass', 'pad', 'lead', 'arp')}
        self.kicks = []

    def at(self, bar, beat):
        return int(round((bar * 4 + beat) * self.beat * SR))

    def dur(self, beats, gap=0.95):
        return max(1, int(beats * self.beat * SR * gap))

    def add(self, bus, start, sig, vol=1.0):
        start %= self.n
        end = start + len(sig)
        b = self.bus[bus]
        if end <= self.n:
            b[start:end] += vol * sig
        else:
            k = self.n - start
            b[start:] += vol * sig[:k]
            b[: end - self.n] += vol * sig[k:]

    def kick(self, bar, beat, vol=1.0):
        s = self.at(bar, beat)
        self.kicks.append(s)
        self.add('drums', s, kick(), vol)


def echo(x, time_s, fb=0.4, taps=4, damp=3000):
    out = x.copy()
    shift = int(time_s * SR)
    y = x
    for i in range(1, taps + 1):
        y = lp(np.roll(y, shift), damp) * fb
        out += y
    return out


def reverb(x, seconds=2.0, mix=0.3, bright=5000):
    # Circular convolution with a decaying noise tail, so the loop stays seamless.
    n = int(seconds * SR)
    ir = lp(noise(n), bright) * np.exp(-tt(n) * (6.9 / seconds))
    ir[:int(0.012 * SR)] = 0  # a little pre-delay
    L = len(x)
    if n > L:
        ir = ir[:L]
    wet = np.real(np.fft.ifft(np.fft.fft(x) * np.fft.fft(ir, L)))
    wet *= np.sqrt(np.mean(x ** 2) / (np.mean(wet ** 2) + 1e-12))
    return x * (1 - mix) + wet * mix


def pump(tr, depth=0.5, release=0.25):
    # Sidechain-style ducking on each kick, the pulse of synthwave pads.
    g = np.ones(tr.n)
    r = int(release * SR)
    curve = 1 - depth * np.exp(-np.linspace(0, 5, r))
    for s in tr.kicks:
        s %= tr.n
        e = min(tr.n, s + r)
        g[s:e] = np.minimum(g[s:e], curve[: e - s])
    return g


def mixdown(tr, levels, verb, duck=0.45):
    g = pump(tr, duck)
    out = np.zeros(tr.n)
    for k, sig in tr.bus.items():
        if not np.any(sig):
            continue
        s = sig
        if k in verb:
            s = reverb(s, *verb[k])
        if k in ('pad', 'arp', 'lead'):
            s = s * g
        out += levels.get(k, 1.0) * s
    out = hp(out, 30)
    out = np.tanh(out / (np.max(np.abs(out)) + 1e-9) * 1.4) / np.tanh(1.4)
    return out * 0.85


def write(path, x):
    with wave.open(path, 'w') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((np.clip(x, -1, 1) * 32767).astype('<i2').tobytes())


# ---------- Pieces ----------

def chords_loop(tr, prog, bars_per, octave_pad=('', ''), pad_vol=0.5, cut=1800):
    for i, ch in enumerate(prog):
        bar = i * bars_per
        tr.add('pad', tr.at(bar, 0), juno_pad(ch, tr.dur(4 * bars_per, 1.0), cut), pad_vol)


def drums_80s(tr, bar, fill=False, hats=True, open_hat=True):
    for b in range(4):
        if b in (0, 2):
            tr.kick(bar, b)
        if b in (1, 3):
            tr.add('drums', tr.at(bar, b), gated_snare(), 0.75)
        if hats:
            for h in (0, 0.5):
                tr.add('drums', tr.at(bar, b + h), hat(), 0.28 if h else 0.18)
    if open_hat:
        tr.add('drums', tr.at(bar, 3.5), hat(True), 0.2)
    if fill:
        for k, f in enumerate((180, 140, 110, 85)):
            tr.add('drums', tr.at(bar, 3 + k * 0.25), tom(f), 0.5)


def night_drive():
    """Synthwave / outrun: Am F C G, octave bass in 16ths, gated snare, echoing lead."""
    tr = Track(100, 16)
    prog = [['A3', 'C4', 'E4'], ['F3', 'A3', 'C4'], ['C4', 'E4', 'G4'], ['G3', 'B3', 'D4']] * 2
    roots = ['A1', 'F1', 'C2', 'G1'] * 2
    for i, ch in enumerate(prog):
        bar = i * 2
        tr.add('pad', tr.at(bar, 0), juno_pad(ch, tr.dur(8, 1.0)), 0.45)
        r = hz(roots[i])
        for s in range(32):
            f = r * (2 if s % 2 else 1)
            tr.add('bass', tr.at(bar, s * 0.25), bass_analog(f, tr.dur(0.25, 0.8), 650), 0.55)
    for bar in range(16):
        drums_80s(tr, bar, fill=bar % 8 == 7)
    melody = [(0, 1.5, 'E5'), (1.5, 0.5, 'D5'), (2, 1, 'C5'), (3, 1, 'B4'),
              (4, 2, 'A4'), (6, 1, 'C5'), (7, 1, 'D5'), (8, 1.5, 'E5'), (9.5, 0.5, 'G5'),
              (10, 2, 'E5'), (12, 1, 'D5'), (13, 1, 'C5'), (14, 2, 'D5')]
    # The lead enters in the second half of the loop.
    for rep in (8,):
        for beat, ln, note in melody:
            tr.add('lead', tr.at(rep, beat), lead(hz(note), tr.dur(ln)), 0.32)
    tr.bus['lead'] = echo(tr.bus['lead'], tr.beat * 0.75, 0.38, 4, 2600)
    return mixdown(tr, {'drums': 0.9, 'bass': 0.8, 'pad': 0.75, 'lead': 0.8}, {'pad': (2.5, 0.35), 'lead': (2.0, 0.3), 'drums': (1.2, 0.12)})


def neon_noir():
    """Darkwave, John-Carpenter style: Dm ostinato in 8ths, slow ominous pad, bell motif."""
    tr = Track(92, 16)
    pattern = ['D2', 'D2', 'A2', 'D2', 'F2', 'D2', 'A2', 'C3']
    pads = [['D3', 'F3', 'A3'], ['D3', 'F3', 'A3'], ['Bb2', 'D3', 'F3'], ['C3', 'E3', 'G3']]
    for i, ch in enumerate(pads * 2):
        tr.add('pad', tr.at(i * 2, 0), juno_pad(ch, tr.dur(8, 1.0), 1200), 0.5)
    shift = {0: 0, 1: 0, 2: -4, 3: -2}  # bass follows the chords
    for bar in range(16):
        semis = shift[(bar // 2) % 4]
        for s, note in enumerate(pattern):
            f = hz(note) * 2 ** (semis / 12)
            tr.add('bass', tr.at(bar, s * 0.5), bass_analog(f, tr.dur(0.5, 0.85), 520, 0.18), 0.6)
        tr.kick(bar, 0, 0.9)
        tr.kick(bar, 2, 0.9)
        tr.add('drums', tr.at(bar, 1), clap(), 0.55)
        tr.add('drums', tr.at(bar, 3), gated_snare(), 0.6)
        for h in range(8):
            tr.add('drums', tr.at(bar, h * 0.5), hat(), 0.12 if h % 2 else 0.2)
    motif = [(0, 'A5'), (1.5, 'F5'), (3, 'E5'), (4, 'D5'), (5.5, 'E5'), (7, 'C5')]
    for rep in (4, 12):
        for beat, note in motif:
            tr.add('arp', tr.at(rep, beat), bell(hz(note), int(1.8 * SR)), 0.3)
    tr.bus['arp'] = echo(tr.bus['arp'], tr.beat * 1.5, 0.45, 5, 3500)
    return mixdown(tr, {'drums': 0.8, 'bass': 0.9, 'pad': 0.8, 'arp': 0.7}, {'pad': (3.0, 0.4), 'arp': (2.5, 0.4), 'drums': (1.0, 0.15)}, duck=0.3)


def training_montage():
    """80s movie training montage: E minor, driving 8th bass, brass-synth stabs, big toms."""
    tr = Track(118, 16)
    prog = [['E3', 'G3', 'B3'], ['C3', 'E3', 'G3'], ['D3', 'F#3', 'A3'], ['B2', 'D#3', 'F#3']]
    roots = ['E2', 'C2', 'D2', 'B1']
    for i in range(8):
        ch, r = prog[i % 4], hz(roots[i % 4])
        bar = i * 2
        tr.add('pad', tr.at(bar, 0), juno_pad(ch, tr.dur(8, 1.0), 2200), 0.3)
        for s in range(16):
            tr.add('bass', tr.at(bar, s * 0.5), bass_analog(r, tr.dur(0.5, 0.75), 900, 0.1), 0.55)
        for b in (0, 1.5, 3, 4.5, 6):
            tr.add('lead', tr.at(bar, b), brass_stab([x.replace('3', '4').replace('2', '3') for x in ch], tr.dur(0.75)), 0.35)
    for bar in range(16):
        drums_80s(tr, bar, fill=bar % 4 == 3)
    tr.bus['lead'] = echo(tr.bus['lead'], tr.beat * 0.5, 0.2, 2, 3000)
    return mixdown(tr, {'drums': 1.0, 'bass': 0.8, 'pad': 0.7, 'lead': 0.75}, {'pad': (2.0, 0.3), 'lead': (1.5, 0.25), 'drums': (1.4, 0.15)}, duck=0.35)


def chrome_city():
    """Italo / electro-disco: octave-jumping sequenced bass, sparkling arpeggio, four-on-the-floor."""
    tr = Track(112, 16)
    prog = [['F#3', 'A3', 'C#4'], ['D3', 'F#3', 'A3'], ['A3', 'C#4', 'E4'], ['E3', 'G#3', 'B3']]
    roots = ['F#1', 'D1', 'A1', 'E1']
    for i in range(8):
        ch, r = prog[i % 4], hz(roots[i % 4])
        bar = i * 2
        tr.add('pad', tr.at(bar, 0), juno_pad(ch, tr.dur(8, 1.0), 1600), 0.35)
        for s in range(32):
            f = r * (2 if s % 2 else 1) * (1.5 if s % 8 == 7 else 1)
            tr.add('bass', tr.at(bar, s * 0.25), bass_analog(f, tr.dur(0.25, 0.7), 1100, 0.06), 0.5)
        arp = [hz(x) * 2 for x in ch] + [hz(ch[1]) * 4]
        for s in range(32):
            tr.add('arp', tr.at(bar, s * 0.25), arp_pluck(arp[s % 4], tr.dur(0.25, 0.6)), 0.18)
    for bar in range(16):
        for b in range(4):
            tr.kick(bar, b, 0.9)
            tr.add('drums', tr.at(bar, b + 0.5), hat(True), 0.15)
        tr.add('drums', tr.at(bar, 1), clap(), 0.5)
        tr.add('drums', tr.at(bar, 3), clap(), 0.5)
    tr.bus['arp'] = echo(tr.bus['arp'], tr.beat * 0.75, 0.3, 3, 4000)
    return mixdown(tr, {'drums': 0.85, 'bass': 0.85, 'pad': 0.7, 'arp': 0.8}, {'pad': (2.2, 0.3), 'arp': (1.6, 0.25)}, duck=0.5)


def midnight_grid():
    """Slow retro chill: Fm7 Dbmaj7 Bbm7 C7 on electric piano and pads, soft drums."""
    tr = Track(84, 16)
    prog = [['F3', 'Ab3', 'C4', 'Eb4'], ['Db3', 'F3', 'Ab3', 'C4'], ['Bb2', 'Db3', 'F3', 'Ab3'], ['C3', 'E3', 'G3', 'Bb3']]
    roots = ['F1', 'Db2', 'Bb1', 'C2']
    for i in range(8):
        ch, r = prog[i % 4], hz(roots[i % 4])
        bar = i * 2
        tr.add('pad', tr.at(bar, 0), juno_pad(ch, tr.dur(8, 1.0), 1100), 0.4)
        for b in (0, 1.5, 3, 4, 5.5, 7):
            for x in ch:
                tr.add('arp', tr.at(bar, b), epiano(hz(x) * 2, tr.dur(1.5)), 0.09)
        for b, f in ((0, r), (2.5, r), (4, r * 1.5), (6, r)):
            tr.add('bass', tr.at(bar, b), bass_sub(f, tr.dur(1.2)), 0.6)
    for bar in range(16):
        tr.kick(bar, 0, 0.8)
        tr.kick(bar, 2.5, 0.6)
        tr.add('drums', tr.at(bar, 1), gated_snare(), 0.4)
        tr.add('drums', tr.at(bar, 3), gated_snare(), 0.4)
        for h in range(8):
            tr.add('drums', tr.at(bar, h * 0.5), hat(), 0.09)
    return mixdown(tr, {'drums': 0.7, 'bass': 0.8, 'pad': 0.8, 'arp': 0.9}, {'pad': (3.0, 0.4), 'arp': (2.5, 0.35), 'drums': (1.5, 0.2)}, duck=0.2)


def final_lap():
    """Fast outrun chase: C minor, galloping bass, relentless arpeggio, soaring lead."""
    tr = Track(128, 16)
    prog = [['C4', 'Eb4', 'G4'], ['Ab3', 'C4', 'Eb4'], ['Bb3', 'D4', 'F4'], ['G3', 'B3', 'D4']]
    roots = ['C2', 'Ab1', 'Bb1', 'G1']
    for i in range(8):
        ch, r = prog[i % 4], hz(roots[i % 4])
        bar = i * 2
        tr.add('pad', tr.at(bar, 0), juno_pad(ch, tr.dur(8, 1.0), 2000), 0.35)
        for s in range(32):
            if s % 4 == 1:
                continue  # gallop: da-da-dum
            tr.add('bass', tr.at(bar, s * 0.25), bass_analog(r, tr.dur(0.25, 0.7), 800, 0.07), 0.55)
        arp = [hz(ch[0]) * 2, hz(ch[1]) * 2, hz(ch[2]) * 2, hz(ch[1]) * 2]
        for s in range(32):
            tr.add('arp', tr.at(bar, s * 0.25), arp_pluck(arp[s % 4], tr.dur(0.25, 0.6), 3200), 0.14)
    for bar in range(16):
        drums_80s(tr, bar, fill=bar % 8 == 7)
        tr.kick(bar, 2.75, 0.6)
    melody = [(0, 2, 'G5'), (2, 1, 'Eb5'), (3, 1, 'F5'), (4, 2, 'Eb5'), (6, 1, 'C5'), (7, 1, 'D5'),
              (8, 3, 'Eb5'), (11, 1, 'F5'), (12, 2, 'G5'), (14, 2, 'D5')]
    for rep in (4, 12):
        for beat, ln, note in melody:
            tr.add('lead', tr.at(rep, beat), lead(hz(note), tr.dur(ln), 3600), 0.3)
    tr.bus['lead'] = echo(tr.bus['lead'], tr.beat * 0.75, 0.35, 3, 3000)
    tr.bus['arp'] = echo(tr.bus['arp'], tr.beat * 0.5, 0.2, 2, 4000)
    return mixdown(tr, {'drums': 0.95, 'bass': 0.85, 'pad': 0.65, 'arp': 0.7, 'lead': 0.8}, {'pad': (2.0, 0.3), 'lead': (2.0, 0.3), 'drums': (1.2, 0.12)}, duck=0.4)


TRACKS = {
    'drive': night_drive,
    'noir': neon_noir,
    'chrome': chrome_city,
    'montage': training_montage,
    'grid': midnight_grid,
    'lap': final_lap,
}

OUT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'audio')

if __name__ == '__main__':
    for name, make in TRACKS.items():
        x = make()
        write(os.path.join(OUT, f'music-{name}.wav'), x)
        print(name, f'{len(x) / SR:.1f}s')
