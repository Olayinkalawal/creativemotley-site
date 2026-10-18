"""Orbit videos → scroll-scrubbed frame sequences that land on the teardown's first frame.

    python3 -I scripts/prep_orbits.py <name> <orbit.mp4> [<name> <orbit.mp4> ...]   [--count 97]

Each orbit video starts on the device's hero angle (the still the explode video also starts from)
and travels to another angle. The site plays it the other way round: from the far angle back to the
hero angle, then straight into the explode. So the frames are written in reverse, and re-timed to a
constant visual speed (generated camera moves ease in and out unevenly): output frames are picked at
equal steps of accumulated image change, blended 70/30 with equal steps of time so nothing holds.

Writes public/assets/teardown/<name>/orbit/{lg,sm}/f_0001.webp … (f_0001 = far angle, last = hero
angle) and public/assets/teardown/<name>/hero.webp (the hero angle at 1920 px, the still shown in
the opening when WebGL is off). Black is crushed to true black, as in prep_teardowns.py.
"""
import os, sys, subprocess, tempfile, shutil
from multiprocessing import Pool
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'public', 'assets', 'teardown')
TIERS = (('lg', 1920, 72), ('sm', 1080, 68))

def crush(im):
    a = np.asarray(im.convert('RGB')).astype(np.float32)
    lum = a.max(axis=2, keepdims=True)
    k = np.clip((lum - 3.0) / 6.0, 0, 1)
    return Image.fromarray((a * k).astype(np.uint8))

def work(args):
    src, name, i = args
    im = crush(Image.open(src))
    for tier, w, q in TIERS:
        im.resize((w, round(im.height * w / im.width)), Image.LANCZOS).save(os.path.join(OUT, name, 'orbit', tier, f'f_{i:04d}.webp'), 'WEBP', quality=q, method=6)
    return i

def retime(paths, count):
    small = [np.asarray(Image.open(p).convert('L').resize((160, 90), Image.BILINEAR)).astype(np.float32) for p in paths]
    d = np.array([0.0] + [np.abs(small[k] - small[k - 1]).mean() for k in range(1, len(small))])
    d = np.maximum(d, 1e-3)
    motion = np.cumsum(d); motion /= motion[-1]
    time = np.linspace(0, 1, len(paths))
    curve = 0.7 * motion + 0.3 * time            # monotone: frame index → 0..1 of visual progress
    picks = [int(np.argmin(np.abs(curve - t))) for t in np.linspace(0, 1, count)]
    picks[0], picks[-1] = 0, len(paths) - 1
    return picks

def prep(name, video, count):
    for tier, _, _ in TIERS:
        d = os.path.join(OUT, name, 'orbit', tier)
        shutil.rmtree(d, ignore_errors=True); os.makedirs(d)
    tmp = tempfile.mkdtemp()
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', video, os.path.join(tmp, 'f_%04d.png')], check=True)
    frames = [os.path.join(tmp, f) for f in sorted(os.listdir(tmp)) if f.endswith('.png')]
    picks = retime(frames, count)[::-1]           # far angle first, hero angle last
    with Pool(4) as p:
        p.map(work, [(frames[j], name, k + 1) for k, j in enumerate(picks)])
    crush(Image.open(frames[0])).resize((1920, 1080), Image.LANCZOS).save(os.path.join(OUT, name, 'hero.webp'), 'WEBP', quality=82, method=6)
    shutil.rmtree(tmp)
    print(name, len(frames), '→', count, 'frames')

args = sys.argv[1:]
count = 97
if '--count' in args:
    k = args.index('--count'); count = int(args[k + 1]); del args[k:k + 2]
for k in range(0, len(args), 2):
    prep(args[k], args[k + 1], count)
