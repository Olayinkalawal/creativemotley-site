"""Build public/assets from the live site's source files.

    python3 -I scripts/prep_assets.py <source_site_dir>

The source dir is a mirror of creativemotley.com (frames/, method/, work/posters/,
objects/, photos/, results/, directors/, video/). Everything here is derived from
the brand's own art; nothing is downloaded from third parties.
"""
import os, sys, shutil
from multiprocessing import Pool
from PIL import Image

SRC = sys.argv[1]
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'public', 'assets')

def mk(*p):
    d = os.path.join(OUT, *p); os.makedirs(d, exist_ok=True); return d

def webp(args):
    src, dst, w, q = args
    if os.path.exists(dst): return
    im = Image.open(src)
    im = im.convert('RGBA' if im.mode in ('RGBA', 'LA', 'P') else 'RGB')
    if w and im.width != w:
        im = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
    im.save(dst, 'WEBP', quality=q, method=6)

jobs = []
# hero film: 570 frames. lg = the live 1920 webp as-is; sm = 1100 wide for phones
lg, sm = mk('frames', 'hero', 'lg'), mk('frames', 'hero', 'sm')
for f in sorted(os.listdir(os.path.join(SRC, 'frames'))):
    if not f.endswith('.webp'): continue
    s = os.path.join(SRC, 'frames', f)
    if not os.path.exists(os.path.join(lg, f)): shutil.copy(s, os.path.join(lg, f))
    jobs.append((s, os.path.join(sm, f), 1100, 66))
# method film: 453 frames (1800 jpg) → webp
lg, sm = mk('frames', 'method', 'lg'), mk('frames', 'method', 'sm')
for f in sorted(os.listdir(os.path.join(SRC, 'method'))):
    if not f.endswith('.jpg'): continue
    s = os.path.join(SRC, 'method', f); b = f[:-4] + '.webp'
    jobs.append((s, os.path.join(lg, b), 1800, 70))
    jobs.append((s, os.path.join(sm, b), 1100, 66))
# posters, objects, photos
for f in os.listdir(os.path.join(SRC, 'work', 'posters')):
    jobs.append((os.path.join(SRC, 'work', 'posters', f), os.path.join(mk('posters'), f.rsplit('.', 1)[0] + '.webp'), 1200, 82))
for f in os.listdir(os.path.join(SRC, 'objects')):
    jobs.append((os.path.join(SRC, 'objects', f), os.path.join(mk('objects'), f.rsplit('.', 1)[0] + '.webp'), 700, 86))
for f in os.listdir(os.path.join(SRC, 'photos')):
    jobs.append((os.path.join(SRC, 'photos', f), os.path.join(mk('photos'), f.rsplit('.', 1)[0] + '.webp'), 1600, 80))
# plates: the stills each chapter scene is built on
pl = mk('plates')
jobs.append((os.path.join(SRC, 'frames', 'f_0001.webp'), os.path.join(pl, 'hero.webp'), 1920, 80))
jobs.append((os.path.join(SRC, 'frames', 'f_0570.webp'), os.path.join(pl, 'storytellers.webp'), 1920, 80))
jobs.append((os.path.join(SRC, 'method', 'm_0001.jpg'), os.path.join(pl, 'method.webp'), 1800, 80))

with Pool(4) as p: p.map(webp, jobs)

# videos: copy as delivered by the live site
v = mk('video')
# (Results' film and its plate went with the old Results painting on 2026-10-20: the oculus master is a still,
#  public/assets/scenes/results, scripts/art-masters.json)
for rel, name in (('directors/directors.webm', 'directors.webm'), ('directors/directors.mp4', 'directors.mp4')):
    s = os.path.join(SRC, rel)
    if os.path.exists(s) and not os.path.exists(os.path.join(v, name)): shutil.copy(s, os.path.join(v, name))
for f in ('og.jpg', 'favicon.svg'):
    s = os.path.join(SRC, f)
    if os.path.exists(s): shutil.copy(s, os.path.join(ROOT, 'public', f))
print('done', len(jobs), 'image jobs')
