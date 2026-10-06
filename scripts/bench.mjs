#!/usr/bin/env node
/**
 * Micro-benchmarks for @sfstudio_tools/primer-calc (uses dist/).
 *
 * Usage:
 *   node scripts/bench.mjs                  # print timings table
 *   node scripts/bench.mjs --write-baseline # (re)write bench-baseline.json
 *   node scripts/bench.mjs --check          # fail if any op is >5x baseline
 *
 * Compare runs on the SAME machine only: absolute timings vary wildly
 * across hardware (CI runners are ~7x slower than dev laptops), so
 * --check is a local before/after tool, deliberately NOT a CI gate.
 */
import { readFileSync, existsSync, writeFileSync } from 'node:fs';

const lib = await import('../dist/index.js');
const cond = lib.resolveConditions({});

const CASES = {
  'evaluate 19-mer': () => lib.analyzePrimer('ATGCGTAGCTAGCTAGCTA'),
  'calculateTm 19-mer': () => lib.calculateTm('ATGCGTAGCTAGCTAGCTA'),
  'homodimer 20-mer': () =>
    lib.bestDimer('ATCGATCGATCGATCGATCG', 'ATCGATCGATCGATCGATCG', cond, true),
  'heterodimer 16-mer': () => lib.bestDimer('ATCGATCGATCGATCG', 'CGATCGATCGATCGAT', cond, false),
  'hairpin 20-mer': () => lib.bestHairpin('ATATATATATATATATATAT', 37),
  'DP 200-mer': () => lib.tracebackBestAlignment('AT'.repeat(100), 'AT'.repeat(100), 37),
  'degenerate N×8': () => lib.analyzePrimer('NNNNNNNN'),
};

function bench(name, fn, iters) {
  // Warmup, then timed loop.
  for (let i = 0; i < Math.min(10, iters); i++) fn();
  const t0 = process.hrtime.bigint();
  for (let i = 0; i < iters; i++) fn();
  const t1 = process.hrtime.bigint();
  return Number(t1 - t0) / iters;
}

const ITERS = { 'DP 200-mer': 5, 'degenerate N×8': 3, default: 50 };
const results = {};
for (const [name, fn] of Object.entries(CASES)) {
  const iters = ITERS[name] ?? ITERS.default;
  results[name] = bench(name, fn, iters);
}

const rows = Object.entries(results).map(([name, ns]) => ({
  op: name,
  ns_per_op: Math.round(ns),
  ops_per_s: Math.round(1e9 / ns),
}));
console.table(rows);

const baselinePath = new URL('./bench-baseline.json', import.meta.url);
const asJson = Object.fromEntries(rows.map((r) => [r.op, r.ns_per_op]));
if (process.argv.includes('--write-baseline')) {
  writeFileSync(baselinePath, JSON.stringify(asJson, null, 2) + '\n');
  console.log('baseline written.');
} else if (process.argv.includes('--check')) {
  if (!existsSync(baselinePath)) {
    console.error('No baseline; run: node scripts/bench.mjs --write-baseline');
    process.exit(2);
  }
  const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'));
  let failed = 0;
  for (const { op, ns_per_op } of rows) {
    const ref = baseline[op];
    if (ref === undefined) {
      console.error(`No baseline for "${op}"`);
      failed++;
    } else if (ns_per_op > 5 * ref) {
      console.error(`REGRESSION: "${op}" ${ns_per_op}ns > 5x baseline ${ref}ns`);
      failed++;
    }
  }
  if (failed > 0) process.exit(1);
  console.log('bench check OK (all within 5x of baseline).');
}
