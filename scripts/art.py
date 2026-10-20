#!/usr/bin/env python3
"""Chapter paintings -> responsive encodes + per-chapter manifests (v3 plan section 6).

Usage
  python3 scripts/art.py                  fetch the masters (cached) and encode every chapter
  python3 scripts/art.py creators brands  only these chapters (the contact sheet still covers all)
  python3 scripts/art.py --sheet          rebuild only the contact sheet from the files on disk
  python3 scripts/art.py --fast           quicker encoder speed (for trying settings; ship without it)

Staging (none of these change the default run above)
  --out DIR          write <DIR>/<chapter>/..., <DIR>/index.json and the sheet (<DIR>/art-sheet.jpg) there instead
                     of public/assets/scenes and qa/shots/v3-art-sheet.jpg. Manifest URLs stay /assets/scenes/...,
                     so a staged chapter folder can be copied into public/assets/scenes as it is.
  --config FILE      JSON {chapter: cfg} whose entries replace the built-in CHAPTERS entries (same fields as below,
                     plus the optional extras listed after CHAPTERS). With --config and no chapter names, only the
                     config's chapters are encoded and put on the sheet. A src may be a local file path.
  --sheet-path FILE  where to write the contact sheet.
  --depth MODEL      also write <chapter>/depth.webp: MiDaS (scripts/depth.py with this ONNX model) on desktop-2048,
                     stored as a 1920x1080 greyscale WebP q85, as the live set's depth maps were made by hand.
  e.g. python3 scripts/art.py --config masters.json --out /tmp/encoded --sheet-path qa/shots/x.jpg --depth m.onnx

Live masters (2026-10-20, "Masters, modernised")
  Storytellers, Creators, Brands, Results, Directors and Apply are the local retouches listed in
  scripts/art-masters.json (src "repo:.art/masters-2026-10-20/<chapter>-<desktop|phone>.png"; .art/ is git-ignored,
  check the files against .art/masters-2026-10-20/SHA256SUMS). Rebuild them with
    python3 scripts/art.py --config scripts/art-masters.json --depth /home/user/models/midas_small.onnx
    python3 scripts/depth-directors.py      (Directors' depth map is hand-layered; MiDaS flattens the set)
  A run without --config and without --out applies that file too, so it never restores the phase-1 paintings below.
  A src of the form "repo:<path>" is read relative to the repo root.

Inputs
  The 4K masters are Higgsfield results on d8j0ntlcm91z4.cloudfront.net (job ids in docs/art-log.md);
  Results' desktop master is the existing 1920 px plate in the repo. Downloads are cached in $ART_CACHE
  (default ~/.cache/cm-art), so a re-run only re-encodes.

Outputs (per chapter, in public/assets/scenes/<chapter>/)
  desktop-2048.avif  desktop-2880.avif  desktop-2048.webp  desktop-2880.webp   16:9, cut from the 16:9 master
  phone-1640.avif    phone-1170.avif    phone-828.avif   (and .webp)          1640x2916 / 1170x2080 / 828x1472, the
                                                                              whole separate 9:16 portrait master
  manifest.json      {desktop:{avif:[...],webp:[...]}, phone:{...}, focus, phoneFocus, titleSide, phoneTitle,
                      key, titleBg, titleInk, placeholder, credit}
  plus qa/shots/v3-art-sheet.jpg (every chapter, decoded from the AVIFs, with sizes).

Quality: for every file the encoder takes the highest quality (up to a per-format ceiling chosen by eye) that
fits the file's byte budget. Before encoding, a faint triangular dither (+-0.5 of one 8-bit step, fixed seed) is
added to the downscaled image: it costs almost nothing and stops the encoders from posterising long smooth
gradients (Apply's dawn sky, the indigo dark in Directors, the night in Storytellers) into bands.
"""
from __future__ import annotations

import argparse
import base64
import io
import json
import os
import sys
import time
import urllib.request
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'public' / 'assets' / 'scenes'
SHEET = ROOT / 'qa' / 'shots' / 'v3-art-sheet.jpg'
MASTERS = ROOT / 'scripts' / 'art-masters.json'   # the live masters of six chapters (see main)
CACHE = Path(os.environ.get('ART_CACHE', Path.home() / '.cache' / 'cm-art'))
CDN = 'https://d8j0ntlcm91z4.cloudfront.net/user_3E2nAh6VQJhvRG2v3D2ZPRAoWM4/'
URL_ROOT = '/assets/scenes'
STAGED = False        # --config: also report scrims and the art notes in each manifest
DEPTH_MODEL = None    # --depth: the MiDaS ONNX model, when depth maps are wanted

DESKTOP = (16, 9)
PHONE = (9, 16)       # see below: phones get the whole 9:16 portrait master, 1170x2080 and 828x1472
INK = (11, 8, 5)      # --ink, the site's dark (theme-color #0B0805)

# Why 9:16 and not 1170x2532: 2532 px is the whole iPhone screen, status bar included, which a page never gets.
# The canvas a phone browser actually shows is 0.49-0.59 wide-per-tall (Safari with its bars ~390x664 = 0.59,
# bars collapsed ~0.52; Chrome Android ~0.49-0.52). A 0.462 file would be cut top and bottom on most of them,
# eating the title zone or the subject; a 9:16 (0.5625) file is cover-fit with at most a few percent off the
# sides, and on the tallest screens the engine trims the sides around phoneFocus. It is also ~18% fewer pixels.

# Byte budgets (KB) and quality ceilings. Budgets come from the plan's first-load targets
# (desktop <= 1.5 MB, phone <= 1.0 MB with the shell): one desktop scene <= 250 KB at 2048 px, one phone
# scene <= 180 KB at 1170 px. Ceilings were set by eye: above them the files grow with no visible gain.
# 3840 (opt-in per chapter, desktop.widths): for chapters whose keys zoom past ~1.35, so a 2x desktop (a 2880 canvas)
# is not upscaled; only 2x screens fetch it (gl/scenes/plates.js picks the smallest width that covers the canvas at
# the deepest zoom). 1640 portrait: tablets held upright (820 px wide at 2x) and 3x large phones; the stills path picks
# it only when the 1170 would be stretched, so the phone budget is unchanged.
BUDGET = {
    ('desktop', 'avif', 2048): 250, ('desktop', 'avif', 2880): 440, ('desktop', 'avif', 3840): 760,
    ('desktop', 'webp', 2048): 380, ('desktop', 'webp', 2880): 700, ('desktop', 'webp', 3840): 1200,
    ('phone', 'avif', 1640): 300, ('phone', 'avif', 1170): 180, ('phone', 'avif', 828): 100,
    ('phone', 'webp', 1640): 420, ('phone', 'webp', 1170): 270, ('phone', 'webp', 828): 150,
}
PHONE_WIDTHS = (1640, 1170, 828)
QMAX = {'avif': 72, 'webp': 86}
QMIN = {'avif': 36, 'webp': 58}

# Title zones as (x0, y0, x1, y1) fractions of the delivered frame. Every new painting keeps its left third calm;
# two older paintings were composed before that rule and get their calm zone named instead.
TITLE_BOX = {
    'left': (0.0, 0.18, 0.33, 0.82),        # desktop default: the left third
    'top': (0.02, 0.03, 0.62, 0.30),        # desktop Results: the sky above the three figures
    'phone-top': (0.06, 0.04, 0.94, 0.30),  # phone default: the top of the frame
    'phone-left': (0.04, 0.24, 0.48, 0.50), # phone hero: the cloud bank left of the flying woman
}

# One entry per painted chapter.
#   focus       the subject's centre in the 16:9 frame (x, y as fractions), for cover-fit and camera keys
#   phoneFocus  the same in the 9:16 frame; x is also where to centre a side trim on very tall screens
#   titleSide   desktop title zone (TITLE_BOX): the left third, kept calm in every new painting
#   phoneTitle  phone title zone: the top of the frame (hero: the cloud bank at the left, mid-height)
#   key         the chapter's colour key (its identity hue, for chrome accents and the loading fill)
J = lambda name: CDN + name
# The v3 phase-1 paintings. Since 2026-10-20 only the hero entry is live: the other six chapters are the masters in
# scripts/art-masters.json (applied over these entries, see main); their entries stay here as the record of the
# phase-1 set (Results' 1920 px plate, public/assets/plates/results.webp, is gone with its film).
CHAPTERS = {
    'hero': dict(
        name='Hero: the Creation, with kit',
        desktop=dict(src=J('hf_20261019_142040_3845158a-ef49-4dab-ab1c-02e035ba9786.png'),
                     note='live film frame f_0001 (creativemotley.com/frames/f_0001.webp), 4K upscale, job 3845158a'),
        phone=dict(src=J('hf_20261019_141525_e51061e5-0798-4b21-aaf5-03963ff094e4.png'),
                   note='portrait recomposition of the hero painting, job e51061e5'),
        focus=[0.5, 0.45], phoneFocus=[0.56, 0.55], phoneTitle='left', key='#C8643C'),
    'storytellers': dict(
        name='I Storytellers: the three, out of the night',
        desktop=dict(src=J('hf_20261019_142042_0f6104cd-93d1-4121-bbc6-b31298b984ea.png'),
                     note='live film frame f_0570 (creativemotley.com/frames/f_0570.webp), 4K upscale, job 0f6104cd'),
        phone=dict(src=J('hf_20261019_141526_89884a5e-9035-4834-b85a-4cffafb5bce9.png'),
                   note='portrait recomposition of the Storytellers painting, job 89884a5e'),
        focus=[0.7, 0.5], phoneFocus=[0.5, 0.7], phoneTitle='top', key='#D81B7E'),
    'creators': dict(
        name='II Creators: The Atelier',
        desktop=dict(src=J('hf_20261019_141525_8bc87c5a-b3bb-4f8a-b1b8-c36b267b458d.png'),
                     note='new painting, job 8bc87c5a'),
        phone=dict(src=J('hf_20261019_142023_9191240c-2845-4fdc-92e7-3e4c21655591.png'),
                   note='portrait recomposition, job 9191240c'),
        focus=[0.66, 0.55], phoneFocus=[0.58, 0.74], phoneTitle='top', key='#5C8A78'),
    'brands': dict(
        name='III Brands: The Commission',
        desktop=dict(src=J('hf_20261019_141526_4ce5fe76-74cd-48fa-ac86-91bef455cfab.png'),
                     note='new painting, job 4ce5fe76'),
        phone=dict(src=J('hf_20261019_142023_1f54ecf8-3d59-440d-a69d-bb7451b301ae.png'),
                   note='portrait recomposition, job 1f54ecf8'),
        focus=[0.66, 0.5], phoneFocus=[0.53, 0.68], phoneTitle='top', key='#6E1418'),
    'results': dict(
        name='VIII Results: The Audience',
        desktop=dict(src='repo:public/assets/plates/results.webp', widths=[2048],
                     note='the existing 1920 px Results plate; no larger master exists (the live site serves this '
                          'painting only inside a video), so desktop stops at 2048'),
        phone=dict(src=J('hf_20261019_142422_141b5c72-6df1-4792-97f8-9657b7ab7b5f.png'),
                   note='portrait painted from the same brief (the desktop painting cannot be imported), job 141b5c72'),
        focus=[0.4, 0.6], phoneFocus=[0.5, 0.76], titleSide='top', phoneTitle='top', key='#7FA3AE'),
    'directors': dict(
        name='IX Directors: The Empty Set',
        desktop=dict(src=J('hf_20261019_142024_0c9f02b1-fb78-47ab-9c02-f562d61a11f7.png'),
                     note='new painting, job 0c9f02b1'),
        phone=dict(src=J('hf_20261019_142339_87ef8956-f9a9-4988-ba9a-ee6c11dc8116.png'),
                   note='portrait recomposition, job 87ef8956'),
        focus=[0.64, 0.7], phoneFocus=[0.55, 0.76], phoneTitle='top', key='#20264F'),
    'apply': dict(
        name='X Apply: The Open Gate',
        desktop=dict(src=J('hf_20261019_142024_4b22d074-af34-44aa-8e25-f8e43ce63e97.png'),
                     note='new painting, job 4b22d074'),
        phone=dict(src=J('hf_20261019_142338_397c34ba-c726-4099-a81e-70c105d07cae.png'),
                   note='portrait recomposition, job 397c34ba'),
        focus=[0.74, 0.55], phoneFocus=[0.56, 0.72], phoneTitle='top', key='#DFAFA0',
        titleBox=(0.0, 0.08, 0.40, 0.46)),   # the sky only; the parapet below is darker stone
}
# Optional extras a --config entry may carry (all recorded in the manifest when present):
#   masterpiece    the painting it re-stages ("Raphael, The School of Athens (1509-11)")
#   phoneTitleBox  phone title zone as (x0, y0, x1, y1), in place of a named phoneTitle box
#   titleInk       {"desktop": "light" | "dark", "phone": ...}: the ink the art direction asks for, when it differs
#                  from the zone's best raw ink (a scrim is then needed; titleScrim says how much)
#   scrim          {"desktop": "...", "phone": "..."}: the scrim the art direction asks for to calm a busy zone
#                  (manifest titleScrim.<kind>.advice; the alphas beside it are for luminance contrast only)
#   note           free text for the director (manifest "artNote")


def load_config(path: str) -> dict:
    """--config: {chapter: cfg}; lists become tuples where the code expects boxes."""
    raw = json.loads(Path(path).read_text())
    out = {}
    for ch, cfg in raw.items():
        if ch.startswith('//'):
            continue
        for k in ('titleBox', 'phoneTitleBox'):
            if k in cfg:
                cfg[k] = tuple(cfg[k])
        cfg.setdefault('phoneTitle', 'top')
        out[ch] = cfg
    return out


# ---------------------------------------------------------------- sources
def fetch(src: str) -> Path:
    if src.startswith('repo:'):
        return ROOT / src[5:]
    if not src.startswith(('http://', 'https://')):   # a local master (--config staging)
        return Path(src)
    CACHE.mkdir(parents=True, exist_ok=True)
    dst = CACHE / src.rsplit('/', 1)[-1]
    if not dst.exists() or dst.stat().st_size == 0:
        print(f'  fetch {src}')
        tmp = dst.with_suffix('.part')
        for attempt in range(4):
            try:
                with urllib.request.urlopen(src, timeout=120) as r, open(tmp, 'wb') as f:
                    while chunk := r.read(1 << 20):
                        f.write(chunk)
                break
            except Exception as e:  # flaky proxy: retry
                if attempt == 3:
                    raise
                print(f'    retry ({e})')
                time.sleep(2 + attempt * 3)
        tmp.rename(dst)
    return dst


def load(src: str) -> Image.Image:
    im = Image.open(fetch(src))
    im.load()
    return im.convert('RGB')


def cut(im: Image.Image, aspect: float, fx: float = 0.5, fy: float = 0.5) -> Image.Image:
    """Largest window of the given aspect (w/h), centred on (fx, fy) and clamped to the frame."""
    W, H = im.size
    if W / H > aspect:
        w, h = round(H * aspect), H
    else:
        w, h = W, round(W / aspect)
    x0 = min(max(round(fx * W - w / 2), 0), W - w)
    y0 = min(max(round(fy * H - h / 2), 0), H - h)
    return im.crop((x0, y0, x0 + w, y0 + h))


def shrink(im: Image.Image, w: int, h: int) -> Image.Image:
    """Resize in two steps (box to 2x, then Lanczos) for speed on 5.5K masters, then dither to 8 bits."""
    if im.width > 2 * w:
        im = im.reduce(max(1, im.width // (2 * w)))
    f = np.asarray(im.resize((w, h), Image.LANCZOS, reducing_gap=None), dtype=np.float32)
    rng = np.random.default_rng(1234)
    tpdf = rng.random(f.shape, dtype=np.float32) - rng.random(f.shape, dtype=np.float32)  # triangular, +-1
    return Image.fromarray(np.clip(np.rint(f + 0.5 * tpdf), 0, 255).astype(np.uint8), 'RGB')


# ---------------------------------------------------------------- finish
def crackle(h: int, w: int, cell: float, seed: int) -> np.ndarray:
    """A craquelure network (0..1): warped Voronoi cell walls, some of them broken, so it reads as cracks in old paint
    rather than a grid (the art round's local finish, scratchpad masters/_workA3/finish.py)."""
    import cv2
    r = np.random.default_rng(seed)
    n = max(1, int(h * w / (cell * cell)))
    pts = np.full((h, w), 255, np.uint8)
    pts[r.integers(0, h, n), r.integers(0, w, n)] = 0
    _, lab = cv2.distanceTransformWithLabels(pts, cv2.DIST_L2, 5, labelType=cv2.DIST_LABEL_PIXEL)
    lab = lab.astype(np.float32)
    s = cell / 5
    dx = cv2.GaussianBlur(r.standard_normal((h, w)).astype(np.float32), (0, 0), s)
    dy = cv2.GaussianBlur(r.standard_normal((h, w)).astype(np.float32), (0, 0), s)
    k = cell / 11
    dx *= k / (dx.std() + 1e-6); dy *= k / (dy.std() + 1e-6)
    gx, gy = np.meshgrid(np.arange(w, dtype=np.float32), np.arange(h, dtype=np.float32))
    lab = cv2.remap(lab, gx + dx, gy + dy, cv2.INTER_NEAREST, borderMode=cv2.BORDER_REFLECT)
    del gx, gy, dx, dy
    e = np.zeros((h, w), np.float32)
    e[:, 1:] += lab[:, 1:] != lab[:, :-1]
    e[1:, :] += lab[1:, :] != lab[:-1, :]
    e = np.clip(e, 0, 1)
    gate = cv2.GaussianBlur(r.standard_normal((h, w)).astype(np.float32), (0, 0), cell / 2)
    gate = np.clip((gate / (gate.std() + 1e-6) + 0.6) * 1.5, 0, 1)
    lw = max(0.6, cell / 110)   # the wall's softness, so a crack keeps ~1 px at the encode sizes
    return np.clip(cv2.GaussianBlur(e * gate, (0, 0), lw) * 1.6, 0, 1)


def finish(im: Image.Image, f: dict) -> Image.Image:
    """Optional per-master oil finish (a config's desktop.finish / phone.finish), so a painting that came back
    photographic sits in the edition's one hand: a warm umber lift in the deep shadows (shadowLift, 8-bit steps at
    black, gone by mid-dark), less saturated greens (greenSat, a factor), a small high-frequency soften (soften: 0.3 =
    30% of the way to a blur of `softenSigma` px), and a craquelure network darkening the paint along its cracks
    (crack: strength, cell: mean cell size in px of this master, seed)."""
    import cv2
    a = np.asarray(im, np.float32)
    h, w = a.shape[:2]
    if f.get('soften'):
        b = cv2.GaussianBlur(a, (0, 0), f.get('softenSigma', 2.0))
        a += float(f['soften']) * (b - a)
        del b
    if f.get('greenSat', 1) != 1:
        hsv = cv2.cvtColor(np.clip(a, 0, 255).astype(np.uint8), cv2.COLOR_RGB2HSV_FULL).astype(np.float32)
        hue = hsv[..., 0] * (360 / 256)
        wgt = np.clip(1 - np.abs(hue - 120) / 50, 0, 1) ** 0.7          # greens, 70-170 degrees, peak at 120
        y = a @ np.array([0.299, 0.587, 0.114], np.float32)
        a = y[..., None] + (a - y[..., None]) * (1 - (1 - float(f['greenSat'])) * wgt)[..., None]
        del hsv, hue, wgt
    if f.get('shadowLift'):
        y = a @ np.array([0.299, 0.587, 0.114], np.float32)
        wgt = np.exp(-(y / 34.0) ** 2)
        a += float(f['shadowLift']) * wgt[..., None] * np.array([1.0, 0.72, 0.42], np.float32)
        del wgt
    if f.get('crack'):
        cr = crackle(h, w, float(f.get('cell', 150)), int(f.get('seed', 7)))
        y = np.clip(a @ np.array([0.299, 0.587, 0.114], np.float32), 0, 255) / 255
        amt = float(f['crack']) * (0.35 + 0.65 * y) * cr
        a *= (1 - amt)[..., None]
        del cr, amt
    return Image.fromarray(np.clip(np.rint(a), 0, 255).astype(np.uint8), 'RGB')


# ---------------------------------------------------------------- encoding
def encode(im: Image.Image, fmt: str, q: int, speed: int) -> bytes:
    buf = io.BytesIO()
    if fmt == 'avif':
        im.save(buf, 'AVIF', quality=q, speed=speed, subsampling='4:2:0', range='full', codec='aom',
                advanced={'tune': 'ssim'})
    else:
        im.save(buf, 'WEBP', quality=q, method=6, use_sharp_yuv=True)
    return buf.getvalue()


def fit(im: Image.Image, fmt: str, budget_kb: int, speed: int) -> tuple[bytes, int]:
    """Highest quality in [QMIN, QMAX] whose file fits the budget (binary search)."""
    lo, hi, best = QMIN[fmt], QMAX[fmt], None
    data = encode(im, fmt, hi, speed)
    if len(data) <= budget_kb * 1024:
        return data, hi
    while lo <= hi:
        mid = (lo + hi) // 2
        data = encode(im, fmt, mid, speed)
        if len(data) <= budget_kb * 1024:
            best, lo = (data, mid), mid + 1
        else:
            hi = mid - 1
    if best is None:
        print(f'    ! {fmt} over budget even at q{QMIN[fmt]}: {len(data) // 1024} KB > {budget_kb} KB')
        return encode(im, fmt, QMIN[fmt], speed), QMIN[fmt]
    return best


def lum(rgb) -> float:
    def ch(c):
        c = c / 255
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    r, g, b = rgb
    return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b)


def contrast(a, b) -> float:
    la, lb = sorted((lum(a), lum(b)), reverse=True)
    return (la + 0.05) / (lb + 0.05)


def zone_tone(im: Image.Image, box, ink: str | None = None) -> dict:
    """Title zone: mean colour, the ink that reads on it, and WCAG contrast at the mean and at the zone's
    worst decile (the brightest 10% of pixels for light ink, the darkest 10% for dark ink)."""
    W, H = im.size
    z = np.asarray(im.crop((int(box[0] * W), int(box[1] * H), int(box[2] * W), int(box[3] * H))), np.float32)
    px = z.reshape(-1, 3)
    mean = tuple(int(round(v)) for v in px.mean(0))
    cw, ci = contrast((255, 255, 255), mean), contrast(INK, mean)
    c = px / 255
    lin = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    L = lin @ np.array([0.2126, 0.7152, 0.0722], np.float32)
    light = cw >= ci if ink is None else ink == 'light'   # ink: the art direction's choice (staging)
    if light:
        worst = 1.05 / (np.percentile(L, 90) + 0.05)
    else:
        worst = (np.percentile(L, 10) + 0.05) / (lum(INK) + 0.05)
    return dict(bg='#%02X%02X%02X' % mean, ink='light' if light else 'dark',
                contrast=round(max(cw, ci) if ink is None else (cw if light else ci), 2), worst=round(float(worst), 2))


PAPER = (232, 227, 212)   # --paper, the light scrim for dark ink


def scrim_need(im: Image.Image, box, ink: str) -> dict:
    """Staging only: for the given ink, the worst-decile contrast with no scrim, and the smallest flat scrim alpha
    over the zone (dark --ink under light type, --paper under dark type, mixed in sRGB as CSS does) that brings the
    worst 10% of the zone to 3:1 (the giant title) and to 4.5:1 (the dek)."""
    W, H = im.size
    z = np.asarray(im.crop((int(box[0] * W), int(box[1] * H), int(box[2] * W), int(box[3] * H))), np.float32)
    px = z.reshape(-1, 3)[::7]
    s = np.array(INK if ink == 'light' else PAPER, np.float32)

    def worst(a):
        c = (px * (1 - a) + s * a) / 255
        lin = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
        L = lin @ np.array([0.2126, 0.7152, 0.0722], np.float32)
        if ink == 'light':
            return 1.05 / (np.percentile(L, 90) + 0.05)
        return (np.percentile(L, 10) + 0.05) / (lum(INK) + 0.05)

    y = px @ np.array([0.299, 0.587, 0.114], np.float32)
    out = {'worst10': round(float(worst(0.0)), 2), 'lumaSd': round(float(y.std()), 1)}
    for name, target in (('title3', 3.0), ('dek4.5', 4.5)):
        need = next((a for a in np.arange(0, 0.91, 0.05) if worst(a) >= target), None)
        out[name] = None if need is None else round(float(need), 2)
    return out


def placeholder(im: Image.Image, w: int, h: int) -> str:
    buf = io.BytesIO()
    im.resize((w, h), Image.LANCZOS).save(buf, 'WEBP', quality=40, method=6)
    return 'data:image/webp;base64,' + base64.b64encode(buf.getvalue()).decode()


def build(ch: str, cfg: dict, speed: int) -> dict:
    out = OUT / ch
    out.mkdir(parents=True, exist_ok=True)
    man = {'chapter': ch, 'name': cfg['name']}
    tones, ph, scrims = {}, {}, {}

    d = cfg['desktop']
    dm = cut(load(d['src']), DESKTOP[0] / DESKTOP[1], *d.get('center', (0.5, 0.5)))
    if d.get('finish'):
        dm = finish(dm, d['finish'])
    widths = d.get('widths', [2048, 2880])
    man['desktop'] = {'avif': [], 'webp': []}
    for w in widths:
        h = round(w * DESKTOP[1] / DESKTOP[0])
        im = shrink(dm, w, h)
        if w == widths[0]:
            tones['desktop'] = zone_tone(im, cfg.get('titleBox', TITLE_BOX[cfg.get('titleSide', 'left')]),
                                         cfg.get('titleInk', {}).get('desktop') if STAGED else None)
            if STAGED:
                ink = cfg.get('titleInk', {}).get('desktop', tones['desktop']['ink'])
                scrims['desktop'] = dict(ink=ink, **scrim_need(
                    im, cfg.get('titleBox', TITLE_BOX[cfg.get('titleSide', 'left')]), ink))
            ph['desktop'] = placeholder(im, 32, 18)
            thumb = im.resize((320, 180), Image.LANCZOS)   # menu / rail thumbnail (plan section 3.7)
            man['thumb'] = []
            for fmt, q in (('avif', 60), ('webp', 78)):
                data = encode(thumb, fmt, q, speed)
                (out / f'thumb-320.{fmt}').write_bytes(data)
                man['thumb'].append(dict(src=f'{URL_ROOT}/{ch}/thumb-320.{fmt}', w=320, h=180, bytes=len(data)))
        for fmt in ('avif', 'webp'):
            data, q = fit(im, fmt, BUDGET[('desktop', fmt, w)], speed)
            name = f'desktop-{w}.{fmt}'
            (out / name).write_bytes(data)
            man['desktop'][fmt].append(dict(src=f'{URL_ROOT}/{ch}/{name}', w=w, h=h, bytes=len(data), q=q))
            print(f'  {ch:13s} {name:18s} {w}x{h}  q{q:<3d} {len(data) / 1024:7.1f} KB')

    p = cfg['phone']
    src = p.get('src')
    if src:
        pm = cut(load(src), PHONE[0] / PHONE[1])
        man['phone'] = {'avif': [], 'webp': []}
        if p.get('finish'):
            pm = finish(pm, p['finish'])
        for w in PHONE_WIDTHS:
            h = round(w * PHONE[1] / PHONE[0])
            im = shrink(pm, w, h)
            if w == 1170:
                tones['phone'] = zone_tone(im, cfg.get('phoneTitleBox', TITLE_BOX['phone-' + cfg['phoneTitle']]),
                                           cfg.get('titleInk', {}).get('phone') if STAGED else None)
                if STAGED:
                    ink = cfg.get('titleInk', {}).get('phone', tones['phone']['ink'])
                    scrims['phone'] = dict(ink=ink, **scrim_need(
                        im, cfg.get('phoneTitleBox', TITLE_BOX['phone-' + cfg['phoneTitle']]), ink))
                ph['phone'] = placeholder(im, 12, 26)
            for fmt in ('avif', 'webp'):
                data, q = fit(im, fmt, BUDGET[('phone', fmt, w)], speed)
                name = f'phone-{w}.{fmt}'
                (out / name).write_bytes(data)
                man['phone'][fmt].append(dict(src=f'{URL_ROOT}/{ch}/{name}', w=w, h=h, bytes=len(data), q=q))
                print(f'  {ch:13s} {name:18s} {w}x{h}  q{q:<3d} {len(data) / 1024:7.1f} KB')
    else:
        print(f'  {ch}: no phone master yet')

    man.update(
        focus=cfg['focus'], phoneFocus=cfg['phoneFocus'],
        titleSide=cfg.get('titleSide', 'left'), phoneTitle=cfg['phoneTitle'],
        titleBox={'desktop': list(cfg.get('titleBox', TITLE_BOX[cfg.get('titleSide', 'left')])),
                  'phone': list(cfg.get('phoneTitleBox', TITLE_BOX['phone-' + cfg['phoneTitle']]))},
        key=cfg['key'], titleBg={k: v['bg'] for k, v in tones.items()},
        titleInk={k: v['ink'] for k, v in tones.items()},
        titleContrast={k: {'mean': v['contrast'], 'worst10': v['worst']} for k, v in tones.items()},
        placeholder=ph,
        credit={'desktop': d['note'], 'phone': p['note']},
    )
    if STAGED:
        # the art direction's ink wins over the zone's raw best ink; titleScrim says what it costs
        man['titleInk'] = {k: scrims[k]['ink'] for k in scrims}
        man['titleScrim'] = {k: {'colour': 'ink' if v['ink'] == 'light' else 'paper', 'worst10Bare': v['worst10'],
                                 'alphaForTitle3': v['title3'], 'alphaForDek4_5': v['dek4.5'], 'zoneLumaSd': v['lumaSd'],
                                 **({'advice': cfg['scrim'][k]} if cfg.get('scrim', {}).get(k) else {})}
                             for k, v in scrims.items()}
        for k in ('masterpiece', 'note'):
            if cfg.get(k):
                man['artNote' if k == 'note' else k] = cfg[k]
    if DEPTH_MODEL:
        man['depth'] = depth_map(out, ch)
    (out / 'manifest.json').write_text(json.dumps(man, indent=1, ensure_ascii=False) + '\n')
    return man


def depth_map(out: Path, ch: str) -> dict:
    """--depth: MiDaS small via scripts/depth.py on desktop-2048.webp, then 1920x1080 greyscale WebP q85."""
    import subprocess
    import tempfile
    with tempfile.TemporaryDirectory() as tmp:
        png = Path(tmp) / 'depth.png'
        subprocess.run([sys.executable, '-I', str(ROOT / 'scripts' / 'depth.py'), DEPTH_MODEL,
                        str(out / 'desktop-2048.webp'), str(png), '3'], check=True)
        g = Image.open(png).convert('L').resize((1920, 1080), Image.LANCZOS)
    g.save(out / 'depth.webp', 'WEBP', quality=85, method=6)
    n = (out / 'depth.webp').stat().st_size
    print(f'  {ch:13s} depth.webp         1920x1080  q85  {n / 1024:7.1f} KB')
    return dict(src=f'{URL_ROOT}/{ch}/depth.webp', w=1920, h=1080, bytes=n)


# ---------------------------------------------------------------- contact sheet
def font(size: int, bold: bool = False):
    for f in (('/usr/share/fonts/opentype/inter/Inter-SemiBold.otf' if bold else
               '/usr/share/fonts/opentype/inter/Inter-Regular.otf'),
              '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'):
        if os.path.exists(f):
            return ImageFont.truetype(f, size)
    return ImageFont.load_default()


def sheet() -> None:
    rows = [ch for ch in CHAPTERS if (OUT / ch / 'manifest.json').exists()]
    title = 'Creative Motley v3: chapter paintings (decoded from the shipped AVIFs; magenta = title zone)'
    if STAGED:
        title = ('Creative Motley v3: chapter paintings, the 2026-10-20 masters (decoded from the shipped AVIFs; magenta = title zone)'
                 if OUT == ROOT / 'public' / 'assets' / 'scenes' else 'Masters, modernised (staged): decoded from the AVIFs; magenta = title zone')
    DW, DH, PW = 1024, 576, 324           # desktop thumb, row height, phone thumb width (9:16)
    TW, M = (600 if STAGED else 470), 24
    W = M + DW + M + PW + M + TW + M
    H = 96 + len(rows) * (DH + M) + M
    s = Image.new('RGB', (W, H), (20, 16, 12))
    g = ImageDraw.Draw(s)
    g.text((M, 28), title, font=font(26, True), fill=(236, 226, 208))
    y = 96
    for ch in rows:
        man = json.loads((OUT / ch / 'manifest.json').read_text())
        d0 = man['desktop']['avif'][0]
        im = Image.open(OUT / ch / Path(d0['src']).name).convert('RGB').resize((DW, DH), Image.LANCZOS)
        s.paste(im, (M, y))
        b = man['titleBox']['desktop']
        g.rectangle([M + int(DW * b[0]), y + int(DH * b[1]), M + int(DW * b[2]), y + int(DH * b[3])],
                    outline=(255, 0, 255), width=2)
        x = M + DW + M
        if man.get('phone'):
            p0 = man['phone']['avif'][0]
            pim = Image.open(OUT / ch / Path(p0['src']).name).convert('RGB').resize((PW, DH), Image.LANCZOS)
            s.paste(pim, (x, y))
            b = man['titleBox']['phone']
            g.rectangle([x + int(PW * b[0]), y + int(DH * b[1]), x + int(PW * b[2]), y + int(DH * b[3])],
                        outline=(255, 0, 255), width=2)
        tx, ty = x + PW + M, y
        g.text((tx, ty), man['name'], font=font(22, True), fill=(236, 226, 208))
        if man.get('masterpiece'):
            ty += 32
            g.text((tx, ty), man['masterpiece'], font=font(17), fill=(220, 200, 160))
        g.rectangle([tx, ty + 38, tx + 34, ty + 72], fill=man['key'])
        g.text((tx + 46, ty + 44), f"key {man['key']}", font=font(18), fill=(200, 190, 170))
        ty += 92
        for kind in ('desktop', 'phone'):
            if not man.get(kind):
                continue
            ink = man['titleInk'].get(kind, '')
            tc = man['titleContrast'].get(kind, {})
            g.text((tx, ty), f"{kind}  (title ink {ink}: {tc.get('mean')}:1, worst 10% {tc.get('worst10')}:1)",
                   font=font(17, True), fill=(220, 205, 180))
            ty += 28
            sc = man.get('titleScrim', {}).get(kind)
            if sc:
                need = lambda a: 'none' if a == 0 else ('>0.9' if a is None else f'{a:.2f}')
                g.text((tx + 12, ty), f"{sc['colour']} scrim for contrast: title 3:1 {need(sc['alphaForTitle3'])}, "
                                      f"dek 4.5:1 {need(sc['alphaForDek4_5'])}", font=font(16), fill=(230, 170, 120))
                ty += 24
                g.text((tx + 12, ty), f"zone luma sd {sc['zoneLumaSd']} (busy above ~30)", font=font(16),
                       fill=(230, 170, 120))
                ty += 24
                if sc.get('advice'):
                    import textwrap
                    for line in textwrap.wrap(f"art direction: {sc['advice']}", 64):
                        g.text((tx + 12, ty), line, font=font(16), fill=(240, 120, 200))
                        ty += 22
                    ty += 2
            for fmt in ('avif', 'webp'):
                for f in man[kind][fmt]:
                    g.text((tx + 12, ty), f"{fmt} {f['w']}x{f['h']}  q{f['q']}  {f['bytes'] / 1024:.0f} KB",
                           font=font(16), fill=(180, 170, 150))
                    ty += 24
            ty += 10
        y += DH + M
    SHEET.parent.mkdir(parents=True, exist_ok=True)
    s.save(SHEET, quality=86, optimize=True)
    print(f'sheet: {SHEET} ({SHEET.stat().st_size / 1024:.0f} KB)')


def index() -> None:
    """public/assets/scenes/index.json: every chapter's manifest path, key and placeholder, for preloading.
    Merged into the index already there: a run that encodes some chapters (or a --config with only the masters)
    keeps the other chapters' rows (the hero's, for the dropdown thumbnails)."""
    f0 = OUT / 'index.json'
    rows = json.loads(f0.read_text()) if f0.exists() else {}
    for ch in CHAPTERS:
        f = OUT / ch / 'manifest.json'
        if f.exists():
            m = json.loads(f.read_text())
            rows[ch] = dict(manifest=f'{URL_ROOT}/{ch}/manifest.json', name=m['name'], key=m['key'],
                            placeholder=m['placeholder'], thumb=m.get('thumb', []))
    (OUT / 'index.json').write_text(json.dumps(rows, indent=1, ensure_ascii=False) + '\n')


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('chapters', nargs='*')
    ap.add_argument('--sheet', action='store_true', help='only rebuild the contact sheet')
    ap.add_argument('--fast', action='store_true', help='AVIF speed 8 (try-outs only)')
    ap.add_argument('--out', help='staging root instead of public/assets/scenes')
    ap.add_argument('--config', help='JSON {chapter: cfg} replacing the built-in entries')
    ap.add_argument('--sheet-path', help='contact sheet file')
    ap.add_argument('--depth', metavar='MODEL', help='MiDaS ONNX model: also write depth.webp')
    a = ap.parse_args()
    global OUT, SHEET, CHAPTERS, STAGED, DEPTH_MODEL
    if a.out:
        OUT = Path(a.out).resolve()
        SHEET = OUT / 'art-sheet.jpg'
    if a.sheet_path:
        SHEET = Path(a.sheet_path).resolve()
    cfgs = {}
    if a.config:
        cfgs = load_config(a.config)
        STAGED = True
        # staged (--out): the config's chapters only, in its order (the sheet and index follow CHAPTERS); live (no
        # --out): they replace the built-in entries and the rest (the hero) stay on the sheet and in index.json
        CHAPTERS = cfgs if (a.out and not a.chapters) else {**CHAPTERS, **cfgs}
    elif not a.out and MASTERS.exists():
        # the live paintings of six chapters are the 2026-10-20 masters (scripts/art-masters.json), not the v3
        # phase-1 entries above: a plain run must never put the old paintings back
        cfgs = load_config(str(MASTERS))
        STAGED = True
        CHAPTERS = {**CHAPTERS, **cfgs}
        print(f'using {MASTERS.relative_to(ROOT)} for: {", ".join(cfgs)}')
    DEPTH_MODEL = a.depth
    if not a.sheet:
        names = a.chapters or (list(cfgs) if a.config else list(CHAPTERS))
        bad = [n for n in names if n not in CHAPTERS]
        if bad:
            sys.exit(f'unknown chapter(s): {bad}; known: {list(CHAPTERS)}')
        for ch in names:
            t = time.time()
            build(ch, CHAPTERS[ch], speed=8 if a.fast else 6)
            print(f'  {ch}: {time.time() - t:.0f} s')
        index()
    sheet()


if __name__ == '__main__':
    main()
