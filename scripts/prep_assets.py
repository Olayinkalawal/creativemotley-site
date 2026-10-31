"""Build public/assets from the live site's source files.

    python3 -I scripts/prep_assets.py <source_site_dir>

The source dir is a mirror of creativemotley.com (frames/, method/, objects/,
photos/, results/, directors/, video/). Everything here is derived from the
brand's own art; nothing is downloaded from third parties. (The live site's
work/posters/ are not used since 2026-10-31: the Showcase poster wall is gone,
its cards carry the videos' own YouTube thumbnails, scripts/prep_yt_thumbs.py.)
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
# (the hero film's 570 frames, public/assets/frames/hero, were deleted on 2026-10-31 with its videos and encode script:
#  unused since 2026-10-21, and its camera carried a maker's lettering (F133). Nothing here writes them back.)
# method film: 453 frames (1800 jpg) → webp
lg, sm = mk('frames', 'method', 'lg'), mk('frames', 'method', 'sm')
for f in sorted(os.listdir(os.path.join(SRC, 'method'))):
    if not f.endswith('.jpg'): continue
    s = os.path.join(SRC, 'method', f); b = f[:-4] + '.webp'
    jobs.append((s, os.path.join(lg, b), 1800, 70))
    jobs.append((s, os.path.join(sm, b), 1100, 66))
# objects, photos
for f in os.listdir(os.path.join(SRC, 'objects')):
    jobs.append((os.path.join(SRC, 'objects', f), os.path.join(mk('objects'), f.rsplit('.', 1)[0] + '.webp'), 700, 86))
for f in os.listdir(os.path.join(SRC, 'photos')):
    jobs.append((os.path.join(SRC, 'photos', f), os.path.join(mk('photos'), f.rsplit('.', 1)[0] + '.webp'), 1600, 80))
# plates: the stills each chapter scene is built on
pl = mk('plates')
jobs.append((os.path.join(SRC, 'frames', 'f_0001.webp'), os.path.join(pl, 'hero.webp'), 1920, 80))
# (the old Storytellers plate, the film's last frame f_0570, went on 2026-10-20: the film now ends on the line art and
#  Storytellers is the School of Athens master, public/assets/scenes/storytellers)
jobs.append((os.path.join(SRC, 'method', 'm_0001.jpg'), os.path.join(pl, 'method.webp'), 1800, 80))

with Pool(4) as p: p.map(webp, jobs)

# videos: none are copied as delivered any more (the folder is kept)
v = mk('video')
# (Results' film and its plate went with the old Results painting on 2026-10-20: the oculus master is a still,
#  public/assets/scenes/results, scripts/art-masters.json)
# (the Directors film is no longer copied as delivered, 2026-10-31: the live files carry a third-party logo on the left
#  portrait's cap; scripts/encode-directors.sh makes the site's encodes from the master with it taken off, and the
#  HEVC-with-alpha directors.mp4 is gone, WebKit plays the packed H.264 film)
for f in ('og.jpg', 'favicon.svg'):
    s = os.path.join(SRC, f)
    if os.path.exists(s): shutil.copy(s, os.path.join(ROOT, 'public', f))
print('done', len(jobs), 'image jobs')
