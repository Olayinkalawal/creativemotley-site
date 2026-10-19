#!/usr/bin/env bash
# Encode the hero film as short-GOP video for scroll scrubbing (src/gl/lib/video.js, src/gl/lib/codecStream.js).
#   source: public/assets/frames/hero/lg/f_0001…f_0570.webp, the 570 painted frames (f_0001–0417 are 1920×1080,
#           f_0418–0570 2400×1350: every frame is scaled to one size here)
#   cut:    v3 plays only the frames listed in FILM_CUT (src/gl/lib/filmRanges.js, read from there so the scene and the
#           encode can never disagree): the static opening (frames 0–200 are the hero painting, unchanged) is a short
#           ramp, the hand-off and push-in play every other frame (the render has a near-duplicate every other frame
#           there), the near-black inside of the lens is crossed in a handful of frames, and the machine drawing the
#           Storytellers painting plays every other frame. 570 → 161 frames.
#   out:    public/assets/video/film/hero-cut-<W>-h264.mp4  H.264 High, a keyframe every 8 frames (+2 B-frames); plays everywhere
#           public/assets/video/film/hero-cut-<W>-av1.mp4   AV1 (SVT-AV1), same GOP, for browsers whose canPlayType says so
#   A light temporal denoise (hqdn3d) comes first: the paintings' fine grain costs bits and the stage's post pass adds
#   its own animated grain over the film anyway.
#   Calibration (phase 1, 180 frames, SSIM against the 1920 source): AV1 crf 55 ≈ 0.970, H.264 crf 30 ≈ 0.967.
# usage: scripts/encode-film.sh [width=1920] [h264 crf=30] [av1 crf=55] [keyint=8]
# The film is 30 fps: video frame j is at (j + 0.5) / 30 s (the scrubber seeks to frame centres).
set -euo pipefail
cd "$(dirname "$0")/.."
W=${1:-1920}; CRF264=${2:-30}; CRFAV1=${3:-55}; G=${4:-8}
H=$(( W * 9 / 16 / 2 * 2 ))
SRC=public/assets/frames/hero/lg
OUT=public/assets/video/film
mkdir -p "$OUT"
CUT=$(sed -n "s/^export const FILM_CUT = '\([^']*\)';.*/\1/p" src/gl/lib/filmRanges.js)
[ -n "$CUT" ] || { echo "FILM_CUT not found in src/gl/lib/filmRanges.js" >&2; exit 1; }
TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT
n=0
for part in ${CUT//,/ }; do
  span=${part%%:*}; step=1; [ "$span" != "$part" ] && step=${part##*:}
  a=${span%%-*}; b=${span##*-}
  for (( i=a; i<=b; i+=step )); do
    n=$((n + 1)); ln -s "$PWD/$SRC/$(printf 'f_%04d.webp' $((i + 1)))" "$TMP/$(printf 'c_%04d.webp' $n)"
  done
done
echo "film cut: $n frames ($CUT)"
VF="hqdn3d=2.5:2:4:3,scale=${W}:${H}:flags=lanczos,format=yuv420p"
nice -n 10 ffmpeg -hide_banner -loglevel error -y -framerate 30 -start_number 1 -i "$TMP/c_%04d.webp" -vf "$VF" \
  -c:v libx264 -preset veryslow -crf "$CRF264" -g "$G" -keyint_min "$G" -sc_threshold 0 -bf 2 \
  -profile:v high -level 4.0 -movflags +faststart -an "$OUT/hero-cut-${W}-h264.mp4"
nice -n 10 ffmpeg -hide_banner -loglevel error -y -framerate 30 -start_number 1 -i "$TMP/c_%04d.webp" -vf "$VF" \
  -c:v libsvtav1 -preset 5 -crf "$CRFAV1" -g "$G" -svtav1-params "tune=0:scd=0:enable-overlays=0:hierarchical-levels=3" \
  -movflags +faststart -an "$OUT/hero-cut-${W}-av1.mp4"
ls -l "$OUT"/hero-*
