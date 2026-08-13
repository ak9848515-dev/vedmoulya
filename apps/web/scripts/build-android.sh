#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# VedMoulya — Android Build Pipeline (MOB-002, Task 8)
# Orchestrates a full native build:
#   1. Static export of the web bundle (moves /api route handlers aside)
#   2. `cap sync android` (copies web assets + registers plugins)
#   3. Gradle assembleDebug / assembleRelease / bundleRelease
#
# Requires: Java 17+ (JDK) and the Android SDK (ANDROID_HOME or local.properties).
#
# Usage:
#   ./scripts/build-android.sh debug      → app-debug.apk
#   ./scripts/build-android.sh release    → app-release.apk (signed, needs keystore.properties)
#   ./scripts/build-android.sh bundle     → app-release.aab (signed, for Play Store)
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail
cd "$(dirname "$0")/.."

TARGET="${1:-debug}"

echo "[android] exporting static web bundle…"
node scripts/build-mobile.mjs

echo "[android] syncing Capacitor project…"
npx cap sync android

case "$TARGET" in
  debug)
    echo "[android] assembling debug APK…"
    (cd android && ./gradlew assembleDebug)
    ;;
  release)
    echo "[android] assembling signed release APK…"
    (cd android && ./gradlew assembleRelease)
    ;;
  bundle)
    echo "[android] bundling signed release AAB…"
    (cd android && ./gradlew bundleRelease)
    ;;
  *)
    echo "usage: $0 [debug|release|bundle]" >&2
    exit 1
    ;;
esac

echo "[android] done. Artifacts:"
find android/app/build/outputs -name '*.apk' -o -name '*.aab' | sort
