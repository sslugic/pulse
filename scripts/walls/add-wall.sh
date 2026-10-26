#!/bin/sh
# Adds a Figma AI wall to the app: scripts/walls/add-wall.sh <wallId> <file-stem> <figma-asset-id>
# Downloads the PNG, saves assets/images/walls/<file-stem>.jpg, wires `art` in src/lib/walls.ts and
# marks the wall done in scripts/walls/examples-v3/README.md.
set -e
cd "$(dirname "$0")/../.."
id=$1; stem=$2; asset=$3
png=scripts/walls/examples-v3/wall-$stem.png
curl -sfL -o "$png" "https://www.figma.com/api/mcp/asset/$asset.png"
python3 - "$id" "$stem" "$png" <<'PY'
import re, sys
from PIL import Image
wid, stem, png = sys.argv[1:4]
Image.open(png).convert('RGB').save(f'assets/images/walls/{stem}.jpg', quality=82, optimize=True, progressive=True)
p = 'src/lib/walls.ts'; s = open(p).read()
s, n = re.subn(r"\{ id: '%s', ([^}]*?) \}" % wid, lambda m: "{ id: '%s', %s, art: require('@/assets/images/walls/%s.jpg') }" % (wid, m.group(1).rstrip(', '), stem) if 'art:' not in m.group(1) else m.group(0), s)
assert n == 1, f'{wid} not found'
open(p, 'w').write(s)
r = 'scripts/walls/examples-v3/README.md'; t = open(r).read()
t = re.sub(r"(\| %s \|[^\n]*)\| todo \|" % wid, r"\1| done |", t)
open(r, 'w').write(t)
PY
echo "added $id"
