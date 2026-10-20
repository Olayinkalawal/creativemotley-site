#!/usr/bin/env python3
"""The paper cards' painted crops (public/assets/thumbs/crops): details of each chapter's own painting, cut from the
2026-10-20 masters (.art/masters-2026-10-20, see scripts/art-masters.json).
  - Creators' notes fan: four 4:3 thumbnails, 240 and 480 px wide;
  - Brands' notes fan: two 4:3 thumbnails; the two photo cards' painted mats: 3:2 velvet, 640 and 1200 px wide.
The file names stay those the partials use (creators.html, brands.html); what each now shows is in CROPS.
  python3 scripts/crops.py [--preview FILE]       (--preview: also a contact sheet of the crops)
"""
import io
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
MASTERS = ROOT / '.art' / 'masters-2026-10-20'
OUT = ROOT / 'public' / 'assets' / 'thumbs' / 'crops'

# name: (chapter, centre u, centre v, width as a fraction of the painting, aspect w/h, output widths)
CROPS = {
    'creators-edit': ('creators', 0.66, 0.85, 0.20, 4 / 3, (240, 480)),     # her folded hands and the phone
    'creators-camera': ('creators', 0.905, 0.555, 0.12, 4 / 3, (240, 480)),  # the camera on the parapet
    'creators-wall': ('creators', 0.22, 0.42, 0.30, 4 / 3, (240, 480)),     # the river valley
    'creators-boards': ('creators', 0.715, 0.24, 0.18, 4 / 3, (240, 480)),  # her face
    'brands-scroll': ('brands', 0.70, 0.505, 0.12, 4 / 3, (240, 480)),      # the contract and its seal, hand to hand
    'brands-rig': ('brands', 0.38, 0.75, 0.16, 4 / 3, (240, 480)),          # the microphone and the oranges on the chest
    'brands-velvet-a': ('brands', 0.945, 0.20, 0.10, 3 / 2, (640, 1200)),    # the red bed curtain (a mat)
    'brands-velvet-b': ('brands', 0.95, 0.42, 0.09, 3 / 2, (640, 1200)),    # the red bed (a mat)
}
Q = {'avif': 58, 'webp': 80}


def cut(im, cu, cv, w, ar):
    W, H = im.size
    pw = w * W
    ph = pw / ar
    x0 = min(max(0, cu * W - pw / 2), W - pw)
    y0 = min(max(0, cv * H - ph / 2), H - ph)
    return im.crop((round(x0), round(y0), round(x0 + pw), round(y0 + ph)))


def encode(im, fmt):
    buf = io.BytesIO()
    if fmt == 'avif':
        im.save(buf, 'AVIF', quality=Q['avif'], speed=6, subsampling='4:2:0', range='full', codec='aom')
    else:
        im.save(buf, 'WEBP', quality=Q['webp'], method=6, use_sharp_yuv=True)
    return buf.getvalue()


def main():
    cache, tiles = {}, []
    for name, (ch, cu, cv, w, ar, widths) in CROPS.items():
        if ch not in cache:
            cache[ch] = Image.open(MASTERS / f'{ch}-desktop.png').convert('RGB')
        c = cut(cache[ch], cu, cv, w, ar)
        for px in widths:
            im = c.resize((px, round(px / ar)), Image.LANCZOS)
            for fmt in ('avif', 'webp'):
                data = encode(im, fmt)
                (OUT / f'{name}-{px}.{fmt}').write_bytes(data)
                print(f'  {name}-{px}.{fmt}  {im.size[0]}x{im.size[1]}  {len(data) / 1024:.1f} KB')
        tiles.append((name, c.resize((360, round(360 / ar)), Image.LANCZOS)))
    if '--preview' in sys.argv:
        f = sys.argv[sys.argv.index('--preview') + 1]
        sheet = Image.new('RGB', (4 * 370, 2 * 280), (20, 16, 12))
        for i, (_, t) in enumerate(tiles):
            sheet.paste(t, ((i % 4) * 370, (i // 4) * 280))
        sheet.save(f, quality=86)


if __name__ == '__main__':
    main()
