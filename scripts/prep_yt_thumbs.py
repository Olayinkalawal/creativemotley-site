"""Showcase card art: the real YouTube thumbnail of a video, downloaded once at build-prep time and self-hosted.

    python3 -I scripts/prep_yt_thumbs.py <id> [<id> ...] [--out DIR] [--base NAME]
    python3 -I scripts/prep_yt_thumbs.py --check
    python3 -I scripts/prep_yt_thumbs.py --mosaic public/assets/thumbs/<name>.webp

<id> ...   For each YouTube video id: tries https://i.ytimg.com/vi/<id>/maxresdefault.jpg, then sddefault.jpg, then
           hqdefault.jpg, and takes the first one YouTube serves as a real image (HTTP 200, wider than the 120 x 90
           "no thumbnail" placeholder). Finds letterbox / pillarbox bars (edge rows, or columns, that are flat black on
           BOTH opposite sides: mean luma <= 3.5 and max <= 12; a dark band on one side only is the artwork) and crops
           inside them to 16:9, centred. Nothing else is done to the art: crop and resize (Lanczos) only, never an
           upscale. Writes <out>/<base>-<w>.{avif,webp} for w = 320, 640 and the largest width the crop allows (1280,
           or the crop's own width between 640 and 1280; a crop narrower than 640 is refused: the cards need a 640
           file), then prints each video's thumb record for docs/videos.json:
             "thumb": { "source", "source_size": [w, h], "crop": [x, y, w, h], "widths", "path", "fetched" }
           Paste it onto the video, then run node src/partials/showcase.videos.mjs (which checks the files exist).
           --out   default public/assets/thumbs/video;  --base  default the id (one id only).
           A thumbnail fetched again takes a new base (e.g. <id>-20261231), never an old one: vercel.json serves
           /assets/* immutable for a year. So this refuses to overwrite an existing file.
--check    For every video in docs/videos.json with a thumb record: downloads YouTube's thumbnails again and re-derives
           the source, size, crop and widths, compares them with the record, checks the files exist, and compares
           the self-hosted 640 file with the fresh crop (a creator may change a video's thumbnail on YouTube: mean
           luma difference above 12 / 255 is reported as changed). Writes nothing; exit 1 on any mismatch.
--mosaic   The Chapters menu's Showcase thumbnail (src/ui/chrome.js): 192 x 108, the first four cards in grid order
           (en-GB alphabetical by creator, as showcase.videos.mjs orders them), 2 x 2 tiles from their 320 WebP files.
           Write it to a new file name and point chrome.js at it (the same immutable-cache rule).

Encoding (the settings the 16 cards of 2026-10-31 were made with): WebP 640 starts at quality 80 and steps by 2
(60 to 90) until it lands in 30-60 KB; AVIF 60 (aom, 4:2:0, speed 6); the 320 tier takes the 640 tier's qualities;
the large tier is capped at 100 KB (AVIF, quality floor 52) and 140 KB (WebP, floor 72).
Network: Python's urllib, so it honours HTTPS_PROXY; a proxy's CA comes from SSL_CERT_FILE (OpenSSL reads it).
The page itself never asks YouTube for anything before a click: everything here is build-prep time only.
"""
import datetime, io, json, os, sys, urllib.error, urllib.request
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUBLIC = os.path.join(ROOT, 'public')
ORDER = ['maxresdefault', 'sddefault', 'hqdefault']
WEBP_BAND, WEBP_Q0, WEBP_QS = (30_000, 60_000), 80, (60, 90)
AVIF_Q = 60
CAP = {'avif': (100_000, 52), 'webp': (140_000, 72)}   # the large tier: (max bytes, lowest quality)
CHANGED = 12.0                                           # --check: mean luma difference (0-255) that counts as changed


def fetch(url):
    """bytes, or None when YouTube has no such image (404, or its 120 x 90 placeholder)"""
    req = urllib.request.Request(url, headers={'User-Agent': 'creativemotley-site prep_yt_thumbs'})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            data = r.read()
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return None
        raise
    with Image.open(io.BytesIO(data)) as im:
        return data if im.width > 120 else None


def source(vid):
    """(name, url, RGB image) of the best thumbnail YouTube serves for vid"""
    for name in ORDER:
        url = f'https://i.ytimg.com/vi/{vid}/{name}.jpg'
        data = fetch(url)
        if data:
            return name, url, Image.open(io.BytesIO(data)).convert('RGB')
    raise SystemExit(f'{vid}: YouTube serves no thumbnail ({", ".join(ORDER)})')


def luma_stats(vals):
    return sum(vals) / len(vals), max(vals)


def bar_box(im):
    """the content box inside letterbox / pillarbox bars: (l, t, r, b). Columns are measured inside the content rows."""
    w, h = im.size
    rgb = im.load()
    lum = {}
    def px(x, y):   # integer Rec. 601 luma, floored (the 2026-10-31 crops were measured this way)
        k = (x, y)
        if k not in lum:
            r, g, b_ = rgb[x, y]
            lum[k] = (r * 299 + g * 587 + b_ * 114) // 1000
        return lum[k]
    flat = lambda m: m[0] <= 3.5 and m[1] <= 12
    row = lambda y: luma_stats([px(x, y) for x in range(w)])
    t = 0
    while t < h // 3 and flat(row(t)): t += 1
    b = h
    while b > h - h // 3 and flat(row(b - 1)): b -= 1
    if t == 0 or b == h: t, b = 0, h          # bars on one side only: artwork
    col = lambda x: luma_stats([px(x, y) for y in range(t, b)])
    l = 0
    while l < w // 3 and flat(col(l)): l += 1
    r = w
    while r > w - w // 3 and flat(col(r - 1)): r -= 1
    if l == 0 or r == w: l, r = 0, w
    return l, t, r, b


def crop169(box):
    l, t, r, b = box
    cw, ch = r - l, b - t
    if cw * 9 > ch * 16:      # too wide: trim the sides
        nw = round(ch * 16 / 9); l += (cw - nw) // 2; cw = nw
    elif cw * 9 < ch * 16:    # too tall: trim top and bottom
        nh = round(cw * 9 / 16); t += (ch - nh) // 2; ch = nh
    return [l, t, cw, ch]


def widths_for(cw):
    if cw < 640:
        return None
    return [320, 640] + ([1280] if cw >= 1280 else [cw] if cw > 640 else [])


def enc(im, fmt, q):
    buf = io.BytesIO()
    if fmt == 'avif':
        im.save(buf, 'AVIF', quality=q, speed=6, subsampling='4:2:0', range='full', codec='aom')
    else:
        im.save(buf, 'WEBP', quality=q, method=6, use_sharp_yuv=True)
    return buf.getvalue()


def derive(vid):
    name, url, im = source(vid)
    crop = crop169(bar_box(im))
    x, y, cw, ch = crop
    return {'name': name, 'url': url, 'im': im, 'size': list(im.size), 'crop': crop,
            'cim': im.crop((x, y, x + cw, y + ch)), 'widths': widths_for(cw)}


def encode_all(d, out, base):
    cim, widths = d['cim'], d['widths']
    frames = {w: (cim if w == cim.width else cim.resize((w, round(w * 9 / 16)), Image.LANCZOS)) for w in widths}
    q = {'webp': WEBP_Q0, 'avif': AVIF_Q}
    data = enc(frames[640], 'webp', q['webp'])
    while len(data) > WEBP_BAND[1] and q['webp'] > WEBP_QS[0]:
        q['webp'] -= 2; data = enc(frames[640], 'webp', q['webp'])
    while len(data) < WEBP_BAND[0] and q['webp'] < WEBP_QS[1]:
        q['webp'] += 2; data = enc(frames[640], 'webp', q['webp'])
    files = {}
    for w in widths:
        for fmt in ('avif', 'webp'):
            fq = q[fmt]
            b = enc(frames[w], fmt, fq)
            if w > 640:
                while len(b) > CAP[fmt][0] and fq - 2 >= CAP[fmt][1]:
                    fq -= 2; b = enc(frames[w], fmt, fq)
            files[os.path.join(out, f'{base}-{w}.{fmt}')] = (b, fq)
    return files


def web_path(out, base):
    rel = os.path.relpath(os.path.abspath(out), PUBLIC)
    return '/' + '/'.join([*rel.split(os.sep), base]) if not rel.startswith('..') else f'/assets/thumbs/video/{base}'


def videos():
    with open(os.path.join(ROOT, 'docs', 'videos.json'), encoding='utf8') as f:
        return json.load(f)


def run(ids, out, base):
    if base and len(ids) != 1:
        raise SystemExit('--base names one video\'s files: pass one id')
    os.makedirs(out, exist_ok=True)
    records = {}
    for vid in ids:
        b = base or vid
        d = derive(vid)
        if not d['widths']:
            raise SystemExit(f'{vid}: the {d["name"]} crop is {d["crop"][2]} px wide, narrower than the 640 the cards need')
        files = encode_all(d, out, b)
        clash = [p for p in files if os.path.exists(p)]
        if clash:
            raise SystemExit(f'{vid}: {", ".join(os.path.basename(p) for p in clash)} exist; a new thumbnail takes a new '
                             f'--base (e.g. {vid}-{datetime.date.today():%Y%m%d}), never an old path')
        for p, (data, _) in files.items():
            with open(p, 'wb') as f: f.write(data)
        print(f'{vid}: {d["name"]} {d["size"][0]}x{d["size"][1]}, crop {d["crop"]}, ' +
              ' '.join(f'{os.path.basename(p)} {len(v[0]) // 1000} KB q{v[1]}' for p, v in files.items()), file=sys.stderr)
        records[vid] = {'thumb': {'source': d['url'], 'source_size': d['size'], 'crop': d['crop'], 'widths': d['widths'],
                                  'path': web_path(out, b), 'fetched': f'{datetime.date.today():%Y-%m-%d}'}}
    print(json.dumps(records, indent=1, ensure_ascii=False))


def check():
    bad = 0
    for c in videos()['creators']:
        for v in c.get('videos', []):
            t = v.get('thumb')
            if not t:
                continue
            d = derive(v['id'])
            issues = []
            for key, now in (('source', d['url']), ('source_size', d['size']), ('crop', d['crop']), ('widths', d['widths'])):
                if t[key] != now:
                    issues.append(f'{key} {t[key]} -> {now}')
            missing = [f'{t["path"]}-{w}.{x}' for w in t['widths'] for x in ('avif', 'webp')
                       if not os.path.exists(os.path.join(PUBLIC, f'{t["path"]}-{w}.{x}'.lstrip('/')))]
            if missing:
                issues.append('missing ' + ', '.join(missing))
            diff = None
            local = os.path.join(PUBLIC, f'{t["path"]}-640.webp'.lstrip('/'))
            if os.path.exists(local):
                a = Image.open(local).convert('L').resize((160, 90), Image.LANCZOS)
                x, y, cw, ch = t['crop']
                fresh = d['im'].crop((x, y, x + cw, y + ch)).convert('L').resize((160, 90), Image.LANCZOS)
                pa, pb = a.tobytes(), fresh.tobytes()
                diff = sum(abs(p - q) for p, q in zip(pa, pb)) / len(pa)
                if diff > CHANGED:
                    issues.append(f'changed on YouTube (mean difference {diff:.1f})')
            bad += bool(issues)
            print(f'{"BAD" if issues else "ok "} {v["id"]} {c["creator"]}: {d["name"]} {d["size"][0]}x{d["size"][1]} crop '
                  f'{d["crop"]} widths {d["widths"]}' + (f', 640 file vs fresh crop {diff:.1f}' if diff is not None else '') +
                  (' | ' + '; '.join(issues) if issues else ''))
    sys.exit(1 if bad else 0)


def mosaic(dst):
    cards = []
    for c in videos()['creators']:
        t = next((v['thumb'] for v in c.get('videos', []) if v.get('thumb')), None)
        if t:
            cards.append((c['creator'], t['path']))
    # (a close match for showcase.videos.mjs: localeCompare('en-GB', { sensitivity: 'base' }) on these names)
    cards.sort(key=lambda n: n[0].casefold())
    im = Image.new('RGB', (192, 108))
    for i, (_, p) in enumerate(cards[:4]):
        tile = Image.open(os.path.join(PUBLIC, f'{p}-320.webp'.lstrip('/'))).convert('RGB').resize((96, 54), Image.LANCZOS)
        im.paste(tile, ((i % 2) * 96, (i // 2) * 54))
    if os.path.exists(dst):
        raise SystemExit(f'{dst} exists: write the mosaic to a new name and point src/ui/chrome.js at it')
    im.save(dst, 'WEBP', quality=82, method=6)
    print(f'{dst}: {", ".join(n for n, _ in cards[:4])}, {os.path.getsize(dst)} bytes')


def main(argv):
    if not argv or argv[0] in ('-h', '--help'):
        print(__doc__); return 2
    if argv == ['--check']:
        return check()
    if len(argv) == 2 and argv[0] == '--mosaic':
        return mosaic(argv[1])
    out, base, ids = os.path.join(PUBLIC, 'assets', 'thumbs', 'video'), None, []
    it = iter(argv)
    for a in it:
        if a == '--out': out = next(it, None)
        elif a == '--base': base = next(it, None)
        elif a.startswith('-') or not a: print(__doc__); return 2
        else: ids.append(a)
    if not ids or out is None or (base is not None and not base):
        print(__doc__); return 2
    run(ids, out, base)
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]) or 0)
