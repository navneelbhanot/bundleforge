#!/bin/sh
# Cart-Transform Function build pipeline.
#
# Shopify's CLI now requires Functions to be compiled to WebAssembly.
# JS sources go through:
#   1. esbuild — bundles src/run.js + its imports (./pricing.js)
#      into a single ESM file, since Javy doesn't resolve relative
#      imports on its own.
#   2. javy compile — converts the bundled JS to a self-contained
#      .wasm module with the QuickJS runtime embedded.
#
# Both tools come from the repo's root devDependencies — paths
# relative to this script's cwd (the extension directory).
set -e

mkdir -p dist

../../node_modules/.bin/esbuild src/run.js \
  --bundle \
  --platform=neutral \
  --format=esm \
  --target=es2022 \
  --outfile=dist/bundled.js

../../node_modules/.bin/javy compile dist/bundled.js \
  -o dist/function.wasm
