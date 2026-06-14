#!/usr/bin/env bash
# Capture App Store screenshots from the booted iOS simulator.
# Usage: ./scripts/capture-screenshot.sh [filename]
# Example: ./scripts/capture-screenshot.sh 02-jobs-dashboard.png

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT_DIR="$ROOT/app-store-screenshots"
mkdir -p "$OUT_DIR"

DEVICE="${IOS_SIMULATOR_UDID:-6460BBC2-8F26-4C77-B16A-6CE6E33CB8C4}"
NAME="${1:-screenshot-$(date +%Y%m%d-%H%M%S).png}"
OUT="$OUT_DIR/$NAME"

xcrun simctl io "$DEVICE" screenshot "$OUT"
W=$(sips -g pixelWidth "$OUT" | awk '/pixelWidth/{print $2}')
H=$(sips -g pixelHeight "$OUT" | awk '/pixelHeight/{print $2}')
echo "Saved $OUT (${W}x${H})"
