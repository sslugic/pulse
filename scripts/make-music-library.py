"""Composes the jukebox's 24 downloadable tracks, in six 80s styles, with the instruments from
make-music.py. They're hosted on the Pulse website (sslugic/pulse-site, music/<file>.wav) and the app
downloads each one when it's first played, so they don't add to the app size.

Each spec sets key, chords, tempo and style; melodies come from the chords with a seeded generator
(a motif, then a varied answer), so every track has its own tune.
Run: python3 scripts/make-music-library.py <out-dir>   then copy the files into pulse-site/music/.
"""

import importlib.util
import os
import sys

import numpy as np

_spec = importlib.util.spec_from_file_location('make_music', os.path.join(os.path.dirname(__file__), 'make-music.py'))
_mm = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_mm)
(SR, Track, arp_pluck, bass_analog, bass_sub, bell, brass_stab, clap, drums_80s, echo, epiano, gated_snare,
                     hat, hz, juno_pad, lead, mixdown, tom, write) = (getattr(_mm, n) for n in (
    'SR', 'Track', 'arp_pluck', 'bass_analog', 'bass_sub', 'bell', 'brass_stab', 'clap', 'drums_80s', 'echo', 'epiano', 'gated_snare',
    'hat', 'hz', 'juno_pad', 'lead', 'mixdown', 'tom', 'write'))

NOTE = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']


def midi(name):
    return int(round(12 * np.log2(hz(name) / 440.0))) + 69


def nm(m):
    return f'{NOTE[m % 12]}{m // 12 - 1}'


def chord(root, kind):
    r = midi(root)
    iv = {'m': [0, 3, 7], 'M': [0, 4, 7], 'm7': [0, 3, 7, 10], 'M7': [0, 4, 7, 11], '7': [0, 4, 7, 10], 'sus': [0, 5, 7]}[kind]
    return [r + i for i in iv]


def melody(chords, bars_per, seed, density=0.5, octave=72):
    """A motif over the first half, answered (varied) over the second, using chord tones."""
    rng = np.random.default_rng(seed)
    total = len(chords) * bars_per * 4
    rhythm = []
    beat = 0.0
    while beat < total / 2:
        ln = rng.choice([0.5, 1, 1, 1.5, 2] if density > 0.5 else [1, 1.5, 2, 2, 3])
        if rng.random() < 0.85:
            rhythm.append((beat, ln))
        beat += ln
    notes = []
    for half in (0, 1):
        for beat, ln in rhythm:
            b = beat + half * total / 2
            if b >= total:
                continue
            ch = chords[int(b // (bars_per * 4)) % len(chords)]
            tones = [octave + (c % 12) for c in ch]
            pick = tones[int(rng.integers(len(tones)))]
            if half and rng.random() < 0.35:
                pick += rng.choice([-2, 2])  # the answer bends a few notes
            notes.append((b, ln, pick))
    return notes


def place(tr, bus, notes, inst, vol):
    for b, ln, m in notes:
        bar, beat = divmod(b, 4)
        tr.add(bus, tr.at(int(bar), beat), inst(440 * 2 ** ((m - 69) / 12), tr.dur(ln)), vol)


def build(spec):
    bpm, bars_per = spec['bpm'], spec.get('bars_per', 2)
    chords = [chord(r, k) for r, k in spec['chords']]
    loops = 16 // (len(chords) * bars_per)
    tr = Track(bpm, 16)
    style = spec['style']
    for rep in range(loops):
        for i, ch in enumerate(chords):
            bar = (rep * len(chords) + i) * bars_per
            pad_notes = [nm(c) for c in ch]
            tr.add('pad', tr.at(bar, 0), juno_pad(pad_notes, tr.dur(4 * bars_per, 1.0), spec.get('pad_cut', 1700)), spec.get('pad_vol', 0.4))
            root = 440 * 2 ** ((ch[0] - 12 * spec.get('bass_down', 2) - 69) / 12)
            steps = 4 * bars_per
            if style in ('synthwave', 'outrun', 'italo'):
                for s in range(steps * 4):
                    if style == 'outrun' and s % 4 == 1:
                        continue
                    f = root * (2 if (s % 2 and style != 'outrun') else 1)
                    tr.add('bass', tr.at(bar, s * 0.25), bass_analog(f, tr.dur(0.25, 0.75), spec.get('bass_cut', 750), 0.07), 0.5)
            elif style in ('darkwave', 'montage'):
                pat = spec.get('pattern', [0, 0, 7, 0, 3, 0, 7, 10])
                for s in range(steps * 2):
                    f = root * 2 ** (pat[s % len(pat)] / 12)
                    tr.add('bass', tr.at(bar, s * 0.5), bass_analog(f, tr.dur(0.5, 0.8), spec.get('bass_cut', 560), 0.15), 0.55)
            else:  # chill
                for b, mul in ((0, 1), (2.5, 1), (4, 1.5), (6, 1)):
                    if b < steps:
                        tr.add('bass', tr.at(bar, b), bass_sub(root * mul, tr.dur(1.2)), 0.6)
            if spec.get('arp'):
                tones = [440 * 2 ** ((c + 12 - 69) / 12) for c in ch] + [440 * 2 ** ((ch[1] + 24 - 69) / 12)]
                order = spec.get('arp_order', [0, 1, 2, 3])
                for s in range(steps * 4):
                    tr.add('arp', tr.at(bar, s * 0.25), arp_pluck(tones[order[s % len(order)]], tr.dur(0.25, 0.6), spec.get('arp_cut', 2800)), 0.15)
            if spec.get('stabs'):
                for b in spec['stabs']:
                    if b < steps:
                        tr.add('lead', tr.at(bar, b), brass_stab([nm(c + 12) for c in ch], tr.dur(0.75)), 0.3)
            if spec.get('keys'):
                for b in (0, 1.5, 3, 4, 5.5, 7):
                    if b < steps:
                        for c in ch:
                            tr.add('arp', tr.at(bar, b), epiano(440 * 2 ** ((c + 12 - 69) / 12), tr.dur(1.5)), 0.08)
    # Drums
    for bar in range(16):
        if style == 'italo':
            for b in range(4):
                tr.kick(bar, b, 0.9)
                tr.add('drums', tr.at(bar, b + 0.5), hat(True), 0.14)
            tr.add('drums', tr.at(bar, 1), clap(), 0.5)
            tr.add('drums', tr.at(bar, 3), clap(), 0.5)
        elif style == 'chill':
            tr.kick(bar, 0, 0.75)
            tr.kick(bar, 2.5, 0.55)
            tr.add('drums', tr.at(bar, 1), gated_snare(), 0.38)
            tr.add('drums', tr.at(bar, 3), gated_snare(), 0.38)
            for h in range(8):
                tr.add('drums', tr.at(bar, h * 0.5), hat(), 0.08)
        elif style == 'darkwave':
            tr.kick(bar, 0, 0.9)
            tr.kick(bar, 2, 0.9)
            tr.add('drums', tr.at(bar, 1), clap(), 0.5)
            tr.add('drums', tr.at(bar, 3), gated_snare(), 0.6)
            for h in range(8):
                tr.add('drums', tr.at(bar, h * 0.5), hat(), 0.11 if h % 2 else 0.18)
        else:
            drums_80s(tr, bar, fill=bar % (4 if style == 'montage' else 8) == (3 if style == 'montage' else 7))
            if style == 'outrun':
                tr.kick(bar, 2.75, 0.55)
    # Lead or bells
    tune = melody(chords * loops, bars_per, spec['seed'], spec.get('density', 0.5), spec.get('octave', 72))
    if spec.get('lead', True):
        inst = bell if spec.get('bells') else (lambda f, n: lead(f, n, spec.get('lead_cut', 3200)))
        start = spec.get('lead_from', 8)
        place(tr, 'lead', [(b, ln, m) for b, ln, m in tune if b >= start * 4], inst, 0.28 if not spec.get('bells') else 0.3)
        tr.bus['lead'] = echo(tr.bus['lead'], tr.beat * spec.get('echo', 0.75), 0.38, 4, 3000)
    if np.any(tr.bus['arp']) and spec.get('arp'):
        tr.bus['arp'] = echo(tr.bus['arp'], tr.beat * 0.75, 0.25, 2, 4000)
    duck = {'synthwave': 0.45, 'outrun': 0.4, 'italo': 0.5, 'darkwave': 0.3, 'montage': 0.35, 'chill': 0.2}[style]
    verb = {'pad': (2.8, 0.38), 'lead': (2.2, 0.3), 'arp': (2.0, 0.3), 'drums': (1.2, 0.13)}
    return mixdown(tr, {'drums': 0.85 if style != 'chill' else 0.7, 'bass': 0.85, 'pad': 0.75, 'arp': 0.7, 'lead': 0.8}, verb, duck)


SPECS = {
    # Synthwave
    '07-sunset-boulevard': dict(style='synthwave', bpm=96, chords=[('D3', 'M7'), ('B2', 'm7'), ('G2', 'M7'), ('A2', '7')], seed=7),
    '08-coastline-1986': dict(style='synthwave', bpm=102, chords=[('E3', 'm'), ('C3', 'M'), ('G3', 'M'), ('D3', 'M')], seed=8, arp=True),
    '09-palm-static': dict(style='synthwave', bpm=90, chords=[('F3', 'm'), ('Db3', 'M'), ('Ab2', 'M'), ('Eb3', 'M')], seed=9, density=0.3),
    '10-afterglow-highway': dict(style='synthwave', bpm=104, chords=[('B2', 'm'), ('G2', 'M'), ('D3', 'M'), ('A2', 'M')], seed=10, arp=True, arp_order=[0, 2, 1, 3]),
    # Darkwave
    '11-rain-city': dict(style='darkwave', bpm=88, chords=[('C3', 'm'), ('C3', 'm'), ('Ab2', 'M'), ('Bb2', 'M')], seed=11, bells=True, pattern=[0, 0, 7, 0, 3, 0, 10, 7]),
    '12-black-ice': dict(style='darkwave', bpm=96, chords=[('E3', 'm'), ('E3', 'm'), ('C3', 'M'), ('B2', '7')], seed=12, pattern=[0, 12, 0, 7, 0, 12, 3, 7], lead_cut=2200),
    '13-signal-lost': dict(style='darkwave', bpm=84, chords=[('G2', 'm'), ('Eb3', 'M'), ('F2', 'M'), ('D3', 'm')], seed=13, bells=True, pad_cut=1000),
    '14-cold-circuit': dict(style='darkwave', bpm=100, chords=[('A2', 'm'), ('F2', 'M'), ('D3', 'm'), ('E3', 'M')], seed=14, arp=True, arp_cut=2000, lead=False),
    # Outrun
    '15-turbo-nights': dict(style='outrun', bpm=126, chords=[('A3', 'm'), ('F3', 'M'), ('G3', 'M'), ('E3', 'M')], seed=15, arp=True),
    '16-redline': dict(style='outrun', bpm=132, chords=[('D3', 'm'), ('Bb2', 'M'), ('C3', 'M'), ('A2', 'M')], seed=16, arp=True, density=0.7, lead_from=4),
    '17-pursuit': dict(style='outrun', bpm=124, chords=[('F#3', 'm'), ('D3', 'M'), ('E3', 'M'), ('C#3', 'M')], seed=17, stabs=[0, 1.5, 3, 4.5, 6]),
    '18-overdrive': dict(style='outrun', bpm=130, chords=[('G3', 'm'), ('Eb3', 'M'), ('F3', 'M'), ('D3', '7')], seed=18, arp=True, arp_order=[0, 1, 2, 1, 3, 2]),
    # Italo / electro-disco
    '19-mirrorball': dict(style='italo', bpm=114, chords=[('A3', 'm'), ('D3', 'm'), ('G3', 'M'), ('C3', 'M')], seed=19, arp=True),
    '20-laser-disco': dict(style='italo', bpm=118, chords=[('C#3', 'm'), ('A2', 'M'), ('E3', 'M'), ('B2', 'M')], seed=20, arp=True, arp_order=[0, 3, 1, 2]),
    '21-strobe': dict(style='italo', bpm=110, chords=[('G3', 'm'), ('Bb2', 'M'), ('F3', 'M'), ('C3', 'M')], seed=21, stabs=[0.5, 2.5, 4.5, 6.5]),
    '22-velvet-tape': dict(style='italo', bpm=108, chords=[('E3', 'm7'), ('A2', '7'), ('D3', 'M7'), ('B2', '7')], seed=22, keys=True, arp=True, arp_cut=2000),
    # Training montage
    '23-last-round': dict(style='montage', bpm=116, chords=[('D3', 'm'), ('Bb2', 'M'), ('C3', 'M'), ('A2', 'M')], seed=23, stabs=[0, 1.5, 3, 4.5, 6], pattern=[0] * 8),
    '24-uphill': dict(style='montage', bpm=120, chords=[('E3', 'M'), ('C#3', 'm'), ('A2', 'M'), ('B2', 'M')], seed=24, stabs=[0, 2, 4, 6], pattern=[0, 0, 0, 0, 7, 7, 5, 5]),
    '25-champion-code': dict(style='montage', bpm=112, chords=[('G2', 'm'), ('D3', 'm'), ('Eb3', 'M'), ('F2', 'M')], seed=25, stabs=[0, 1.5, 3], pattern=[0, 0, 12, 0, 0, 0, 12, 7]),
    '26-no-retreat': dict(style='montage', bpm=124, chords=[('B2', 'm'), ('G2', 'M'), ('A2', 'M'), ('F#2', 'M')], seed=26, stabs=[0, 0.75, 1.5, 4, 4.75, 5.5], pattern=[0] * 8, lead_from=4),
    # Retro chill
    '27-pastel-skyline': dict(style='chill', bpm=82, chords=[('D3', 'M7'), ('E3', 'm7'), ('F#3', 'm7'), ('G3', 'M7')], seed=27, keys=True, bells=True, density=0.3),
    '28-late-show': dict(style='chill', bpm=86, chords=[('A2', 'm7'), ('D3', '7'), ('G2', 'M7'), ('C3', 'M7')], seed=28, keys=True, lead_cut=2000, density=0.3),
    '29-slow-burn': dict(style='chill', bpm=78, chords=[('C3', 'm7'), ('Ab2', 'M7'), ('Eb3', 'M7'), ('Bb2', '7')], seed=29, keys=True, lead=False),
    '30-vapor-lounge': dict(style='chill', bpm=80, chords=[('E3', 'M7'), ('C#3', 'm7'), ('A2', 'M7'), ('B2', 'sus')], seed=30, bells=True, pad_cut=1300, density=0.3),
}

if __name__ == '__main__':
    out = sys.argv[1]
    only = sys.argv[2:] or list(SPECS)
    for name in only:
        x = build(SPECS[name])
        write(os.path.join(out, f"{name.split('-', 1)[1]}.wav"), x)
        print(name, f'{len(x) / SR:.1f}s')
