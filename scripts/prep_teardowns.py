"""Teardown videos → scroll-scrubbed frame sequences.

    python3 -I scripts/prep_teardowns.py <name> <video.mp4> [<name> <video.mp4> ...]

For each video (2560×1440, 24 fps, generated on a pure black void) writes
public/assets/teardown/<name>/{lg,sm}/f_0001.webp … plus poster.webp (the last frame,
used as the still when WebGL is off) and depth.png (MiDaS depth of the last frame, for
pointer parallax once the parts have settled). Compression noise in the black background
is crushed to true black so the frame melts into the stage.
"""
import os, sys, subprocess, tempfile, shutil
from multiprocessing import Pool
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'public', 'assets', 'teardown')
TIERS = (('lg', 1600, 74), ('sm', 960, 70))

def crush(im):
    a = np.asarray(im.convert('RGB')).astype(np.float32)
    lum = a.max(axis=2, keepdims=True)
    k = np.clip((lum - 3.0) / 6.0, 0, 1)        # ≤3 → black, ramps back in by 9
    return Image.fromarray((a * k).astype(np.uint8))

def work(args):
    src, name, i = args
    im = crush(Image.open(src))
    for tier, w, q in TIERS:
        d = os.path.join(OUT, name, tier)
        im.resize((w, round(im.height * w / im.width)), Image.LANCZOS).save(os.path.join(d, f'f_{i:04d}.webp'), 'WEBP', quality=q, method=6)
    return i

def prep(name, video):
    for tier, _, _ in TIERS:
        os.makedirs(os.path.join(OUT, name, tier), exist_ok=True)
    tmp = tempfile.mkdtemp()
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', video, os.path.join(tmp, 'f_%04d.png')], check=True)
    frames = sorted(f for f in os.listdir(tmp) if f.endswith('.png'))
    with Pool(4) as p:
        p.map(work, [(os.path.join(tmp, f), name, k + 1) for k, f in enumerate(frames)])
    last = crush(Image.open(os.path.join(tmp, frames[-1])))
    last.resize((1920, 1080), Image.LANCZOS).save(os.path.join(OUT, name, 'poster.webp'), 'WEBP', quality=82, method=6)
    last.resize((1920, 1080), Image.LANCZOS).save(os.path.join(tmp, 'last.png'))
    model = os.environ.get('MIDAS', '/home/user/models/midas_small.onnx')
    if os.path.exists(model):
        subprocess.run([sys.executable, '-I', os.path.join(ROOT, 'scripts', 'depth.py'), model, os.path.join(tmp, 'last.png'), os.path.join(OUT, name, 'depth.png'), '3'], check=True)
    shutil.rmtree(tmp)
    print(name, len(frames), 'frames')

args = sys.argv[1:]
for k in range(0, len(args), 2):
    prep(args[k], args[k + 1])
