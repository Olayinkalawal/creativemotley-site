# python3 -I sheet.py <dir> <out_prefix> [cols] [thumb_w] [per_sheet]
import sys, os, glob
from PIL import Image, ImageDraw
d, out = sys.argv[1], sys.argv[2]
cols = int(sys.argv[3]) if len(sys.argv) > 3 else 4
tw = int(sys.argv[4]) if len(sys.argv) > 4 else 480
per = int(sys.argv[5]) if len(sys.argv) > 5 else 16
fs = sorted(glob.glob(os.path.join(d, '*.jpg')))
for k in range(0, len(fs), per):
    batch = fs[k:k + per]
    ims = [Image.open(f) for f in batch]
    th = int(ims[0].height * tw / ims[0].width)
    rows = (len(ims) + cols - 1) // cols
    S = Image.new('RGB', (cols * (tw + 6) + 6, rows * (th + 6) + 6), (40, 40, 40))
    dr = ImageDraw.Draw(S)
    for i, (f, im) in enumerate(zip(batch, ims)):
        x, y = 6 + (i % cols) * (tw + 6), 6 + (i // cols) * (th + 6)
        S.paste(im.resize((tw, th)), (x, y))
        dr.rectangle([x, y, x + 90, y + 14], fill=(0, 0, 0)); dr.text((x + 3, y + 2), os.path.basename(f)[:-4], fill=(255, 255, 0))
    S.save(f'{out}_{k // per:02d}.jpg', quality=82)
    print(f'{out}_{k // per:02d}.jpg', len(batch))
