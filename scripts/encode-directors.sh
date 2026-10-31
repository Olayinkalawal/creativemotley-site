#!/usr/bin/env bash
# Re-encode the Directors alpha film (IX: two painted portraits on transparency, src/partials/directors.html) for the
# web, from the client's master, with the cap logo taken off.
#   out: public/assets/video/directors.webm          1920x1080 VP9 + alpha: Chrome, Edge, Firefox, Android (≤ 2.5 MB)
#        public/assets/video/directors-sm.webm       1280x720, the same for narrow screens                 (≤ 1.0 MB)
#        public/assets/video/directors-pack.mp4      1920x2160 H.264 High 5.1: WebKit (Safari)             (≤ 4 MB)
#        public/assets/video/directors-pack-sm.mp4   1280x1440 H.264 High 4.0: WebKit on narrow screens    (≤ 1.6 MB)
# SRC is a local file: the client's master, the live site's delivered film (https://creativemotley.com/directors/
# directors.webm: 1920x1080, 30 fps, 600 frames, 20 s, VP9 + alpha at 3 Mb/s), by default the copy in
# /home/user/cm-film/source/site/directors/directors.webm. The retouch is fixed to that master: it checks frame 0
# against its assets and refuses any other file (a re-exported master needs "retouch-directors-cap.py build" first).
# The steps:
#   1. Decode (libvpx-vp9: ffmpeg's native VP9 decoder drops the alpha) → retouch: the Knicks logo and the maker's
#      flag come off the left portrait's cap (scripts/retouch-directors-cap.py, a raw RGBA filter; deterministic, no
#      AI; it changes cap pixels only, never the alpha; see its docstring) → flatten (below) → FFV1 (flat.mkv).
#   2. The flatten. The master keeps the matte's graph paper and torn black strip under its transparent pixels:
#      invisible, but most of what an encoder spends bits on. Every fully transparent pixel's colour is replaced by a
#      smooth push-pull fill of the opaque colours next to it (partly transparent edge pixels keep their colour), and
#      the alpha is cleaned (< 8 → 0, > 247 → 255). Nothing visible changes.
#   3. VP9 + alpha, two-pass constrained quality with alt-ref frames, and golden/alt-ref groups of at least 24 frames
#      (-min-gf-interval 24): the portraits move slowly, so long groups carry them. Keyframes at 0 and 10 s (-g 300).
#   4. The packed film for WebKit, which plays WebM but not VP9's alpha (and whose HEVC-with-alpha can only be encoded
#      on macOS): one H.264 frame twice as tall, the colour in the top half and the alpha as grey in the bottom half
#      (full-range alpha → limited-range luma, so the browser's decode gives it back 0–255). The colour of fully
#      transparent pixels is the same smooth fill (it keeps the colour half small). src/gl/lib/alphapack.js
#      draws it into a canvas: colour from the top half, alpha from the bottom. Keyframes as the WebM (0 and 10 s, no
#      scene cuts), +faststart. Its YUV matrix is tagged BT.601 (smpte170m, limited range): ffmpeg made the YUV with
#      BT.601, and Chromium decodes the untagged WebM with BT.601 too (measured, docs/v3-status.md Phase 10), so the tag
#      keeps Safari from guessing BT.709 for an HD frame (a colour shift against the WebM and the poster).
# usage: scripts/encode-directors.sh [crf webm desktop=42] [crf webm phone=45] [crf pack=27.5] [crf pack-sm=28]
#        SRC=<master> (default above), CACHE=<work dir parent> (default $TMPDIR or /tmp), FLAT=<flat.mkv> reuses a
#        flat file made earlier by step 1 (or by "retouch-directors-cap.py run --fill --out": the same file, bit for
#        bit), KEEP_FLAT=<path> keeps step 1's file there (a hard link where it can), ONLY=pack encodes the two
#        WebKit films only
set -euo pipefail
cd "$(dirname "$0")/.."
CRF_LG=${1:-42}; CRF_SM=${2:-45}; CRF_PK=${3:-27.5}; CRF_PKS=${4:-28}
SRC=${SRC:-/home/user/cm-film/source/site/directors/directors.webm}
CACHE=${CACHE:-${TMPDIR:-/tmp}}
OUT=public/assets/video
[ -n "${FLAT:-}" ] || [ -s "$SRC" ] || { echo "no master at $SRC (set SRC=<local copy of the client's directors.webm>)" >&2; exit 1; }
mkdir -p "$CACHE"
WORK=$(mktemp -d "$CACHE/directors.XXXXXX"); trap 'rm -rf "$WORK"' EXIT

if [ -n "${FLAT:-}" ]; then
  echo "using $FLAT (step 1 skipped)"
else
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
  echo "retouching and flattening $SRC ($W x $H @ $FPS)…"
  # libvpx-vp9 as the decoder: the native one drops the alpha
  ffmpeg -nostdin -hide_banner -loglevel error -c:v libvpx-vp9 -i "$SRC" -f rawvideo -pix_fmt rgba - \
    | python3 -I scripts/retouch-directors-cap.py run --raw "${W}x${H}" \
    | python3 -I "$WORK/fill.py" "$W" "$H" \
    | ffmpeg -hide_banner -loglevel error -y -f rawvideo -pix_fmt rgba -s "${W}x${H}" -r "$FPS" -i - \
        -c:v ffv1 -level 3 -slices 16 -pix_fmt yuva420p "$WORK/flat.mkv"
  [ "$(ffprobe -v error -count_frames -select_streams v:0 -show_entries stream=nb_read_frames -of csv=p=0 "$WORK/flat.mkv")" = 600 ] \
    || { echo "flat.mkv is not 600 frames: the retouch or the flatten failed" >&2; exit 1; }
  FLAT="$WORK/flat.mkv"
  [ -z "${KEEP_FLAT:-}" ] || ln -f "$FLAT" "$KEEP_FLAT" 2>/dev/null || cp "$FLAT" "$KEEP_FLAT"
fi

enc() {   # enc <width> <crf> <out>: VP9 + alpha, two passes
  local VF="scale=$1:-2:flags=lanczos"
  local P="-an -c:v libvpx-vp9 -pix_fmt yuva420p -b:v 0 -crf $2 -g 300 -min-gf-interval 24 -auto-alt-ref 1 -lag-in-frames 25 -row-mt 1 -tile-columns 2 -threads 4"
  nice -n 10 ffmpeg -nostdin -hide_banner -loglevel error -y -i "$FLAT" -vf "$VF" $P -deadline good -cpu-used 4 -pass 1 -passlogfile "$WORK/p$1" -f webm /dev/null
  nice -n 10 ffmpeg -nostdin -hide_banner -loglevel error -y -i "$FLAT" -vf "$VF" $P -deadline good -cpu-used 1 -pass 2 -passlogfile "$WORK/p$1" "$WORK/out$1.webm"
  mv "$WORK/out$1.webm" "$3"
}
pack() {  # pack <width> <crf> <level> <out>: H.264, colour above, alpha as grey below
  local SC=""; [ "$1" = 1920 ] || SC="scale=$1:-2:flags=lanczos,format=yuva420p,"
  nice -n 10 ffmpeg -nostdin -hide_banner -loglevel error -y -i "$FLAT" -filter_complex \
    "[0:v]${SC}split[c][a];[c]format=yuv420p[c2];[a]alphaextract,scale=in_range=full:out_range=limited,format=yuv420p[a2];[c2][a2]vstack" \
    -an -c:v libx264 -profile:v high -level "$3" -preset veryslow -crf "$2" -x264-params keyint=300:scenecut=0 \
    -pix_fmt yuv420p -colorspace smpte170m -color_range tv -movflags +faststart "$WORK/pack$1.mp4"
  mv "$WORK/pack$1.mp4" "$4"
}
if [ "${ONLY:-}" != pack ]; then
  enc 1920 "$CRF_LG" "$OUT/directors.webm"
  enc 1280 "$CRF_SM" "$OUT/directors-sm.webm"
fi
pack 1920 "$CRF_PK" 5.1 "$OUT/directors-pack.mp4"
pack 1280 "$CRF_PKS" 4.0 "$OUT/directors-pack-sm.mp4"
ls -l "$OUT"/directors.webm "$OUT"/directors-sm.webm "$OUT"/directors-pack.mp4 "$OUT"/directors-pack-sm.mp4
