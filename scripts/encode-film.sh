#!/usr/bin/env bash
# Encode the hero film (570 painted frames) as short-GOP video for scroll scrubbing (src/gl/lib/video.js).
#   source: public/assets/frames/hero/lg/f_0001…f_0570.webp (f_0001–0417 are 1920×1080, f_0418–0570 2400×1350:
#           every frame is scaled to one size here, so the video has none of the frame streams' size change)
#   out:    public/assets/video/film/hero-<W>-h264.mp4   H.264 High, a keyframe every 8 frames (+2 B-frames), so any
#                                                        frame decodes from at most 7 others; plays everywhere
#           public/assets/video/film/hero-<W>-av1.mp4    AV1 (SVT-AV1), same GOP, for browsers whose canPlayType says so
#   A light temporal denoise (hqdn3d) comes first: the paintings' fine grain costs bits and the stage's post pass
#   adds its own animated grain over the film anyway.
#   Calibrated on 180 frames (120 of them the vortex, the hardest stretch), SSIM against the 1920 source:
#     AV1 crf 55  ≈ 0.970 (whole film: 4.7 MB; the old 1100-px WebP frames: 20.9 MB at 0.957 upscaled);
#     H.264 crf 30 ≈ 0.967 (whole film: 6.4 MB).
# usage: scripts/encode-film.sh [width=1920] [h264 crf=30] [av1 crf=50] [keyint=8]
# The film is 30 fps: frame i is at (i + 0.5) / 30 s (the scrubber seeks to frame centres).
set -euo pipefail
cd "$(dirname "$0")/.."
W=${1:-1920}; CRF264=${2:-30}; CRFAV1=${3:-55}; G=${4:-8}
H=$(( W * 9 / 16 / 2 * 2 ))
SRC=public/assets/frames/hero/lg
OUT=public/assets/video/film
mkdir -p "$OUT"
VF="hqdn3d=2.5:2:4:3,scale=${W}:${H}:flags=lanczos,format=yuv420p"
nice -n 10 ffmpeg -hide_banner -loglevel error -y -framerate 30 -start_number 1 -i "$SRC/f_%04d.webp" -vf "$VF" \
  -c:v libx264 -preset veryslow -crf "$CRF264" -g "$G" -keyint_min "$G" -sc_threshold 0 -bf 2 \
  -profile:v high -level 4.0 -movflags +faststart -an "$OUT/hero-${W}-h264.mp4"
nice -n 10 ffmpeg -hide_banner -loglevel error -y -framerate 30 -start_number 1 -i "$SRC/f_%04d.webp" -vf "$VF" \
  -c:v libsvtav1 -preset 5 -crf "$CRFAV1" -g "$G" -svtav1-params "tune=0:scd=0:enable-overlays=0:hierarchical-levels=3" \
  -movflags +faststart -an "$OUT/hero-${W}-av1.mp4"
ls -l "$OUT"
