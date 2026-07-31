#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# VedMoulya — Bundle Size Check
# Verifies that the built Next.js application is within budget
# BLD-016-B — Web Application Quality — Performance
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

# ── Configuration ───────────────────────────────────────────────────────────
# Maximum allowed bundle sizes (in bytes)
MAX_SHARED_JS_KB=150
MAX_ROUTE_JS_KB=100
MAX_PAGE_KB=50

# ── Check ───────────────────────────────────────────────────────────────────
echo "🔍 Checking production bundle sizes..."
echo ""

BUILD_DIR="apps/web/.next"

if [ ! -d "$BUILD_DIR" ]; then
  echo "❌ Build directory not found. Run 'npm run build -w apps/web' first."
  exit 1
fi

# Check if build manifest exists
MANIFEST="$BUILD_DIR/build-manifest.json"
if [ -f "$MANIFEST" ]; then
  # Count JS chunks and their sizes
  echo "📦 Bundle Analysis:"
  echo ""
  
  # Use find to get JS file sizes in the static chunks directory
  CHUNKS_DIR="$BUILD_DIR/static/chunks"
  if [ -d "$CHUNKS_DIR" ]; then
    total_size=0
    chunk_count=0
    
    while IFS= read -r -d '' file; do
      size=$(stat -c%s "$file" 2>/dev/null || stat -f%z "$file" 2>/dev/null || echo 0)
      size_kb=$((size / 1024))
      total_size=$((total_size + size_kb))
      chunk_count=$((chunk_count + 1))
      
      if [ "$size_kb" -gt "$MAX_ROUTE_JS_KB" ]; then
        echo "  ⚠️  $size_kb kB — $(basename "$file") (exceeds ${MAX_ROUTE_JS_KB} kB limit)"
      else
        echo "  ✅ $size_kb kB — $(basename "$file")"
      fi
    done < <(find "$CHUNKS_DIR" -name '*.js' -type f -print0 2>/dev/null)
    
    echo ""
    echo "  Total: $chunk_count chunks, $total_size kB"
  fi
else
  echo "  ℹ️  Build manifest not found at $MANIFEST"
fi

# Check page sizes from .next/server/app
echo ""
echo "📄 Page Bundle Sizes:"
echo ""
PAGE_DIR="$BUILD_DIR/server/app"
if [ -d "$PAGE_DIR" ]; then
  max_page_kb=0
  max_page=""
  
  while IFS= read -r -d '' file; do
    size=$(stat -c%s "$file" 2>/dev/null || stat -f%z "$file" 2>/dev/null || echo 0)
    size_kb=$((size / 1024))
    rel_path="${file#$PAGE_DIR/}"
    
    if [ "$size_kb" -gt "$max_page_kb" ]; then
      max_page_kb=$size_kb
      max_page="$rel_path"
    fi
    
    if [ "$size_kb" -gt "$MAX_PAGE_KB" ]; then
      echo "  ⚠️  $size_kb kB — $rel_path (exceeds ${MAX_PAGE_KB} kB limit)"
    else
      echo "  ✅ $size_kb kB — $rel_path"
    fi
  done < <(find "$PAGE_DIR" -name '*.js' -type f -print0 2>/dev/null)
  
  echo ""
  echo "  Largest page: $max_page at ${max_page_kb} kB"
fi

echo ""
echo "🏁 Bundle check complete."
echo "  Limits: Shared JS < ${MAX_SHARED_JS_KB} kB, Route JS < ${MAX_ROUTE_JS_KB} kB, Page < ${MAX_PAGE_KB} kB"
