#!/usr/bin/env bash
# Build and submit a new technician-app version to the App Store via EAS.
#
# Usage:
#   ./scripts/publish-technician-app.sh              # build + submit current app.json version
#   ./scripts/publish-technician-app.sh 1.1.0         # bump version in app.json, then build + submit
#   ./scripts/publish-technician-app.sh --build-only  # skip eas submit
#
# Requires: eas-cli logged in (`eas login`) with access to the agasocial/cadenzaops project.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP_DIR="$ROOT/technician-app"
APP_JSON="$APP_DIR/app.json"

BUILD_ONLY=0
NEW_VERSION=""

for arg in "$@"; do
  case "$arg" in
    --build-only) BUILD_ONLY=1 ;;
    *) NEW_VERSION="$arg" ;;
  esac
done

cd "$APP_DIR"

if ! command -v eas >/dev/null 2>&1; then
  echo "eas-cli not found. Install with: npm install -g eas-cli"
  exit 1
fi

if [[ -n "$NEW_VERSION" ]]; then
  CURRENT_VERSION=$(node -p "require('./app.json').expo.version")
  echo "Bumping version: $CURRENT_VERSION -> $NEW_VERSION"
  node -e "
    const fs = require('fs');
    const path = '$APP_JSON';
    const json = JSON.parse(fs.readFileSync(path, 'utf8'));
    json.expo.version = '$NEW_VERSION';
    fs.writeFileSync(path, JSON.stringify(json, null, 2) + '\n');
  "
  npm --prefix "$APP_DIR" version "$NEW_VERSION" --no-git-tag-version --allow-same-version >/dev/null
  echo "Updated $APP_JSON and package.json to $NEW_VERSION"
fi

echo "Building production iOS binary..."
eas build --platform ios --profile production --non-interactive

if [[ "$BUILD_ONLY" -eq 1 ]]; then
  echo "Build complete. Skipping submit (--build-only)."
  exit 0
fi

echo "Submitting latest build to App Store Connect..."
eas submit --platform ios --profile production --latest --non-interactive

echo "Done. Finish export compliance and release in App Store Connect:"
echo "  https://appstoreconnect.apple.com"
