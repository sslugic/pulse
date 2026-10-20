"""Synthesizes Pulse's sound effects (8-bit chiptune), so the app ships its own audio with no licensing
to worry about. The music loops are made by scripts/make-music.py.

Run: python3 scripts/make-sounds.py   (needs numpy; macOS afconvert turns the WAVs into .m4a)
Writes assets/audio/{chest,reward,fanfare,nudge}.m4a
"""

import os
import subprocess
import tempfile
import wave

import numpy as np

SR = 44100
OUT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'audio')


def freq(note: str) -> float:
    """'A4', 'C#5', 'Eb3' -> Hz."""
    names = {'C': -9, 'D': -7, 'E': -5, 'F': -4, 'G': -2, 'A': 0, 'B': 2}
    n = names[note[0]]
    rest = note[1:]
    if rest[0] == '#':
        n += 1
        rest = rest[1:]
    elif rest[0] == 'b':
        n -= 1
        rest = rest[1:]
    octave = int(rest)
    return 440.0 * 2 ** ((n + (octave - 4) * 12) / 12)


def env(n: int, attack=0.005, decay=0.08, sustain=0.6, release=0.05) -> np.ndarray:
    a = max(1, int(attack * SR))
    d = max(1, int(decay * SR))
    r = max(1, int(release * SR))
    s = max(0, n - a - d - r)
    return np.concatenate([
        np.linspace(0, 1, a),
        np.linspace(1, sustain, d),
        np.full(s, sustain),
        np.linspace(sustain, 0, r),
    ])[:n]


def square(f: float, n: int, duty=0.5) -> np.ndarray:
    t = np.arange(n) / SR
    return np.where((t * f) % 1 < duty, 1.0, -1.0)


def triangle(f: float, n: int) -> np.ndarray:
    t = np.arange(n) / SR
    return 2 * np.abs(2 * ((t * f) % 1) - 1) - 1


def noise(n: int, seed=0) -> np.ndarray:
    return np.random.default_rng(seed).uniform(-1, 1, n)


def place(buf: np.ndarray, start: int, sig: np.ndarray):
    end = min(len(buf), start + len(sig))
    buf[start:end] += sig[: end - start]


def write(name: str, data: np.ndarray, peak=0.85, lossless=False):
    data = data / (np.max(np.abs(data)) or 1) * peak
    pcm = (data * 32767).astype(np.int16)
    os.makedirs(OUT, exist_ok=True)
    if lossless:
        # The music loop stays PCM: AAC adds priming silence, which would leave a gap at each repeat.
        dst = os.path.join(OUT, f'{name}.wav')
        with wave.open(dst, 'wb') as w:
            w.setnchannels(1)
            w.setsampwidth(2)
            w.setframerate(SR)
            w.writeframes(pcm.tobytes())
        print('wrote', os.path.relpath(dst))
        return
    with tempfile.TemporaryDirectory() as tmp:
        wav = os.path.join(tmp, f'{name}.wav')
        with wave.open(wav, 'wb') as w:
            w.setnchannels(1)
            w.setsampwidth(2)
            w.setframerate(SR)
            w.writeframes(pcm.tobytes())
        dst = os.path.join(OUT, f'{name}.m4a')
        subprocess.run(['afconvert', '-f', 'm4af', '-d', 'aac', '-b', '96000', wav, dst], check=True)
    print('wrote', os.path.relpath(dst))


# ---------- Sound effects ----------

def seq(notes, dur, duty=0.25, vol=0.6, gap=0.0):
    out = np.zeros(int((dur + gap) * len(notes) * SR + 0.3 * SR))
    for i, note in enumerate(notes):
        n = int(dur * SR)
        place(out, int(i * (dur + gap) * SR), vol * square(freq(note), n, duty) * env(n, decay=0.06, sustain=0.5, release=0.03))
    return out


def sparkle(start_s: float, length_s: float, total: np.ndarray, seed=1):
    rng = np.random.default_rng(seed)
    for _ in range(14):
        t0 = start_s + rng.uniform(0, length_s)
        n = int(0.05 * SR)
        f = rng.uniform(2200, 4200)
        place(total, int(t0 * SR), 0.12 * square(f, n, 0.5) * np.exp(-np.arange(n) / SR * 60))


def chest():
    # Creak (low noise sweep), then a bright rising arpeggio with sparkles.
    total = np.zeros(int(1.4 * SR))
    n = int(0.25 * SR)
    t = np.arange(n) / SR
    creak = noise(n, 7) * (0.4 + 0.6 * np.sin(2 * np.pi * 18 * t)) * np.exp(-t * 6)
    place(total, 0, 0.25 * creak)
    place(total, int(0.22 * SR), seq(['C5', 'E5', 'G5', 'C6', 'E6', 'G6'], 0.06, duty=0.25, vol=0.55))
    place(total, int(0.6 * SR), 0.5 * square(freq('C7'), int(0.35 * SR), 0.5) * env(int(0.35 * SR), decay=0.2, sustain=0.2, release=0.1))
    sparkle(0.6, 0.6, total)
    write('chest', total)


def reward():
    # Classic coin pickup: B5 then E6.
    total = np.zeros(int(0.45 * SR))
    n1 = int(0.07 * SR)
    place(total, 0, 0.6 * square(freq('B5'), n1, 0.5) * env(n1, sustain=0.8))
    n2 = int(0.32 * SR)
    place(total, n1, 0.6 * square(freq('E6'), n2, 0.5) * env(n2, decay=0.25, sustain=0.0, release=0.05))
    write('reward', total)


def fanfare():
    # Level up / challenge won: da-da-da-DAAA.
    total = np.zeros(int(1.3 * SR))
    for i, (note, d) in enumerate([('G5', 0.1), ('G5', 0.1), ('G5', 0.1)]):
        n = int(d * SR)
        place(total, int(i * 0.13 * SR), 0.5 * square(freq(note), n, 0.25) * env(n, sustain=0.7))
    n = int(0.7 * SR)
    for note, duty in [('C6', 0.25), ('E5', 0.5), ('G5', 0.125)]:
        place(total, int(0.42 * SR), 0.3 * square(freq(note), n, duty) * env(n, decay=0.3, sustain=0.5, release=0.2))
    sparkle(0.45, 0.6, total, seed=3)
    write('fanfare', total)


def nudge():
    # Two quick bouncy blips.
    total = np.zeros(int(0.35 * SR))
    for i, note in enumerate(['E5', 'A5']):
        n = int(0.08 * SR)
        place(total, int(i * 0.11 * SR), 0.55 * square(freq(note), n, 0.25) * env(n, sustain=0.6))
    write('nudge', total)


if __name__ == '__main__':
    chest()
    reward()
    fanfare()
    nudge()
