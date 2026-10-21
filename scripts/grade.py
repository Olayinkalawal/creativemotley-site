#!/usr/bin/env python3
""""Fresh daylight" grade for the chapter masters: a brightness study, not wired into the build.
One recipe for all six desktop masters (.art/masters-2026-10-20/<chapter>-desktop.png), tuned by eye against the
Shopify Editions reference frames (/home/user/ref-editions/review/visual-desktop/*_theirs.jpg). Steps, in CIE Lab (D65):
  1. craquelure: thin dark cracks are found with a grey closing of L and filled back in, gated so bold dark detail
     (pupils, outlines) and busy texture (hair, carpets, damask) are left alone;
  2. varnish cast: the yellow-amber cast is measured on the near-neutral pixels (stone, linen, sky, plaster) and
     pulled most of the way to a clean, faintly warm neutral; saturated colour and skin take only part of the shift;
  3. tone: a toe-preserving curve lifts shadows and mids (L 0 stays 0, so blacks keep their depth) and opens the
     whites a little;
  4. clarity: large-radius local contrast on L, faded out towards black and white;
  5. colour: gentle vibrance (low-chroma colour gains most, skin least) and a whisper of cool in neutral shadows.
The masters are read only: OUT_DIR must not be the masters folder, and an output never replaces an input.
  python3 scripts/grade.py OUT_DIR [IMAGE ...] [--scale S] [--suffix -graded]
  (no IMAGE: the six chapter desktop masters; --scale resizes before grading, e.g. 0.3333 for quick studies)
"""
import argparse
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage
from scipy.interpolate import PchipInterpolator

ROOT = Path(__file__).resolve().parent.parent
MASTERS = ROOT / '.art' / 'masters-2026-10-20'
CHAPTERS = ('storytellers', 'creators', 'brands', 'results', 'directors', 'apply')

# The recipe. Spatial sizes are for the 5504-px-wide masters and scale with the image width.
RECIPE = {
    'crack_close_px': 7,          # grey-closing footprint (diameter) that bridges the cracks
    'crack_preblur_px': 0.8,      # cracks are found on a lightly blurred L, so paint grain does not read as crack
    'crack_min': 0.8,             # residual (L units, on the blurred L) where crack filling starts...
    'crack_full': 2.6,            # ...and is at full strength
    'crack_bold': (14.0, 26.0),   # residual band where it fades out again (bold dark detail stays)
    'crack_texture': (2.5, 7.0),  # local std of L (closed) over which filling fades out (busy texture stays)
    'crack_strength': 0.8,
    'crack_skin': 0.35,           # on skin only this much of that (keeps the pores and paint grain)
    'neutral_chroma': 28.0,       # the cast is read off the lights: L > 45, chroma under this, no blues...
    'neutral_top': 70,            # ...the brightest 30% of them (what should be white has yellowed most)
    'cast_target': (0.6, 4.0),    # a*, b* the lights are pulled towards (a faintly warm, paper white)
    'cast_amount': 0.85,           # fraction of the measured cast removed
    'cast_axis_deg': 75.0,        # the varnish axis in a*b* (amber-yellow); only the cast along it is removed
    'cast_max': 17.0,             # largest shift along that axis
    'cast_tone_weight': (0.5, 1.2),   # share of the shift taken by the shadows (L* 12) and by the lights (L* 70+)
    'cast_keep_saturated': 0.65,  # saturated colour takes this fraction of the shift
    'cast_keep_skin': 0.3,        # skin takes this fraction
    'cast_keep_blue': 0.3,        # intended blues (skies, robes) take this fraction, or they turn electric
    'tone': ((0.0, 0.0), (0.03, 0.034), (0.10, 0.136), (0.25, 0.322), (0.45, 0.532), (0.65, 0.716),
             (0.85, 0.89), (0.95, 0.97), (1.0, 1.0)),
    'clarity_sigma_px': 36,
    'clarity': 0.24,
    'vibrance': 0.16,
    'vibrance_skin': 0.05,
    'cool_shadows': 1.6,          # b* taken out of neutral shadows
}

# ---- colour ------------------------------------------------------------------------------------------------------
_M = np.array([[0.4124564, 0.3575761, 0.1804375],
               [0.2126729, 0.7151522, 0.0721750],
               [0.0193339, 0.1191920, 0.9503041]], dtype=np.float32)
_MI = np.linalg.inv(_M).astype(np.float32)
_WP = np.array([0.95047, 1.0, 1.08883], dtype=np.float32)


def srgb_to_lab(rgb8):
    c = rgb8.astype(np.float32) / 255.0
    lin = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    del c
    xyz = (lin @ _M.T) / _WP
    del lin
    f = np.where(xyz > 216 / 24389, np.cbrt(xyz), (24389 / 27 * xyz + 16) / 116)
    del xyz
    L = 116 * f[..., 1] - 16
    a = 500 * (f[..., 0] - f[..., 1])
    b = 200 * (f[..., 1] - f[..., 2])
    return L.astype(np.float32), a.astype(np.float32), b.astype(np.float32)


def lab_to_srgb8(L, a, b):
    fy = (L + 16) / 116
    f = np.stack([fy + a / 500, fy, fy - b / 200], axis=-1)
    xyz = np.where(f > 6 / 29, f ** 3, (116 * f - 16) / (24389 / 27)) * _WP
    del f
    lin = np.clip(xyz @ _MI.T, 0, 1)
    del xyz
    c = np.where(lin <= 0.0031308, 12.92 * lin, 1.055 * np.power(lin, 1 / 2.4) - 0.055)
    return np.clip(np.round(c * 255), 0, 255).astype(np.uint8)


def smoothstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


def skin_weight(a, b, C):
    """1 on skin-like colour (orange-brown hues, moderate chroma), 0 elsewhere."""
    h = np.degrees(np.arctan2(b, a))
    return smoothstep(25, 38, h) * (1 - smoothstep(68, 82, h)) * smoothstep(8, 14, C) * (1 - smoothstep(42, 55, C))


# ---- the grade ---------------------------------------------------------------------------------------------------
def grade(rgb8, r=RECIPE, log=None, k=None):
    """rgb8: HxWx3 uint8. k: spatial scale against the 5504-px masters (default: from the width)."""
    h, w = rgb8.shape[:2]
    k = w / 5504.0 if k is None else k
    L, a, b = srgb_to_lab(rgb8)
    info = {}

    # 1. craquelure
    size = max(3, int(round(r['crack_close_px'] * k)) | 1)
    yy, xx = np.mgrid[-(size // 2):size // 2 + 1, -(size // 2):size // 2 + 1]
    disk = (xx * xx + yy * yy) <= (size / 2) ** 2
    closed = ndimage.grey_closing(L, footprint=disk)
    res = closed - L                                   # what filling adds
    pb = r['crack_preblur_px'] * k
    if pb >= 0.4:                                      # detection on a lightly blurred L (grain stays below threshold)
        Lb = ndimage.gaussian_filter(L, pb)
        det = ndimage.grey_closing(Lb, footprint=disk) - Lb
        del Lb
    else:
        det = res
    sig = max(1.0, 6 * k)
    m1 = ndimage.gaussian_filter(closed, sig)
    sd = np.sqrt(np.maximum(ndimage.gaussian_filter(closed * closed, sig) - m1 * m1, 0))
    del m1
    gate = (smoothstep(r['crack_min'], r['crack_full'], det) * (1 - smoothstep(*r['crack_bold'], res))
            * (1 - smoothstep(*r['crack_texture'], sd)))
    gate *= r['crack_strength'] * (1 - (1 - r['crack_skin']) * skin_weight(a, b, np.hypot(a, b)))
    L = L + res * gate
    # the cracks' brown, filled from the paint around them (normalised blur that ignores crack pixels)
    wgt = ndimage.gaussian_filter(1 - np.clip(gate * 1.5, 0, 1), sig)
    for ch in (a, b):
        bg = ndimage.gaussian_filter(ch * (1 - np.clip(gate * 1.5, 0, 1)), sig) / np.maximum(wgt, 1e-3)
        ch += gate * (bg - ch)
        del bg
    info['crack_px'] = float((gate * res > 2).mean())
    del closed, res, det, sd, gate, wgt

    # 2. varnish cast
    C = np.hypot(a, b)
    hue = np.degrees(np.arctan2(b, a)) % 360
    cand = (L > 45) & (C < r['neutral_chroma']) & ~((hue > 150) & (hue < 300))   # not the intended blues
    if cand.sum() < 500:
        cand = L >= np.percentile(L, 90)
    lights = cand & (L >= np.percentile(L[cand], r['neutral_top']))
    a0, b0 = float(np.median(a[lights])), float(np.median(b[lights]))
    del hue, cand, lights
    ux, uy = np.cos(np.radians(r['cast_axis_deg'])), np.sin(np.radians(r['cast_axis_deg']))
    along = (a0 - r['cast_target'][0]) * ux + (b0 - r['cast_target'][1]) * uy
    amt = float(np.clip(r['cast_amount'] * along, 0, r['cast_max']))   # only ever removes warmth
    da, db = float(-amt * ux), float(-amt * uy)
    info.update(cast=(round(a0, 1), round(b0, 1)), shift=(round(da, 1), round(db, 1)))
    sk = skin_weight(a, b, C)
    keep = 1 - (1 - r['cast_keep_saturated']) * smoothstep(16, 44, C)
    keep = keep * (1 - sk * (1 - r['cast_keep_skin']))
    keep = keep * (1 - (1 - r['cast_keep_blue']) * smoothstep(-1, -12, b))
    tw0, tw1 = r['cast_tone_weight']
    lw = tw0 + (tw1 - tw0) * smoothstep(12, 70, L)  # varnish yellows the lights most; shadows take less
    a = a + da * keep * lw
    b = b + db * keep * lw
    del keep, lw

    # 3. tone
    pts = np.array(r['tone'], dtype=np.float64)
    lut_x = np.linspace(0, 1, 4097)
    lut = PchipInterpolator(pts[:, 0], pts[:, 1])(lut_x).astype(np.float32)
    y = np.clip(L / 100, 0, 1)
    L = np.interp(y, lut_x, lut).astype(np.float32) * 100

    # 4. clarity
    base = ndimage.gaussian_filter(L, max(2.0, r['clarity_sigma_px'] * k))
    y = L / 100
    mid = np.clip(4 * y * (1 - y), 0, 1) ** 0.7
    L = np.clip(L + r['clarity'] * (L - base) * mid, 0, 100)
    del base, mid

    # 5. colour: vibrance, cool neutral shadows
    C = np.hypot(a, b)
    sk = skin_weight(a, b, C)
    v = r['vibrance'] * (1 - sk) + r['vibrance_skin'] * sk
    gain = 1 + v * (1 - smoothstep(10, 70, C))
    a *= gain
    b *= gain
    y = L / 100
    b -= r['cool_shadows'] * (1 - smoothstep(0.08, 0.45, y)) * (1 - smoothstep(10, 30, C)) * smoothstep(0.0, 0.05, y)
    del gain, v, sk, C

    out = lab_to_srgb8(L, a, b)
    if log is not None:
        log.update(info)
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('out_dir')
    ap.add_argument('images', nargs='*')
    ap.add_argument('--scale', type=float, default=1.0)
    ap.add_argument('--suffix', default='')
    args = ap.parse_args()

    out_dir = Path(args.out_dir).resolve()
    if out_dir == MASTERS.resolve() or MASTERS.resolve() in out_dir.parents:
        sys.exit('grade.py: refusing to write into the masters folder')
    srcs = [Path(p).resolve() for p in args.images] or [MASTERS / f'{c}-desktop.png' for c in CHAPTERS]
    out_dir.mkdir(parents=True, exist_ok=True)
    for src in srcs:
        dst = out_dir / f'{src.stem}{args.suffix}.png'
        if dst.resolve() == src or dst.resolve() in srcs:
            sys.exit(f'grade.py: refusing to overwrite an input ({dst})')
        im = Image.open(src).convert('RGB')
        if args.scale != 1.0:
            im = im.resize((round(im.width * args.scale), round(im.height * args.scale)), Image.LANCZOS)
        info = {}
        out = grade(np.asarray(im), log=info)
        Image.fromarray(out).save(dst, optimize=False, compress_level=3)
        print(f'{src.name} -> {dst}  cast a*,b* {info["cast"]}  shift {info["shift"]}  '
              f'crack fill > 2 L*: {info["crack_px"]:.2%} of pixels', flush=True)


if __name__ == '__main__':
    main()
