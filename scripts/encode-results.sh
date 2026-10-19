#!/usr/bin/env bash
# Re-encode the Results backdrop (the watchers' painting, animated, with the TV playing: a full-screen video texture
# behind chapter VIII, looped while drawn; src/gl/scenes/plates.js) for the web. The master is the live site's
# delivered file (public/assets/video/results.mp4 = https://creativemotley.com/results/results_stage.mp4: 1920x1080
# H.264 at 4.25 Mb/s, 24 fps, 20 s).
#   out: public/assets/video/film/results-1920-av1.mp4   AV1, where canPlayType says so (Chrome, Edge, Firefox,
#                                                         recent Safari): 1.93 MB (was 3.88 MB at crf 44 / preset 5 /
#                                                         2 s GOP; preset 4 with a 10 s GOP and overlays carries the
#                                                         same picture at crf 50)
#        public/assets/video/film/results-1920-hevc.mp4  HEVC (hvc1), for Safari without AV1: 2.08 MB
#        public/assets/video/film/results-1920-h264.mp4  H.264 High, every other browser: 4.06 MB (was 6.09 MB)
# The loop restarts on a keyframe; a 10 s GOP costs nothing there (the backdrop never seeks).
# The narrow-window encode (public/assets/video/results-sm.mp4, 1100 px, desktop windows under 900 px) is unchanged;
# phones are on the still path and never load a video here.
# usage: scripts/encode-results.sh [av1 crf=50] [hevc crf=32] [h264 crf=28]
set -euo pipefail
cd "$(dirname "$0")/.."
CRFAV1=${1:-50}; CRF265=${2:-32}; CRF264=${3:-28}
SRC=public/assets/video/results.mp4
OUT=public/assets/video/film
mkdir -p "$OUT"
VF="format=yuv420p"
nice -n 10 ffmpeg -hide_banner -loglevel error -y -i "$SRC" -an -vf "$VF" \
  -c:v libsvtav1 -preset 4 -crf "$CRFAV1" -g 240 -svtav1-params "tune=0:enable-overlays=1" -movflags +faststart "$OUT/results-1920-av1.mp4"
nice -n 10 ffmpeg -hide_banner -loglevel error -y -i "$SRC" -an -vf "$VF" \
  -c:v libx265 -preset slow -crf "$CRF265" -g 240 -x265-params "log-level=error:keyint=240:min-keyint=24:aq-mode=3" \
  -tag:v hvc1 -movflags +faststart "$OUT/results-1920-hevc.mp4"
nice -n 10 ffmpeg -hide_banner -loglevel error -y -i "$SRC" -an -vf "$VF" \
  -c:v libx264 -preset veryslow -crf "$CRF264" -g 240 -bf 3 -profile:v high -level 4.0 -tune film -movflags +faststart "$OUT/results-1920-h264.mp4"
ls -l "$OUT"/results-1920-*
