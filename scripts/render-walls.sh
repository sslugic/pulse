#!/bin/sh
# Renders the 15 rank walls (scripts/walls/scenes.html) to assets/images/walls/wall-NN.jpg with
# headless Chrome. Phone-sized at 2x (860 x 1864), JPEG so the set stays small.
# Run: sh scripts/render-walls.sh
set -e
cd "$(dirname "$0")/.."
CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
OUT=assets/images/walls
TMP=$(mktemp -d)
mkdir -p "$OUT"
i=1
for scene in back-alley handball-court night-street bodega-corner basketball-court rooftop subway-station subway-tunnel \
  train-yard bridge-underpass neon-club block-party billboard-square hall-of-fame pulse-tower; do
  n=$(printf %02d $i)
  "$CHROME" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=2 --window-size=430,932 \
    --virtual-time-budget=2000 --screenshot="$TMP/$n.png" "file://$PWD/scripts/walls/scenes.html?s=$scene" >/dev/null 2>&1
  sips -s format jpeg -s formatOptions 82 "$TMP/$n.png" --out "$OUT/wall-$n.jpg" >/dev/null
  echo "wall-$n $scene"
  i=$((i + 1))
done
rm -rf "$TMP"
