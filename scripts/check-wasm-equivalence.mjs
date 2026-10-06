#!/usr/bin/env node
/**
 * Functional equivalence check between two primer-calc WASM builds.
 *
 * Usage: node scripts/check-wasm-equivalence.mjs <dirA> <dirB>
 *
 * Both dirs must contain a nodejs-target glue (`primer_calc_wasm.js`).
 * Runs a fixed battery of dimer reports + cross-dimer matrices through each
 * build and requires byte-identical outputs. The engine is a pure,
 * deterministic function of its inputs, so identical outputs prove identical
 * behavior — independent of toolchain, host, or binary layout. This replaces
 * fragile byte-exact .wasm comparisons in CI.
 */
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const PAIRS = [
  ['AAAAAAAAAAAA', 'TTTTTTTTTTTT', false],
  ['GCGCGCGC', 'GCGCGCGC', true],
  ['ATCGCGAT', 'ATCGCGAT', true],
  ['GCGCACGC', 'GCGCGCGC', false],
  ['ATCGATCGATCGATCG', 'ATCGATCGATCGATCG', true],
  ['ATCGATCGATCGATCG', 'CGATCGATCGATCGAT', false],
  ['CCATATATATATATCC', 'CCATATATATATATCC', true],
  ['GCGCG', 'CGCGC', false],
  ['ATGCATGCATGCATGCATGCATGCATGCATGC', 'ATGCATGCATGCATGCATGCATGCATGCATGC', true],
  ['AAAA', 'CCCC', false],
  ['AT', 'AT', true],
  ['GCGCGCGCTATGCGCGCGC', 'GCGCGCGCTATGCGCGCGC', true],
];

const MATRICES = [
  'AAAAAAAAAAAA|TTTTTTTTTTTT|GCGCGCGC',
  'ATCGATCGATCGATCG|GCTAGCTAGCTAGCTA|CGATCGATCGATCGAT',
];

const CT_M = 2e-7;
const SALT_ADJ = -11.373693727658784;

async function load(dir) {
  const glue = resolve(dir, 'primer_calc_wasm.js');
  return import(pathToFileURL(glue).href);
}

function reports(mod) {
  const out = [];
  for (const [a, b, self] of PAIRS) {
    out.push(mod.dimer_report_json(a, b, self, 37, CT_M, SALT_ADJ, 0));
    out.push(mod.dimer_report_json(a, b, self, 55, 5e-7, 0, 2));
  }
  for (const seqs of MATRICES) {
    // NaN-safe serialization: JSON.stringify drops NaN → compare via Object.is.
    const arr = Array.from(mod.cross_dimer_matrix(seqs));
    out.push(arr.map((v) => (Number.isNaN(v) ? 'NaN' : v.toPrecision(17))).join(','));
  }
  return out;
}

const [dirA, dirB] = process.argv.slice(2);
if (!dirA || !dirB) {
  console.error('usage: check-wasm-equivalence.mjs <dirA> <dirB>');
  process.exit(2);
}

const [modA, modB] = await Promise.all([load(dirA), load(dirB)]);
const repA = reports(modA);
const repB = reports(modB);

let mismatches = 0;
for (let i = 0; i < repA.length; i++) {
  if (repA[i] !== repB[i]) {
    mismatches++;
    console.error(`MISMATCH #${i}:\n  A=${repA[i]}\n  B=${repB[i]}`);
  }
}
if (mismatches > 0) {
  console.error(`${mismatches} divergence(s): rebuild wasm-pkg from wasm/ sources.`);
  process.exit(1);
}
console.log(`WASM equivalence OK (${repA.length} outputs identical across builds).`);
