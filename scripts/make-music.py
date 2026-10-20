"""Composes Pulse's background music: six original loops, synthesized here so there's no licensing.

Run: python3 scripts/make-music.py   (needs numpy and scipy)
Writes assets/audio/music-<id>.wav (mono, 22.05 kHz PCM so the loops repeat without a gap).

Each track is a fixed number of bars; notes that ring past the end wrap to the start, so the loop is
seamless. Melodies are written as (beat, length in beats, note) per bar.
"""

import os
import wave

import numpy as np
from scipy.signal import butter, lfilter

SR = 22050
OUT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'audio')
RNG = np.random.default_rng(7)

# ---------- Synth ----------

NAMES = {'C': -9, 'D': -7, 'E': -5, 'F': -4, 'G': -2, 'A': 0, 'B': 2}


def hz(note: str) -> float:
    n = NAMES[note[0]]
    rest = note[1:]
    while rest and rest[0] in '#b':
        n += 1 if rest[0] == '#' else -1
        rest = rest[1:]
    return 440.0 * 2 ** ((n + (int(rest) - 4) * 12) / 12)


def t_(n):
    return np.arange(n) / SR


def adsr(n, a=0.005, d=0.1, s=0.6, r=0.06):
    a, d, r = (max(1, int(x * SR)) for x in (a, d, r))
    sl = max(0, n - a - d - r)
    e = np.concatenate([np.linspace(0, 1, a), np.linspace(1, s, d), np.full(sl, s), np.linspace(s, 0, r)])
    return e[:n] if len(e) >= n else np.pad(e, (0, n - len(e)))


def lowpass(x, cutoff, order=2):
    b, a = butter(order, min(cutoff, SR / 2 - 100) / (SR / 2), 'low')
    return lfilter(b, a, x)


def highpass(x, cutoff, order=2):
    b, a = butter(order, cutoff / (SR / 2), 'high')
    return lfilter(b, a, x)


def phase(f, n, vib=0.0, rate=5.5, glide_from=None, glide_time=0.04):
    t = t_(n)
    freq = np.full(n, f, dtype=float)
    if glide_from:
        g = min(n, int(glide_time * SR))
        freq[:g] = np.linspace(glide_from, f, g)
    if vib:
        # Vibrato fades in so short notes stay clean.
        depth = vib * np.clip(t / 0.25, 0, 1)
        freq = freq * (1 + depth * np.sin(2 * np.pi * rate * t))
    return np.cumsum(freq) / SR


def saw(f, n, **kw):
    p = phase(f, n, **kw)
    return 2 * (p % 1) - 1


def square(f, n, duty=0.5, **kw):
    p = phase(f, n, **kw)
    return np.where((p % 1) < duty, 1.0, -1.0)


def tri(f, n, **kw):
    p = phase(f, n, **kw)
    return 2 * np.abs(2 * (p % 1) - 1) - 1


def sine(f, n, **kw):
    return np.sin(2 * np.pi * phase(f, n, **kw))


def noise(n):
    return RNG.uniform(-1, 1, n)


# Instruments: each returns a mono signal for one note.

def tuba(f, n):
    # Round brassy bass with a little "blat" as it starts.
    s = 0.6 * saw(f, n, glide_from=f * 0.94, glide_time=0.05) + 0.6 * sine(f, n)
    return lowpass(s, 700) * adsr(n, a=0.012, d=0.12, s=0.75, r=0.05)


def brass(f, n):
    s = saw(f, n, vib=0.006, rate=5.8) + 0.5 * saw(f * 1.004, n, vib=0.006, rate=5.8)
    bright = lowpass(s, 3200)
    soft = lowpass(s, 1100)
    e = adsr(n, a=0.035, d=0.15, s=0.7, r=0.08)
    mix = np.clip(t_(n) / 0.08, 0, 1)  # the tone opens up like a player blowing harder
    return (soft * (1 - mix) + bright * mix) * e


def stab(notes, n):
    s = sum(square(hz(x), n, 0.4) + 0.5 * square(hz(x) * 1.006, n, 0.4) for x in notes) / len(notes)
    return lowpass(s, 2600) * adsr(n, a=0.003, d=0.09, s=0.25, r=0.04)


def pluck(f, n, cutoff=2400, duty=0.25):
    s = square(f, n, duty)
    return lowpass(s, cutoff) * adsr(n, a=0.002, d=0.12, s=0.15, r=0.05)


def synth_bass(f, n, cutoff=900):
    s = saw(f, n) + 0.4 * square(f / 2, n)
    return lowpass(s, cutoff) * adsr(n, a=0.004, d=0.1, s=0.6, r=0.04)


def pad(notes, n):
    s = sum(saw(hz(x), n) + saw(hz(x) * 1.007, n) + saw(hz(x) * 0.993, n) for x in notes) / (3 * len(notes))
    return lowpass(s, 1500) * adsr(n, a=0.4, d=0.3, s=0.8, r=0.4)


def epiano(f, n):
    t = t_(n)
    s = sine(f, n) + 0.25 * sine(f * 2, n) * np.exp(-t * 6) + 0.08 * sine(f * 3.01, n) * np.exp(-t * 10)
    trem = 1 + 0.12 * np.sin(2 * np.pi * 4.5 * t)
    return s * trem * adsr(n, a=0.004, d=0.6, s=0.35, r=0.15)


def kick(n=None, punch=1.0):
    n = n or int(0.22 * SR)
    t = t_(n)
    return np.sin(2 * np.pi * (55 + 110 * np.exp(-t * 35)) * t) * np.exp(-t * 14) * punch


def snare(n=None, body=180, decay=24, tone=0.4):
    n = n or int(0.2 * SR)
    t = t_(n)
    return (highpass(noise(n), 1500) * np.exp(-t * decay) + tone * np.sin(2 * np.pi * body * t) * np.exp(-t * 30))


def clap(n=None):
    n = n or int(0.18 * SR)
    t = t_(n)
    env = np.zeros(n)
    for k in range(3):
        o = int(k * 0.011 * SR)
        env[o:] += np.exp(-np.arange(n - o) / SR * (80 if k < 2 else 22))
    return lowpass(highpass(noise(n), 900), 5000) * env * 0.6


def hat(open_=False):
    n = int((0.16 if open_ else 0.04) * SR)
    return highpass(noise(n), 7000) * np.exp(-t_(n) * (18 if open_ else 90))


def boing(n=None, lo=300, hi=900):
    n = n or int(0.35 * SR)
    t = t_(n)
    f = lo + (hi - lo) * np.sin(np.pi * t / t[-1]) ** 2
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * adsr(n, a=0.01, d=0.1, s=0.7, r=0.08)


# ---------- Arrangement helpers ----------

class Track:
    def __init__(self, bpm, bars, swing=0.5):
        self.beat = 60 / bpm
        self.bars = bars
        self.swing = swing  # where the off-beat eighth lands (0.5 = straight)
        self.n = int(round(bars * 4 * self.beat * SR))
        self.buf = np.zeros(self.n)

    def at(self, bar, beat):
        whole = int(np.floor(beat + 1e-9))
        frac = beat - whole
        if abs(frac - 0.5) < 1e-6:
            frac = self.swing
        elif abs(frac - 0.25) < 1e-6:
            frac = self.swing / 2
        elif abs(frac - 0.75) < 1e-6:
            frac = self.swing + (1 - self.swing) / 2
        return int(round((bar * 4 + whole + frac) * self.beat * SR))

    def dur(self, beats, gap=0.92):
        return max(1, int(beats * self.beat * SR * gap))

    def add(self, start, sig, vol=1.0):
        # Wraps around the end so the loop is seamless.
        start %= self.n
        end = start + len(sig)
        if end <= self.n:
            self.buf[start:end] += vol * sig
        else:
            k = self.n - start
            self.buf[start:] += vol * sig[:k]
            rest = sig[k:]
            while len(rest):
                m = min(len(rest), self.n)
                self.buf[:m] += vol * rest[:m]
                rest = rest[m:]

    def melody(self, bars, inst, vol, octave=0):
        for bi, notes in bars.items():
            for beat, length, note in notes:
                f = hz(note) * 2 ** octave
                self.add(self.at(bi, beat), inst(f, self.dur(length)), vol)

    def write(self, name, peak=0.72):
        x = self.buf - np.mean(self.buf)
        x = np.tanh(1.2 * x / (np.max(np.abs(x)) or 1))  # gentle glue
        x = x / (np.max(np.abs(x)) or 1) * peak
        pcm = (x * 32767).astype(np.int16)
        os.makedirs(OUT, exist_ok=True)
        dst = os.path.join(OUT, f'music-{name}.wav')
        with wave.open(dst, 'wb') as w:
            w.setnchannels(1)
            w.setsampwidth(2)
            w.setframerate(SR)
            w.writeframes(pcm.tobytes())
        print(f'wrote {os.path.relpath(dst)} ({self.n / SR:.1f}s)')


CHORDS = {
    'F': ['F4', 'A4', 'C5'], 'Bb': ['F4', 'Bb4', 'D5'], 'C7': ['E4', 'Bb4', 'C5'], 'G7': ['F4', 'B4', 'D5'],
    'Dm': ['F4', 'A4', 'D5'], 'Am': ['A3', 'C4', 'E4'], 'C': ['C4', 'E4', 'G4'], 'G': ['B3', 'D4', 'G4'],
    'Em7': ['E4', 'G4', 'B4', 'D5'], 'A7': ['E4', 'G4', 'C#5'], 'Bbm': ['F4', 'Bb4', 'Db5'],
    'Cmaj7': ['E4', 'G4', 'B4'], 'Am7': ['C4', 'E4', 'G4'], 'Dm7': ['F4', 'A4', 'C5'], 'G13': ['F4', 'B4', 'E5'],
    'Dm5': ['D4', 'F4', 'A4'], 'Bb5': ['D4', 'F4', 'Bb4'], 'C5': ['E4', 'G4', 'C5'], 'A5': ['E4', 'A4', 'C#5'],
}
ROOT = {'F': 'F2', 'Bb': 'Bb1', 'C7': 'C2', 'G7': 'G1', 'Dm': 'D2', 'Am': 'A1', 'C': 'C2', 'G': 'G1',
        'Em7': 'E2', 'A7': 'A1', 'Cmaj7': 'C2', 'Am7': 'A1', 'Dm7': 'D2', 'G13': 'G1',
        'Dm5': 'D2', 'Bb5': 'Bb1', 'C5': 'C2', 'A5': 'A1'}


def fifth(note):
    f = hz(note) * 1.5
    return f


# ---------- Brawl Bounce: oom-pah swing with a wobbly brass lead ----------

def brawl():
    tr = Track(bpm=138, bars=16, swing=0.64)
    prog = ['F', 'Bb', 'C7', 'F', 'F', 'Bb', 'G7', 'C7', 'Dm', 'Bb', 'F', 'C7', 'F', 'Bb', 'C7', 'F']
    for b, ch in enumerate(prog):
        root = hz(ROOT[ch])
        # Oom (root) on 1, pah (fifth) on 3, with a walk-up into the next bar every other bar.
        tr.add(tr.at(b, 0), tuba(root, tr.dur(0.9)), 0.55)
        tr.add(tr.at(b, 2), tuba(root * 1.5, tr.dur(0.9)), 0.5)
        if b % 2 == 1:
            tr.add(tr.at(b, 3.5), tuba(root * 1.68, tr.dur(0.45)), 0.4)
        for beat in (1, 3):
            tr.add(tr.at(b, beat), stab(CHORDS[ch], tr.dur(0.35)), 0.24)
        tr.add(tr.at(b, 0), kick(punch=0.9), 0.5)
        tr.add(tr.at(b, 2), kick(punch=0.7), 0.4)
        for beat in (1, 3):
            tr.add(tr.at(b, beat), clap(), 0.22)
        for e in range(8):
            tr.add(tr.at(b, e / 2), hat(), 0.08 if e % 2 else 0.05)

    A = {
        0: [(0, .5, 'C5'), (.5, .5, 'F5'), (1, 1, 'A5'), (2, .5, 'G5'), (2.5, .5, 'F5'), (3, 1, 'C5')],
        1: [(0, .5, 'D5'), (.5, .5, 'F5'), (1, 1, 'Bb5'), (2, 1, 'A5'), (3, 1, 'G5')],
        2: [(0, .5, 'E5'), (.5, .5, 'G5'), (1, .5, 'Bb5'), (1.5, .5, 'A5'), (2, 1, 'G5'), (3, .5, 'E5'), (3.5, .5, 'C5')],
        3: [(0, 1.5, 'F5'), (2, .5, 'A4'), (2.5, .5, 'C5'), (3, 1, 'F5')],
        4: [(0, .5, 'A5'), (.5, .5, 'C6'), (1, 1, 'A5'), (2, .5, 'F5'), (2.5, .5, 'A5'), (3, 1, 'C6')],
        5: [(0, 1, 'D6'), (1, .5, 'C6'), (1.5, .5, 'Bb5'), (2, 1, 'A5'), (3, 1, 'F5')],
        6: [(0, .5, 'G5'), (.5, .5, 'B5'), (1, 1, 'D6'), (2, .5, 'F5'), (2.5, .5, 'G5'), (3, 1, 'B5')],
        7: [(0, 2, 'C6'), (2, .5, 'Bb5'), (2.5, .5, 'G5'), (3, 1, 'E5')],
        8: [(0, .5, 'D5'), (.5, .5, 'F5'), (1, .5, 'A5'), (1.5, .5, 'D6'), (2, 1, 'C6'), (3, 1, 'A5')],
        9: [(0, .5, 'Bb5'), (.5, .5, 'A5'), (1, .5, 'G5'), (1.5, .5, 'F5'), (2, 2, 'D5')],
        10: [(0, .5, 'C5'), (.5, .5, 'F5'), (1, .5, 'A5'), (1.5, .5, 'C6'), (2, 1, 'F6'), (3, 1, 'C6')],
        11: [(0, 1, 'Bb5'), (1, 1, 'G5'), (2, 1, 'E5'), (3, 1, 'C5')],
        12: [(0, .5, 'C5'), (.5, .5, 'F5'), (1, 1, 'A5'), (2, .5, 'G5'), (2.5, .5, 'F5'), (3, 1, 'C5')],
        13: [(0, .5, 'D5'), (.5, .5, 'F5'), (1, 1, 'Bb5'), (2, 1, 'A5'), (3, 1, 'G5')],
        14: [(0, .5, 'G5'), (.5, .5, 'A5'), (1, .5, 'Bb5'), (1.5, .5, 'C6'), (2, .5, 'D6'), (2.5, .5, 'E6'), (3, 1, 'G6')],
        15: [(0, 2, 'F6'), (2, .5, 'C6'), (2.5, .5, 'A5'), (3, 1, 'F5')],
    }
    tr.melody(A, brass, 0.3, octave=-1)
    # A goofy slide-whistle "boing" at the end of each half.
    tr.add(tr.at(3, 2), boing(), 0.18)
    tr.add(tr.at(11, 3), boing(lo=500, hi=1300), 0.16)
    tr.write('brawl')


# ---------- Arcade: the original chiptune loop ----------

def arcade():
    tr = Track(bpm=132, bars=16)
    prog = ['Am', 'F', 'C', 'G'] * 2 + ['Am', 'F', 'C', 'G', 'Dm5', 'F', 'C', 'A5']
    for b, ch in enumerate(prog):
        root = hz(ROOT[ch]) * 2
        for i in range(8):
            f = root * (2 if i % 2 else 1)
            tr.add(tr.at(b, i / 2), tri(f, tr.dur(0.5)) * adsr(tr.dur(0.5), d=0.05, s=0.7), 0.35)
        notes = CHORDS[ch] + [CHORDS[ch][1]]
        for i in range(16):
            tr.add(tr.at(b, i / 4), pluck(hz(notes[i % 4]) * 2, tr.dur(0.25), cutoff=4000, duty=0.125), 0.1)
        tr.add(tr.at(b, 0), kick(), 0.5)
        tr.add(tr.at(b, 2), kick(), 0.5)
        tr.add(tr.at(b, 1), snare(), 0.18)
        tr.add(tr.at(b, 3), snare(), 0.18)
        for e in range(8):
            tr.add(tr.at(b, e / 2), hat(), 0.05)
    lead = [(0, .5, 'E5'), (.5, .5, 'A5'), (1, .5, 'C6'), (1.5, 1, 'B5'), (2.5, .5, 'A5'), (3, 1, 'G5')]
    for b in range(8, 16):
        shift = [0, -2, 3, 2, 5, 3, 0, -1][b - 8]
        for beat, length, note in lead:
            tr.add(tr.at(b, beat), square(hz(note) * 2 ** (shift / 12), tr.dur(length), 0.5) * adsr(tr.dur(length), d=0.1, s=0.55), 0.12)
    tr.write('arcade')


# ---------- Neon Run: synthwave ----------

def neon():
    tr = Track(bpm=108, bars=16)
    prog = ['Am', 'F', 'C', 'G'] * 4
    for b, ch in enumerate(prog):
        root = hz(ROOT[ch]) * 2
        for i in range(8):
            tr.add(tr.at(b, i / 2), synth_bass(root * (2 if i % 2 else 1), tr.dur(0.5), cutoff=1200), 0.4)
        tr.add(tr.at(b, 0), pad(CHORDS[ch], tr.dur(4, gap=1)), 0.22)
        notes = CHORDS[ch] + [x[:-1] + str(int(x[-1]) + 1) for x in CHORDS[ch]]
        for i in range(16):
            sig = pluck(hz(notes[[0, 1, 2, 3, 4, 5, 4, 3][i % 8]]), tr.dur(0.25), cutoff=3000, duty=0.5)
            tr.add(tr.at(b, i / 4), sig, 0.09)
            tr.add(tr.at(b, i / 4) + int(0.375 * tr.beat * SR), sig, 0.035)  # dotted-eighth echo
        for beat in range(4):
            tr.add(tr.at(b, beat), kick(), 0.45)
        for beat in (1, 3):
            tr.add(tr.at(b, beat), snare(n=int(0.45 * SR), decay=7, tone=0.3), 0.2)
        for e in range(8):
            tr.add(tr.at(b, e / 2 + 0.25 if e % 2 else e / 2), hat(), 0.05)
    lead = {8: [(0, 1.5, 'E5'), (1.5, .5, 'D5'), (2, 2, 'C5')], 9: [(0, 1, 'A4'), (1, 1, 'C5'), (2, 2, 'F5')],
            10: [(0, 1.5, 'G5'), (1.5, .5, 'E5'), (2, 2, 'C5')], 11: [(0, 2, 'D5'), (2, 2, 'B4')],
            12: [(0, 1.5, 'E5'), (1.5, .5, 'G5'), (2, 2, 'A5')], 13: [(0, 1, 'C6'), (1, 1, 'A5'), (2, 2, 'F5')],
            14: [(0, 1.5, 'G5'), (1.5, .5, 'A5'), (2, 2, 'E5')], 15: [(0, 4, 'D5')]}
    tr.melody(lead, lambda f, n: lowpass(saw(f, n, vib=0.004) + saw(f * 1.005, n), 2600) * adsr(n, a=0.05, d=0.2, s=0.7, r=0.2), 0.16)
    tr.write('neon')


# ---------- Subway Funk ----------

def funk():
    tr = Track(bpm=100, bars=12, swing=0.56)
    prog = ['Em7', 'Em7', 'A7', 'A7'] * 3
    bassline = [(0, .5, 0), (.75, .25, 12), (1.5, .25, 0), (2, .5, 7), (2.75, .25, 10), (3.5, .5, 12)]
    for b, ch in enumerate(prog):
        root = hz(ROOT[ch]) * 2
        for beat, length, semi in bassline:
            f = root * 2 ** (semi / 12)
            tr.add(tr.at(b, beat), lowpass(square(f, tr.dur(length, 0.8), 0.5), 800) * adsr(tr.dur(length, 0.8), d=0.06, s=0.5), 0.45)
        for beat in (0.5, 1.75, 2.5, 3.25):
            tr.add(tr.at(b, beat), stab(CHORDS[ch], tr.dur(0.2)), 0.2)
        for beat in (0, 1.75, 2.5):
            tr.add(tr.at(b, beat), kick(punch=0.9), 0.5)
        for beat in (1, 3):
            tr.add(tr.at(b, beat), snare(), 0.24)
        tr.add(tr.at(b, 3.75), snare(), 0.06)  # ghost note
        for s in range(16):
            tr.add(tr.at(b, s / 4), hat(open_=(s == 14)), 0.05 if s % 2 else 0.07)
    lick = [(0, .25, 'B4'), (.25, .25, 'D5'), (.5, .5, 'E5'), (1.5, .25, 'G5'), (1.75, .75, 'E5'), (3, .5, 'D5'), (3.5, .5, 'B4')]
    for b in (2, 6, 10):
        for beat, length, note in lick:
            n = tr.dur(length)
            wah = lowpass(square(hz(note), n, 0.3), 1800) * adsr(n, d=0.08, s=0.5)
            tr.add(tr.at(b, beat), wah, 0.14)
    tr.write('funk')


# ---------- Boss Fight ----------

def boss():
    tr = Track(bpm=160, bars=16)
    prog = ['Dm5', 'Dm5', 'Bb5', 'C5'] * 3 + ['Dm5', 'Bb5', 'C5', 'A5']
    for b, ch in enumerate(prog):
        root = hz(ROOT[ch]) * 2
        for i in range(8):
            tr.add(tr.at(b, i / 2), synth_bass(root, tr.dur(0.5, 0.8), cutoff=1400), 0.42)
        notes = CHORDS[ch]
        for i in range(16):
            tr.add(tr.at(b, i / 4), pluck(hz(notes[i % 3]) * 2, tr.dur(0.25), cutoff=3500, duty=0.25), 0.08)
        for beat in range(4):
            tr.add(tr.at(b, beat), kick(punch=1.1), 0.5)
        for beat in (1, 3):
            tr.add(tr.at(b, beat), snare(tone=0.5), 0.26)
        for e in range(8):
            tr.add(tr.at(b, e / 2 + 0.5 * 0), hat(), 0.06)
    lead = [(0, 1, 'D5'), (1, .5, 'F5'), (1.5, .5, 'A5'), (2, 1, 'D6'), (3, .5, 'C6'), (3.5, .5, 'A5')]
    for b in range(4, 16):
        if b % 4 == 3:
            continue
        shift = {0: 0, 1: 0, 2: -4, 3: -2}[b % 4]
        for beat, length, note in lead:
            n = tr.dur(length)
            tr.add(tr.at(b, beat), lowpass(saw(hz(note) * 2 ** (shift / 12), n, vib=0.005), 3000) * adsr(n, a=0.01, d=0.1, s=0.7), 0.15)
    tr.write('boss')


# ---------- Lo-fi Chill ----------

def chill():
    tr = Track(bpm=80, bars=8, swing=0.62)
    prog = ['Cmaj7', 'Am7', 'Dm7', 'G13'] * 2
    for b, ch in enumerate(prog):
        root = hz(ROOT[ch]) * 2
        for x in CHORDS[ch]:
            tr.add(tr.at(b, 0), epiano(hz(x), tr.dur(3.6)), 0.12)
        tr.add(tr.at(b, 2.5), epiano(hz(CHORDS[ch][-1]) * 2, tr.dur(1)), 0.06)
        tr.add(tr.at(b, 0), sine(root, tr.dur(1.5)) * adsr(tr.dur(1.5), a=0.01, d=0.3, s=0.6), 0.35)
        tr.add(tr.at(b, 2.5), sine(root * 1.5, tr.dur(1)) * adsr(tr.dur(1), a=0.01, d=0.3, s=0.6), 0.25)
        tr.add(tr.at(b, 0), lowpass(kick(punch=0.8), 400), 0.5)
        tr.add(tr.at(b, 2.5), lowpass(kick(punch=0.7), 400), 0.35)
        for beat in (1, 3):
            tr.add(tr.at(b, beat), lowpass(snare(decay=30, tone=0.2), 3500), 0.14)
        for e in range(8):
            tr.add(tr.at(b, e / 2), lowpass(hat(), 6000), 0.04)
    # Vinyl crackle over the whole loop.
    crackle = np.zeros(tr.n)
    idx = RNG.integers(0, tr.n, size=int(tr.n / SR * 18))
    crackle[idx] = RNG.uniform(-1, 1, len(idx))
    tr.buf += 0.25 * lowpass(crackle, 4000) + 0.004 * lowpass(noise(tr.n), 1200)
    tr.write('chill')


if __name__ == '__main__':
    brawl()
    arcade()
    neon()
    funk()
    boss()
    chill()
