#!/bin/bash
# Builds the compiled Rust/WASM core:
# - wasm-pkg/            → experimental-nodejs-module output (Node.js)
# - wasm-pkg/web/        → web output (browsers / bundlers, fetch-based)
# wasm-pkg/ is publishable as @synthflow/primer-calc-wasm (see its package.json).
# Requires the Rust toolchain with the wasm32-unknown-unknown target and the
# wasm-bindgen CLI:
#   rustup target add wasm32-unknown-unknown
#   cargo install wasm-bindgen-cli   (or download a matching release)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
export PATH="$HOME/.cargo/bin:$PATH"
WASM="$ROOT/wasm/target/wasm32-unknown-unknown/release/primer_calc_wasm.wasm"
cargo build --release --target wasm32-unknown-unknown --manifest-path "$ROOT/wasm/Cargo.toml"
rm -rf "$ROOT/wasm-pkg"
wasm-bindgen "$WASM" \
  --out-dir "$ROOT/wasm-pkg" \
  --target experimental-nodejs-module
wasm-bindgen "$WASM" \
  --out-dir "$ROOT/wasm-pkg/web" \
  --target web
node -e "
const fs = require('node:fs');
const root = '$ROOT';
const pkg = {
  name: '@synthflow/primer-calc-wasm',
  version: require(root + '/package.json').version,
  description: 'Compiled Rust/WASM dimer engine for @synthflow/primer-calc.',
  license: 'Apache-2.0',
  publishConfig: { access: 'public' },
  type: 'module',
  main: './primer_calc_wasm.js',
  types: './primer_calc_wasm.d.ts',
  files: [
    'primer_calc_wasm.js',
    'primer_calc_wasm_bg.wasm',
    'primer_calc_wasm.d.ts',
    'web/primer_calc_wasm.js',
    'web/primer_calc_wasm_bg.wasm',
    'web/primer_calc_wasm.d.ts',
  ],
};
fs.writeFileSync(root + '/wasm-pkg/package.json', JSON.stringify(pkg, null, 2) + '\n');
"
echo "wasm-pkg built (nodejs + web)."
