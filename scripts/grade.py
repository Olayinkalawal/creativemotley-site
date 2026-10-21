#!/usr/bin/env python3
""""Fresh daylight" grade for the chapter masters (client-approved 2026-10-21 on qa/shots/v3-grade-study.jpg; live).
One recipe for every chapter master (.art/masters-2026-10-20/<chapter>-<desktop|phone>.png), tuned by eye against the
Shopify Editions reference frames (/home/user/ref-editions/review/visual-desktop/*_theirs.jpg). Steps, in CIE Lab (D65):
  1. craquelure: thin dark cracks are found with a grey closing of L and filled back in, gated so bold dark detail
     (pupils, outlines) and busy texture (hair, carpets, damask) are left alone;
  2. varnish cast: the yellow-amber cast is measured on the near-neutral pixels (stone, linen, sky, plaster) and
     pulled part of the way to a clean, faintly warm neutral; saturated colour and skin take only part of the shift;
  3. tone: a toe-preserving curve lifts shadows and mids (L 0 stays 0, so blacks keep their depth) and opens the
     whites a little;
  4. clarity: large-radius local contrast on L, faded out towards black and white;
  5. colour: gentle vibrance (low-chroma colour gains most, skin least) and a whisper of cool in neutral shadows.
RECIPE below is the approved one: it reproduces the study's graded masters bit for bit. Spatial sizes are in pixels of
the 5504 x 3072 masters and scale with the long side, so the 3072 x 5504 phone portraits take the same footprints.

The masters are read only. Outputs are new files named <stem><suffix>.png; an output never replaces an input or any
file that does not already carry the suffix, and writing into the masters folder needs a suffix.
  python3 scripts/grade.py --live          grade the live set into the masters folder as *-graded.png (below), add their
                                           sums to SHA256SUMS, then recut the paper-card crops from the graded files
  python3 scripts/grade.py --crops         only that last step: scripts/crops.py run on the *-graded.png sources
  python3 scripts/grade.py OUT_DIR [IMAGE ...] [--scale S] [--suffix -graded]     (studies; no IMAGE: the live set)
The live set: the six chapters' desktop and phone masters (scripts/art-masters.json points at their -graded files),
plus creators-desktop-v1.png and brands-desktop-v1.png, which scripts/crops.py cuts the paper cards from; those two
take the varnish shift measured on their chapter's live desktop master (the same paint, so the cards match it).
"""
import argparse
import hashlib
import importlib.util
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage
from scipy.interpolate import PchipInterpolator

ROOT = Path(__file__).resolve().parent.parent
MASTERS = ROOT / '.art' / 'masters-2026-10-20'
CHAPTERS = ('storytellers', 'creators', 'brands', 'results', 'directors', 'apply')
SUFFIX = '-graded'
# file -> the master whose measured varnish shift it borrows (None: its own)
LIVE = {f'{c}-{k}.png': None for c in CHAPTERS for k in ('desktop', 'phone')}
LIVE.update({'creators-desktop-v1.png': 'creators-desktop.png', 'brands-desktop-v1.png': 'brands-desktop.png'})

# The recipe (approved 2026-10-21). Spatial sizes are for the 5504-px masters and scale with the long side.
RECIPE = {
    'crack_close_px': 7,          # grey-closing footprint (diameter) that bridges the cracks
    'crack_preblur_px': 0.0,      # > 0.4: find the cracks on a lightly blurred L (off in the approved recipe)
    'crack_min': 1.0,             # residual (L units) where crack filling starts...
    'crack_full': 3.5,            # ...and is at full strength
    'crack_bold': (14.0, 26.0),   # residual band where it fades out again (bold dark detail stays)
    'crack_texture': (2.5, 7.0),  # local std of L (closed) over which filling fades out (busy texture stays)
    'crack_strength': 0.8,
    'crack_skin': 0.35,           # on skin only this much of that (keeps the pores and paint grain)
    'neutral_chroma': 28.0,       # the cast is read off the lights: L > 45, chroma under this, no blues...
    'neutral_top': 70,            # ...the brightest 30% of them (what should be white has yellowed most)
    'cast_target': (0.6, 4.0),    # a*, b* the lights are pulled towards (a faintly warm, paper white)
    'cast_amount': 0.5,           # fraction of the measured cast removed
    'cast_axis_deg': 75.0,        # the varnish axis in a*b* (amber-yellow); only the cast along it is removed
    'cast_max': 10.0,             # largest shift along that axis
    'cast_tone_weight': (0.6, 1.0),   # share of the shift taken by the shadows (L* 12) and by the lights (L* 70+)
    'cast_keep_saturated': 0.55,  # saturated colour takes this fraction of the shift
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


def measure_cast(L, a, b, C, r=RECIPE):
    """Median a*, b* of the lights among the near-neutral pixels (no intended blues)."""
    hue = np.degrees(np.arctan2(b, a)) % 360
    cand = (L > 45) & (C < r['neutral_chroma']) & ~((hue > 150) & (hue < 300))   # not the intended blues
    if cand.sum() < 500:
        cand = L >= np.percentile(L, 90)
    lights = cand & (L >= np.percentile(L[cand], r['neutral_top']))
    return float(np.median(a[lights])), float(np.median(b[lights]))


# ---- the grade ---------------------------------------------------------------------------------------------------
def grade(rgb8, r=RECIPE, log=None, k=None, shift=None):
    """rgb8: HxWx3 uint8. k: spatial scale against the 5504-px masters (default: from the long side).
    shift: (da, db) to use instead of the varnish shift measured on this image (see LIVE)."""
    h, w = rgb8.shape[:2]
    k = max(w, h) / 5504.0 if k is None else k
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
    a0, b0 = measure_cast(L, a, b, C, r)
    ux, uy = np.cos(np.radians(r['cast_axis_deg'])), np.sin(np.radians(r['cast_axis_deg']))
    if shift is None:
        along = (a0 - r['cast_target'][0]) * ux + (b0 - r['cast_target'][1]) * uy
        amt = float(np.clip(r['cast_amount'] * along, 0, r['cast_max']))   # only ever removes warmth
        da, db = float(-amt * ux), float(-amt * uy)
    else:
        da, db = (float(v) for v in shift)
    info.update(cast=(round(a0, 1), round(b0, 1)), shift=(round(da, 1), round(db, 1)), shift_exact=(da, db))
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


def sha256(p):
    h = hashlib.sha256()
    with open(p, 'rb') as f:
        while chunk := f.read(1 << 20):
            h.update(chunk)
    return h.hexdigest()


def update_sums(paths):
    """Add (or refresh) the outputs' lines in the masters' SHA256SUMS, keeping every other line as it is."""
    f = MASTERS / 'SHA256SUMS'
    rows = {}
    for line in f.read_text().splitlines():
        if line.strip():
            h, name = line.split(None, 1)
            rows[name.strip()] = h
    for p in paths:
        rows[p.name] = sha256(p)
    f.write_text(''.join(f'{rows[n]}  {n}\n' for n in sorted(rows)))


def check_masters(names):
    """The masters must still be the files SHA256SUMS lists (a graded file never replaces one)."""
    sums = dict(reversed(line.split(None, 1)) for line in (MASTERS / 'SHA256SUMS').read_text().splitlines() if line.strip())
    sums = {k.strip(): v for k, v in sums.items()}
    bad = [n for n in names if n in sums and sha256(MASTERS / n) != sums[n]]
    if bad:
        sys.exit(f'grade.py: masters differ from SHA256SUMS: {bad}')


def recut_crops(suffix=SUFFIX, preview=None):
    """scripts/crops.py, cut from the graded files (its SOURCE names the ungraded masters; patched here, not edited)."""
    spec = importlib.util.spec_from_file_location('crops', ROOT / 'scripts' / 'crops.py')
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    chapters = {v[0] for v in m.CROPS.values()}
    m.SOURCE = {ch: f"{Path(m.SOURCE.get(ch, f'{ch}-desktop.png')).stem}{suffix}.png" for ch in chapters}
    for ch, name in m.SOURCE.items():
        if not (MASTERS / name).exists():
            sys.exit(f'grade.py: {name} missing; run grade.py --live first')
        print(f'crops: {ch} from {name}')
    argv = sys.argv
    sys.argv = [argv[0]] + (['--preview', preview] if preview else [])
    try:
        m.main()
    finally:
        sys.argv = argv


def grade_file(src, dst, scale=1.0, shift=None):
    im = Image.open(src).convert('RGB')
    if scale != 1.0:
        im = im.resize((round(im.width * scale), round(im.height * scale)), Image.LANCZOS)
    info = {}
    out = grade(np.asarray(im), log=info, shift=shift)
    Image.fromarray(out).save(dst, optimize=False, compress_level=3)
    print(f'{src.name} -> {dst}  cast a*,b* {info["cast"]}  shift {info["shift"]}{" (borrowed)" if shift else ""}  '
          f'crack fill > 2 L*: {info["crack_px"]:.2%} of pixels', flush=True)
    return info


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('out_dir', nargs='?')
    ap.add_argument('images', nargs='*')
    ap.add_argument('--scale', type=float, default=1.0)
    ap.add_argument('--suffix', default='')
    ap.add_argument('--live', action='store_true', help='grade the live set into the masters folder, then recut crops')
    ap.add_argument('--crops', action='store_true', help='only recut the paper-card crops from the graded masters')
    ap.add_argument('--only', nargs='*', help='--live: just these files of the live set (e.g. apply-phone.png)')
    ap.add_argument('--preview', help='--live/--crops: also write crops.py\'s contact sheet here')
    args = ap.parse_args()

    if args.crops:
        recut_crops(preview=args.preview)
        return
    if args.live:
        names = args.only or list(LIVE)
        unknown = [n for n in names if n not in LIVE]
        if unknown:
            sys.exit(f'grade.py: not in the live set: {unknown}')
        check_masters(names + [v for n in names if (v := LIVE[n])])
        done, shifts = [], {}
        for name in names:
            src, dst = MASTERS / name, MASTERS / f'{Path(name).stem}{SUFFIX}.png'
            borrow = LIVE[name]
            if borrow and borrow not in shifts:    # the live master's shift, exactly as its own grade measures it
                info = {}
                grade(np.asarray(Image.open(MASTERS / borrow).convert('RGB')), log=info)
                shifts[borrow] = info['shift_exact']
            info = grade_file(src, dst, shift=shifts[borrow] if borrow else None)
            if not borrow:
                shifts[name] = info['shift_exact']
            done.append(dst)
        update_sums(done)
        print(f'SHA256SUMS: {len(done)} graded files added or refreshed')
        if not args.only or any(LIVE.get(n) for n in names):
            recut_crops(preview=args.preview)
        return

    if not args.out_dir:
        ap.error('OUT_DIR, --live or --crops')
    out_dir = Path(args.out_dir).resolve()
    in_masters = out_dir == MASTERS.resolve() or MASTERS.resolve() in out_dir.parents
    if in_masters and args.suffix != SUFFIX:
        sys.exit(f'grade.py: writing into the masters folder takes --suffix {SUFFIX} (or use --live)')
    srcs = [Path(p).resolve() for p in args.images] or [MASTERS / n for n in LIVE if not LIVE[n]]
    out_dir.mkdir(parents=True, exist_ok=True)
    for src in srcs:
        dst = out_dir / f'{src.stem}{args.suffix}.png'
        if dst.resolve() == src or dst.resolve() in srcs or (in_masters and src.stem.endswith(SUFFIX)):
            sys.exit(f'grade.py: refusing to overwrite an input ({dst})')
        grade_file(src, dst, scale=args.scale)


if __name__ == '__main__':
    main()
