#!/usr/bin/env bash
# Encode the hero film (570 painted frames) as short-GOP video for scroll scrubbing (src/gl/lib/video.js).
#   source: public/assets/frames/hero/lg/f_0001…f_0570.webp (f_0001–0417 are 1920×1080, f_0418–0570 2400×1350:
#           every frame is scaled to one size here, so the video has none of the frame streams' size change)
#   out:    public/assets/video/film/hero-<W>-h264.mp4   H.264 High, keyframe every 6 frames, no B-frames (any frame
#                                                        decodes from at most 5 others; plays everywhere)
#           public/assets/video/film/hero-<W>-av1.mp4    AV1 (SVT-AV1), same GOP, for browsers whose canPlayType says so
#           public/assets/video/film/poster-<W>.webp     frame 0 (the hero painting), for QA and as a poster
# usage: scripts/encode-film.sh [width=1920] [h264 crf=26] [av1 crf=40] [keyint=6]
# The film is 30 fps: frame i is at (i + 0.5) / 30 s (the scrubber seeks to frame centres).
set -euo pipefail
cd "$(dirname "$0")/.."
W=${1:-1920}; CRF264=${2:-26}; CRFAV1=${3:-40}; G=${4:-6}
H=$(( W * 9 / 16 / 2 * 2 ))
SRC=public/assets/frames/hero/lg
OUT=public/assets/video/film
mkdir -p "$OUT"
VF="scale=${W}:${H}:flags=lanczos,format=yuv420p"
ffmpeg -hide_banner -loglevel error -y -framerate 30 -start_number 1 -i "$SRC/f_%04d.webp" -vf "$VF" \
  -c:v libx264 -preset veryslow -crf "$CRF264" -g "$G" -keyint_min "$G" -sc_threshold 0 -bf 0 \
  -profile:v high -level 4.0 -x264-params "rc-lookahead=12" -movflags +faststart -an "$OUT/hero-${W}-h264.mp4"
ffmpeg -hide_banner -loglevel error -y -framerate 30 -start_number 1 -i "$SRC/f_%04d.webp" -vf "$VF" \
  -c:v libsvtav1 -preset 4 -crf "$CRFAV1" -g "$G" -svtav1-params "tune=0:scd=0:enable-overlays=0:hierarchical-levels=2" \
  -movflags +faststart -an "$OUT/hero-${W}-av1.mp4"
ffmpeg -hide_banner -loglevel error -y -i "$SRC/f_0001.webp" -vf "scale=${W}:${H}:flags=lanczos" -quality 82 "$OUT/poster-${W}.webp"
ls -l "$OUT"
