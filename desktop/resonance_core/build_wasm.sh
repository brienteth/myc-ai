#!/bin/bash
# Compile Rust to WebAssembly target wasm32-unknown-unknown with size optimizations
mkdir -p wasm
rustc --target wasm32-unknown-unknown --crate-type cdylib -C opt-level=z -C lto -C panic=abort -C link-arg=-s src/lib.rs -o wasm/spectral_core.wasm
echo "=== WASM BUILD COMPLETE ==="
ls -lh wasm/spectral_core.wasm
