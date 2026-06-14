#!/usr/bin/env bash
# Capture App Store screenshots from the booted iOS simulator.
# Usage:
#   ./scripts/capture-screenshot.sh 02-jobs.png          # iPhone 16 Pro Max
#   ./scripts/capture-screenshot.sh --ipad 02-jobs.png   # iPad Pro 13-inch

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

IPHONE_UDID="${IPHONE_SIMULATOR_UDID:-6460BBC2-8F26-4C77-B16A-6CE6E33CB8C4}"
IPAD_UDID="${IPAD_SIMULATOR_UDID:-069A17F7-3D1E-4CD1-93D7-F5698D6B0A7A}"

DEVICE="$IPHONE_UDID"
OUT_DIR="$ROOT/app-store-screenshots"

if [[ "${1:-}" == "--ipad" ]]; then
  DEVICE="$IPAD_UDID"
  OUT_DIR="$ROOT/app-store-screenshots/ipad-13"
  shift
fi

mkdir -p "$OUT_DIR"
NAME="${1:-screenshot-$(date +%Y%m%d-%H%M%S).png}"
OUT="$OUT_DIR/$NAME"

xcrun simctl io "$DEVICE" screenshot "$OUT"
W=$(sips -g pixelWidth "$OUT" | awk '/pixelWidth/{print $2}')
H=$(sips -g pixelHeight "$OUT" | awk '/pixelHeight/{print $2}')
echo "Saved $OUT (${W}x${H})"
