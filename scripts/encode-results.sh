#!/usr/bin/env bash
# Re-encode the Results backdrop (the watchers' painting with the TV playing: a full-screen video texture behind the
# chapter, looped while drawn; src/gl/scenes/plates.js) for the web: the source is 1920×1080 H.264 at 4.25 Mb/s
# (10.6 MB for 20 s). Most of the frame is a still painting, so a 2-second GOP and a CRF carry it at a fraction.
#   out: public/assets/video/film/results-1920-h264.mp4  (every browser)
#        public/assets/video/film/results-1920-av1.mp4   (where canPlayType says so)
# usage: scripts/encode-results.sh [h264 crf=27] [av1 crf=44]
set -euo pipefail
cd "$(dirname "$0")/.."
CRF264=${1:-27}; CRFAV1=${2:-44}
SRC=public/assets/video/results.mp4
OUT=public/assets/video/film
mkdir -p "$OUT"
nice -n 10 ffmpeg -hide_banner -loglevel error -y -i "$SRC" -an -vf "format=yuv420p" \
  -c:v libx264 -preset veryslow -crf "$CRF264" -g 48 -bf 3 -profile:v high -level 4.0 -movflags +faststart "$OUT/results-1920-h264.mp4"
nice -n 10 ffmpeg -hide_banner -loglevel error -y -i "$SRC" -an -vf "format=yuv420p" \
  -c:v libsvtav1 -preset 5 -crf "$CRFAV1" -g 48 -svtav1-params "tune=0" -movflags +faststart "$OUT/results-1920-av1.mp4"
ls -l "$OUT"/results-*
