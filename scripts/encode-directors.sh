#!/usr/bin/env bash
# Re-encode the Directors alpha film (IX: two painted portraits on transparency, src/partials/directors.html) for the
# web. VP9 with alpha in WebM, which Chrome, Edge, Firefox and Android play with transparency.
#   out: public/assets/video/directors.webm     1920x1080, desktop   (was 7.66 MB; ≤ 2.5 MB)
#        public/assets/video/directors-sm.webm  1280x720, narrow screens (was 2.35 MB; ≤ 1.0 MB)
# The master is the live site's delivered file (https://creativemotley.com/directors/directors.webm, 1920x1080,
# 30 fps, 20 s, VP9 + alpha at 3 Mb/s); it is fetched once into $CACHE unless SRC points at a local copy.
# What makes it small:
#   1. The master keeps the matte's graph paper and torn black strip under its transparent pixels: invisible, but
#      most of what an encoder spends bits on. Every fully transparent pixel's colour is replaced by a smooth
#      push-pull fill of the opaque colours next to it (partly transparent edge pixels keep their colour), and the
#      alpha is cleaned (< 8 → 0, > 247 → 255). Nothing visible changes.
#   2. Two-pass constrained quality with alt-ref frames, and golden/alt-ref groups of at least 24 frames
#      (-min-gf-interval 24): the portraits move slowly, so long groups carry them.
# Safari: it plays WebM but not VP9's alpha, so WebKit gets public/assets/video/directors.mp4 (HEVC with alpha,
# 15.1 MB, unchanged here: an HEVC alpha layer can only be encoded on macOS, e.g.
#   ffmpeg -i directors-flat.mov -c:v hevc_videotoolbox -alpha_quality 0.4 -b:v 900k -tag:v hvc1 directors.mp4
# from a ProRes 4444 export of the flattened frames; see docs/v3-status.md).
# usage: scripts/encode-directors.sh [crf desktop=42] [crf phone=45]      (SRC=…, CACHE=… optional)
set -euo pipefail
cd "$(dirname "$0")/.."
CRF_LG=${1:-42}; CRF_SM=${2:-45}
MASTER_URL=https://creativemotley.com/directors/directors.webm
CACHE=${CACHE:-${TMPDIR:-/tmp}/cm-masters}
SRC=${SRC:-$CACHE/directors-master.webm}
OUT=public/assets/video
mkdir -p "$CACHE"
[ -s "$SRC" ] || curl -fsSL "$MASTER_URL" -o "$SRC"
WORK=$(mktemp -d "$CACHE/directors.XXXXXX"); trap 'rm -rf "$WORK"' EXIT
IFS=x read -r W H FPS < <(ffprobe -v error -select_streams v:0 -show_entries stream=width,height,r_frame_rate -of csv=p=0:s=x "$SRC")

cat > "$WORK/fill.py" <<'PY'
import sys, numpy as np, cv2
# rgba frames on stdin -> rgba frames on stdout: transparent pixels get a smooth fill of the nearby opaque colours
W, H = int(sys.argv[1]), int(sys.argv[2]); n = W * H * 4
inp, out = sys.stdin.buffer, sys.stdout.buffer
def down(img, f):
    h, w = img.shape[:2]
    return cv2.resize(img, (max(1, w // f), max(1, h // f)), interpolation=cv2.INTER_AREA)
while True:
    buf = inp.read(n)
    if len(buf) < n: break
    f = np.frombuffer(buf, np.uint8).reshape(H, W, 4)
    rgb = np.ascontiguousarray(f[..., :3]); a = f[..., 3]
    m = (a >= 200).astype(np.uint8)
    levels = [(down(cv2.bitwise_and(rgb, rgb, mask=m).astype(np.float32), 8), down(m.astype(np.float32), 8))]
    for _ in range(3): levels.append((down(levels[-1][0], 4), down(levels[-1][1], 4)))
    sh = levels[0][1].shape[:2][::-1]; acc = None
    for P, Wt in reversed(levels):   # coarse first, refined by the finer levels where they saw opaque colour
        Pb = cv2.GaussianBlur(P, (5, 5), 0); Wb = cv2.GaussianBlur(Wt, (5, 5), 0)
        F = cv2.resize(Pb / np.maximum(Wb, 1e-5)[..., None], sh, interpolation=cv2.INTER_CUBIC)
        c = np.clip(cv2.resize(Wb, sh, interpolation=cv2.INTER_LINEAR) * 12.0, 0, 1)[..., None]
        acc = F if acc is None else F * c + acc * (1 - c)
    fill = np.clip(cv2.resize(acc, (W, H), interpolation=cv2.INTER_CUBIC), 0, 255).astype(np.uint8)
    a2 = a.copy(); a2[a2 < 8] = 0; a2[a2 > 247] = 255
    o = rgb.copy(); z = a2 == 0; o[z] = fill[z]
    out.write(np.dstack([o, a2]).tobytes())
PY

echo "flattening $SRC ($W x $H @ $FPS)…"
# libvpx-vp9 as the decoder: the native one drops the alpha
ffmpeg -hide_banner -loglevel error -c:v libvpx-vp9 -i "$SRC" -f rawvideo -pix_fmt rgba - \
  | python3 -I "$WORK/fill.py" "$W" "$H" \
  | ffmpeg -hide_banner -loglevel error -y -f rawvideo -pix_fmt rgba -s "${W}x${H}" -r "$FPS" -i - \
      -c:v ffv1 -level 3 -slices 16 -pix_fmt yuva420p "$WORK/flat.mkv"

enc() {   # enc <width> <crf> <out>
  local VF="scale=$1:-2:flags=lanczos"
  local P="-an -c:v libvpx-vp9 -pix_fmt yuva420p -b:v 0 -crf $2 -g 300 -min-gf-interval 24 -auto-alt-ref 1 -lag-in-frames 25 -row-mt 1 -tile-columns 2 -threads 4"
  nice -n 10 ffmpeg -hide_banner -loglevel error -y -i "$WORK/flat.mkv" -vf "$VF" $P -deadline good -cpu-used 4 -pass 1 -passlogfile "$WORK/p$1" -f webm /dev/null
  nice -n 10 ffmpeg -hide_banner -loglevel error -y -i "$WORK/flat.mkv" -vf "$VF" $P -deadline good -cpu-used 1 -pass 2 -passlogfile "$WORK/p$1" "$WORK/out$1.webm"
  mv "$WORK/out$1.webm" "$3"
}
enc 1920 "$CRF_LG" "$OUT/directors.webm"
enc 1280 "$CRF_SM" "$OUT/directors-sm.webm"
ls -l "$OUT"/directors.webm "$OUT"/directors-sm.webm
