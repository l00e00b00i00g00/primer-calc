#!/usr/bin/env node
/**
 * Shipped-artifact size budgets (gzip bytes, deterministic).
 *
 * Usage: node scripts/check-size.mjs [--write-baseline]
 * Without flags: fails (exit 1) when any artifact exceeds its budget.
 * Budgets live below; raise them deliberately with a note when features
 * legitimately grow the bundle.
 */
import { readFileSync, existsSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

const BUDGETS = {
  'dist/index.js': 17_000, // v0.2.1: pair/target/batch/modes APIs
  'dist/index.cjs': 18_500, // v0.2.1: pair/target/batch/modes APIs
  'dist/worker.js': 7_500,
  'wasm-pkg/primer_calc_wasm_bg.wasm': 30_000,
};

let failed = 0;
for (const [file, budget] of Object.entries(BUDGETS)) {
  if (!existsSync(file)) {
    console.error(`MISSING: ${file} (run npm run build first)`);
    failed++;
    continue;
  }
  const size = gzipSync(readFileSync(file)).length;
  const ok = size <= budget;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${file}: ${size} bytes (budget ${budget})`);
  if (!ok) failed++;
}
process.exit(failed > 0 ? 1 : 0);
