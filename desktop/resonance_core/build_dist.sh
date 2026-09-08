#!/bin/bash
# Resonance SDK v1.0 - CDN Distribution Builder
# Bundles the SDK and dependencies into a single, production-ready minified file.

echo "=================================================="
echo "📦 Building Resonance SDK CDN Distribution Package"
echo "=================================================="

# Create dist directory if it doesn't exist
mkdir -p dist

# Bundle as minified ESM module
echo "→ Bundling resonance_sdk.min.js..."
npx esbuild sdk/resonance_sdk.js \
  --bundle \
  --minify \
  --format=esm \
  --platform=neutral \
  --external:fs \
  --external:path \
  --external:url \
  --outfile=dist/resonance_sdk.min.js

# Bundle as non-minified ESM module for debugging
echo "→ Bundling resonance_sdk.js (non-minified)..."
npx esbuild sdk/resonance_sdk.js \
  --bundle \
  --format=esm \
  --platform=neutral \
  --external:fs \
  --external:path \
  --external:url \
  --outfile=dist/resonance_sdk.js

# Copy static assets (WASM core and corpus embeds) for CDN hosting
echo "→ Copying static assets for CDN distribution..."
cp wasm/spectral_core.wasm dist/
cp tr_corpus_embed.js dist/

echo "=================================================="
echo "✨ CDN Distribution Package build successful!"
echo "📂 Output Directory: dist/"
echo "   ├── resonance_sdk.min.js      (Minified JS bundle)"
echo "   ├── resonance_sdk.js          (Debug JS bundle)"
echo "   ├── spectral_core.wasm        (Accelerated WASM binary)"
echo "   └── tr_corpus_embed.js        (Turkish Corpus embeddings)"
echo "=================================================="
