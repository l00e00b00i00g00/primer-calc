import { describe, expect, it } from 'vitest';
import { TypeScriptBackend } from '../src/backend/backend.js';
import { WasmBackend, loadWasmBackend } from '../src/backend/wasm.js';
import { resolveConditions } from '../src/PrimerAnalyzer.js';

/**
 * Differential fuzzing: 60 seeded random primer pairs (lengths 6–24,
 * mixed GC, occasional degenerate positions resolved canonically) must
 * score identically on both engines — ΔG bit-exact, Tm within 1e-9
 * (libm vs V8 transcendental rounding), structure fields exact.
 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(0x9e3779b9);
const BASES = ['A', 'C', 'G', 'T', 'R', 'Y', 'S', 'W', 'K', 'M'];
const randSeq = (len: number): string =>
  Array.from({ length: len }, () => BASES[Math.floor(rand() * BASES.length)] as string).join('');

const PAIRS: Array<[string, string, boolean]> = Array.from({ length: 60 }, (_, k) => {
  // Every tenth pair is long (40–60 nt) to exercise DP paths at scale.
  const long = k % 10 === 9;
  const len = long ? 40 + Math.floor(rand() * 21) : 6 + Math.floor(rand() * 19);
  const a = randSeq(len);
  // Bias every third pair toward self-complementarity (palindromic risk).
  const b =
    k % 3 === 0 ? [...a].reverse().join('') : randSeq(long ? len : 6 + Math.floor(rand() * 19));
  return [a, b, k % 3 === 0];
});

const CONDS = [
  resolveConditions({}),
  resolveConditions({ salt_method: 'owczarzy' }),
  resolveConditions({ salt_method: 'none', primer_conc: 500, eval_temp_c: 55 }),
];

describe('differential fuzz TS vs WASM (seeded)', () => {
  it('scores 60 random pairs identically on both engines × 3 conditions', async () => {
    const backend = await loadWasmBackend();
    expect(backend?.name).toBe('wasm');
    const wasm = backend as WasmBackend;
    const ts = new TypeScriptBackend();
    for (const cond of CONDS) {
      for (const [a, b, self] of PAIRS) {
        const expected = self ? ts.homodimer(a, cond) : ts.heterodimer(a, b, cond);
        const actual = self ? wasm.homodimer(a, cond) : wasm.heterodimer(a, b, cond);
        expect(actual.found, `${a}/${b}`).toBe(expected.found);
        if (expected.deltaG === null || actual.deltaG === null) {
          expect(actual.deltaG).toBeNull();
          continue;
        }
        expect(actual.deltaG).toBe(expected.deltaG);
        expect(actual.tm as number).toBeCloseTo(expected.tm as number, 9);
        expect(actual.pairedBases).toBe(expected.pairedBases);
        expect(actual.threePrimeRun).toBe(expected.threePrimeRun);
        expect(actual.threePrimeAnchored).toBe(expected.threePrimeAnchored);
      }
    }
  });
});
