#!/usr/bin/env bash
# Regenerate the macOS app icon from build/icon.svg.
#
# Why a script: the SVG canvas is full-bleed, so the rendered PNG must keep a
# TRANSPARENT background. Flattening it onto opaque white (what happened before)
# bakes a 100px white frame around the artwork, which shows up as an outer white
# ring in Finder / Dock / Launchpad.
#
# Rendering uses headless Chrome so the SVG filters (feDropShadow) match the
# original design. Requires: Google Chrome, sips, iconutil.
set -euo pipefail

cd "$(dirname "$0")/.."

SVG="build/icon.svg"
MASTER="build/icon.svg.png"
ICONSET="build/icon.iconset"
ICNS="build/icon.icns"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
SIZE=1024

if [[ ! -x "$CHROME" ]]; then
  echo "error: Google Chrome not found at $CHROME" >&2
  echo "       install it, or render $SVG with any engine that keeps alpha" >&2
  exit 1
fi

echo "==> rendering $SVG -> $MASTER (${SIZE}x${SIZE}, transparent)"
"$CHROME" \
  --headless=new \
  --disable-gpu \
  --hide-scrollbars \
  --force-device-scale-factor=1 \
  --default-background-color=00000000 \
  --window-size="${SIZE},${SIZE}" \
  --screenshot="$MASTER" \
  "file://$PWD/$SVG" >/dev/null 2>&1

# Guard against a regression to a opaque-white background, which is invisible
# inside the SVG but shows up as a white ring once the icon is installed.
if command -v magick >/dev/null 2>&1; then
  corner=$(magick "$MASTER" -format "%[pixel:p{0,0}]" info:)
  if [[ "$corner" != *",0)"* ]]; then
    echo "error: corner pixel is not transparent ($corner) — refusing to build a white-framed icon" >&2
    exit 1
  fi
fi

echo "==> slicing $ICONSET"
rm -rf "$ICONSET"
mkdir -p "$ICONSET"

# size -> iconset filenames
emit() {
  local px=$1
  shift
  for name in "$@"; do
    sips -z "$px" "$px" "$MASTER" --out "$ICONSET/$name" >/dev/null
  done
}

emit 16   icon_16x16.png
emit 32   icon_16x16@2x.png icon_32x32.png
emit 64   icon_32x32@2x.png
emit 128  icon_128x128.png
emit 256  icon_128x128@2x.png icon_256x256.png
emit 512  icon_256x256@2x.png icon_512x512.png
emit 1024 icon_512x512@2x.png

echo "==> packing $ICNS"
iconutil -c icns "$ICONSET" -o "$ICNS"

echo "done: $ICNS"
