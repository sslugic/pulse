#!/bin/sh
# Renders the illustrated app icons (scripts/app-icons/illustrated.html) with headless Chrome into
# OUT (default: a preview folder). With OUT=assets/app-icons it also writes the 180 px thumbs and,
# for Classic, the main icon assets/images/icon.png.
set -e
cd "$(dirname "$0")/.."
CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
OUT="${OUT:-scripts/app-icons/preview}"
mkdir -p "$OUT"
for icon in classic synthwave neon-sign midnight-rain arcade gold-legend; do
  "$CHROME" --headless=new --disable-gpu --hide-scrollbars --allow-file-access-from-files --window-size=1024,1024 \
    --virtual-time-budget=3000 --screenshot="$OUT/$icon.png" "file://$PWD/scripts/app-icons/illustrated.html?s=$icon" >/dev/null 2>&1
  if [ "$OUT" = assets/app-icons ]; then
    sips -z 180 180 "$OUT/$icon.png" --out "$OUT/$icon-thumb.png" >/dev/null
    [ "$icon" = classic ] && cp "$OUT/classic.png" assets/images/icon.png
  fi
  echo "$icon"
done
