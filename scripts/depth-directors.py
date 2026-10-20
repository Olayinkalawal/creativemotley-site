#!/usr/bin/env python3
"""Directors' desktop depth map, hand-layered (the 2026-10-20 master, "The Ambassadors' chairs").

MiDaS small sees the curtain, the stand and the chairs as one far plane and puts the whole range into the floor, so
the depth push would move only the pavement. This lays the map out by hand instead:
  - the curtain far (0.08 at the top -> 0.14 at the hem, v 0.775);
  - the stand, the kit and both chairs as one mid plane (0.40), found as the non-green shapes above the hem;
  - the floor from MiDaS, rescaled so the hem line sits at 0.38 (just behind the set) -> 1.0 at the bottom edge.
Edge-aware smoothed against the painting, written as <dir>/depth.webp (1920x1080 greyscale WebP q85, as
`art.py --depth` writes it), and the manifest's depth.bytes updated.

Run it after any `python3 scripts/art.py --depth ...` run that re-encodes directors (that writes the flat MiDaS map):
  python3 scripts/depth-directors.py [--dir public/assets/scenes/directors] [--model /home/user/models/midas_small.onnx]
Needs numpy, Pillow and OpenCV (cv2.ximgproc for the guided filter when present; a bilateral filter otherwise).
"""
import argparse
import json
import subprocess
import sys
import tempfile
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
ap.add_argument('--dir', default=str(ROOT / 'public' / 'assets' / 'scenes' / 'directors'))
ap.add_argument('--model', default='/home/user/models/midas_small.onnx')
a = ap.parse_args()
E = Path(a.dir)

img = np.asarray(Image.open(E / 'desktop-2048.webp').convert('RGB'))
H, W = img.shape[:2]
with tempfile.TemporaryDirectory() as t:
    subprocess.run([sys.executable, '-I', str(ROOT / 'scripts' / 'depth.py'), a.model,
                    str(E / 'desktop-2048.webp'), f'{t}/d.png', '3'], check=True, capture_output=True)
    mid = np.asarray(Image.open(f'{t}/d.png')).astype(np.float32) / 255
f = img.astype(np.int16)
R, G, B = f[..., 0], f[..., 1], f[..., 2]
green = G - np.maximum(R, B)
yy = np.mgrid[0:H, 0:W][0] / H
FL = 0.775                                                   # the curtain's hem meets the pavement here
furn = ((green < 4) & (yy < FL)).astype(np.uint8)            # above the floor line only; legs below it take the floor
furn[: int(0.25 * H)] = 0                                    # nothing of the set reaches the top quarter
furn[int(0.70 * H):, : int(0.36 * W)] = 0                    # the hem left of the left chair (u < 0.36) is curtain
furn = cv2.morphologyEx(furn, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
furn = cv2.morphologyEx(furn, cv2.MORPH_CLOSE, np.ones((21, 21), np.uint8))
n, lab, st, _ = cv2.connectedComponentsWithStats(furn, 8)
keep = np.zeros_like(furn)
for k in range(1, n):
    x, y, w, h, area = st[k]
    # the stand + kit and the two chairs (not stray dark folds of the curtain)
    if area > 4000 and w > 60 and h > 60 and area / (w * h) > 0.2 and y + h > 0.45 * H:
        keep[lab == k] = 1
keep = keep.astype(bool) & (yy < FL)
hem = mid[int(FL * H) + 4].mean()
floor = np.clip(0.38 + (mid - hem) * (0.62 / max(1e-3, 0.97 - hem)), 0.38, 1.0)
curtain = 0.08 + 0.06 * np.clip(yy / FL, 0, 1)
seam = np.clip((yy - (FL - 0.004)) / 0.008, 0, 1)            # soften the curtain/floor seam over ~0.8% of the height
d = curtain * (1 - seam) + np.maximum(floor, curtain) * seam
d = np.where(keep, 0.40, d).astype(np.float32)
try:
    d = cv2.ximgproc.guidedFilter(img, d, 8, 1e-3)
except Exception:
    d = cv2.bilateralFilter(d, 9, 0.1, 6)
d = cv2.GaussianBlur(d, (0, 0), 1.5)
g = Image.fromarray(np.clip(d * 255, 0, 255).astype(np.uint8)).resize((1920, 1080), Image.LANCZOS)
g.save(E / 'depth.webp', 'WEBP', quality=85, method=6)
mf = E / 'manifest.json'
man = json.loads(mf.read_text())
man['depth'] = dict(src='/assets/scenes/directors/depth.webp', w=1920, h=1080, bytes=(E / 'depth.webp').stat().st_size,
                    note='hand-layered: curtain far, stand + kit + chairs one mid plane, MiDaS floor (scripts/depth-directors.py)')
mf.write_text(json.dumps(man, indent=1, ensure_ascii=False) + '\n')
print('depth.webp', man['depth']['bytes'], 'B; mean', round(float(d.mean()), 3), 'set px', int(keep.sum()))
