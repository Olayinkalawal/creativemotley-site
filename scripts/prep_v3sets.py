"""v3 teardown sets: re-timed, subsampled frame sets for the scroll-scrubbed devices (Method, Kit).

    python3 -I scripts/prep_v3sets.py [name ...]        (default: the five devices)

For each device in public/assets/teardown/<name>/ this picks a subset of the existing frames (it never adds a frame:
the 97 orbit and 145 explode frames stay the source of truth) and writes public/assets/teardown/<name>/v3/:
  set.json      { orbit: { src: [source frame numbers, 1-based] }, explode: { src: [...], xmap: [e f e f ...] } }
                the frame maps the scene plays (src/gl/scenes/teardowns.js); the sm tier and browsers without AVIF read
                the original WebP files through the same maps, so nothing else is downloaded
  o/f_0001.avif …  the orbit subset, lg (1920×1080), AVIF   (only devices that open with an orbit)
  x/f_0001.avif …  the explode subset, lg (1600×900), AVIF
How frames are picked:
  - orbit: evenly spaced (the orbit renders are already re-timed to a constant visual speed);
  - explode: at equal steps of visual change (mean absolute difference of consecutive frames, at 240×135, plus a
    floor so a still stretch still takes some scroll), so frames are dense where the parts fly and sparse where they
    settle; xmap re-times playback the same way (explode progress → source frame fraction, 9 knots), so the parts
    spread at an even pace over the scroll instead of all at once at the start. A device whose render moves its
    camera mid-explode keeps its hand-tuned xmap (KEEP_XMAP).
AVIF from the lg WebP frames (quality 50: about half the bytes of the WebP at no visible loss on these renders).
Keyed devices (the Kit's, shown over a colour key) carry an alpha matte in their AVIF frames, and get alpha WebP stills
(v3/hero.webp, v3/poster.webp) for the DOM path: the renders are on a black void, so the void is the dark region
connected to the frame's border (plus any large enclosed dark region: the space under a headband), small enclosed
dark specks stay solid, and the alpha also carries a soft dark aura round the device (a contact shadow in the key, so a
near-black edge of the device never lets the colour through)."""
import os, sys, json
from multiprocessing import Pool
import numpy as np
from PIL import Image, ImageChops, ImageStat, ImageFilter
from scipy import ndimage as ndi

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TD = os.path.join(ROOT, 'public', 'assets', 'teardown')
# frames per set: Method's camera gets the longest orbit (it is the chapter's hero moment); the Kit plays one orbit
# (the console's) and four explodes
PLAN = {
    'camera': {'orbit': 48, 'explode': 48},
    'mixer': {'orbit': 32, 'explode': 36},
    'mic': {'explode': 36},
    'headphones': {'explode': 36},
    'phone': {'explode': 36},
}
KEEP_XMAP = {'mic': [0, 0, 0.12, 0.12, 0.42, 0.62, 1, 1]}   # its render pushes in on the capsule mid-way
KEYED = {'mixer', 'mic', 'headphones', 'phone'}               # shown over a colour key: frames carry alpha
Q = 50
FLOOR = 0.15   # share of the mean change added to every step (a still stretch still advances)

def diffs(path, n):
    prev, out = None, []
    for i in range(1, n + 1):
        im = Image.open(os.path.join(path, f'f_{i:04d}.webp')).convert('L').resize((240, 135))
        if prev is not None: out.append(ImageStat.Stat(ImageChops.difference(im, prev)).mean[0])
        prev = im
    return out

def curve(d):
    m = sum(d) / len(d)
    c = [0.0]
    for x in d: c.append(c[-1] + x + FLOOR * m)
    return [v / c[-1] for v in c]          # C[f], f = 0 … n-1 (0-based source frame) → 0 … 1

def inv(C, y):
    """source frame (float, 0-based) where the cumulative change reaches y"""
    for f in range(1, len(C)):
        if C[f] >= y:
            t = (y - C[f - 1]) / max(1e-9, C[f] - C[f - 1])
            return f - 1 + t
    return len(C) - 1.0

def pick(C, n):
    fr = sorted({round(inv(C, j / (n - 1))) for j in range(n)})
    # rounding can merge neighbours: top up with the frames that split the widest gaps
    while len(fr) < n:
        g = max(range(len(fr) - 1), key=lambda k: fr[k + 1] - fr[k])
        if fr[g + 1] - fr[g] < 2: break
        fr.insert(g + 1, (fr[g] + fr[g + 1]) // 2)
    return fr

def matte(im, t=3, big=0.0025, small=0.002):
    a = np.asarray(im.convert('RGB')).astype(np.int16)
    H, W = a.shape[:2]; N = H * W; sc = W / 1600
    dark = a.max(axis=2) <= t
    lab, n = ndi.label(dark)
    border = np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]])); border = border[border > 0]
    sizes = ndi.sum(dark, lab, range(1, n + 1)) if n else np.array([])
    void = np.isin(lab, np.union1d(border, np.nonzero(sizes > big * N)[0] + 1))
    dev = ndi.binary_closing(~void, iterations=2)
    holes = ndi.binary_fill_holes(dev) & ~dev
    hl, hn = ndi.label(holes)
    if hn:
        hs = ndi.sum(holes, hl, range(1, hn + 1)); dev |= np.isin(hl, np.nonzero(hs < small * N)[0] + 1)
    dev = ndi.binary_opening(dev, iterations=1)
    sharp = np.asarray(Image.fromarray((dev * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.7))).astype(np.float32)
    aura = np.asarray(Image.fromarray((ndi.binary_dilation(dev, iterations=max(1, int(10 * sc))) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(18 * sc))).astype(np.float32)
    return Image.fromarray(np.maximum(sharp, 0.9 * aura).astype(np.uint8))

def enc(job):
    src, dst, keyed = job
    if os.path.exists(dst) and os.path.getmtime(dst) > os.path.getmtime(src): return os.path.getsize(dst)
    im = Image.open(src).convert('RGB')
    if keyed:
        im = im.copy(); im.putalpha(matte(im))
    if dst.endswith('.webp'): im.save(dst, 'WEBP', quality=74, alpha_quality=60, method=6)   # the DOM stills
    else: im.save(dst, 'AVIF', quality=Q, speed=4)
    return os.path.getsize(dst)

def main(names):
    jobs, sets = [], {}
    for name in names:
        plan = PLAN[name]
        base = os.path.join(TD, name)
        out = os.path.join(base, 'v3')
        s = {}
        if 'orbit' in plan:
            n = plan['orbit']
            fr = sorted({round(j * 96 / (n - 1)) for j in range(n)})
            s['orbit'] = {'src': [f + 1 for f in fr]}
            os.makedirs(os.path.join(out, 'o'), exist_ok=True)
            jobs += [(os.path.join(base, 'orbit', 'lg', f'f_{f + 1:04d}.webp'), os.path.join(out, 'o', f'f_{k + 1:04d}.avif'), name in KEYED) for k, f in enumerate(fr)]
            if name in KEYED: s['orbit']['alpha'] = True
        C = curve(diffs(os.path.join(base, 'sm'), 145))
        fr = pick(C, plan['explode'])
        xmap = KEEP_XMAP.get(name) or [v for j in range(9) for v in (round(j / 8, 4), round(inv(C, j / 8) / 144, 4))]
        s['explode'] = {'src': [f + 1 for f in fr], 'xmap': xmap}
        os.makedirs(os.path.join(out, 'x'), exist_ok=True)
        jobs += [(os.path.join(base, 'lg', f'f_{f + 1:04d}.webp'), os.path.join(out, 'x', f'f_{k + 1:04d}.avif'), name in KEYED) for k, f in enumerate(fr)]
        if name in KEYED:
            s['explode']['alpha'] = True
            jobs += [(os.path.join(base, f'{st}.webp'), os.path.join(out, f'{st}.webp'), True) for st in ('hero', 'poster')]
        sets[name] = (out, s)
    with Pool(4) as p:
        sizes = p.map(enc, jobs)
    total = 0
    for name, (out, s) in sets.items():
        o = sum(os.path.getsize(os.path.join(out, 'o', f)) for f in os.listdir(os.path.join(out, 'o'))) if 'orbit' in s else 0
        x = sum(os.path.getsize(os.path.join(out, 'x', f)) for f in os.listdir(os.path.join(out, 'x')))
        if 'orbit' in s: s['orbit']['bytes'] = o
        s['explode']['bytes'] = x
        with open(os.path.join(out, 'set.json'), 'w') as fh: json.dump(s, fh, separators=(',', ':'))
        total += o + x
        print(f"{name}: orbit {len(s.get('orbit', {}).get('src', []))} frames {o / 1e6:.2f} MB, explode {len(s['explode']['src'])} frames {x / 1e6:.2f} MB")
    print(f'total {total / 1e6:.2f} MB')

if __name__ == '__main__':
    main(sys.argv[1:] or list(PLAN))
