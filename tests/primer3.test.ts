import { describe, expect, it } from 'vitest';
import { calculateTm } from '../src/analyze.js';
import { bestDimer } from '../src/structure/dimer.js';
import { resolveConditions } from '../src/PrimerAnalyzer.js';
import goldens from './primer3-goldens.json';

/**
 * Cross-validation against Primer3 (spec §5, gold standards).
 *
 * Reference values live in `tests/primer3-goldens.json`, frozen from
 * primer3-py 2.3.1 and continuously re-validated:
 * `python3 scripts/primer3-regen.py --check` (weekly CI job) fails on drift.
 * Regenerate with `python3 scripts/primer3-regen.py` (needs primer3-py);
 * the npm package itself never depends on Python.
 *
 * Matched engine conditions: 1 M monovalent, no divalent, effective 50 nM
 * in both engines (ours: Ct/4 at 200 nM total; primer3: dna_conc/2 at
 * 100 nM total).
 *
 * Findings encoded here:
 * - differential stack structure is IDENTICAL (pairwise Tm deltas ≤ 0.05 °C);
 * - absolute residuals ≤ 2.5 °C concentrate on mixed AT/GC stack contexts
 *   (≈ +0.08 kcal/mol per mixed stack), consistent with the documented
 *   1998-unified → 2004 NN table revisions; pure-AT/GC contexts agree ≤ 0.2 °C;
 * - full-condition Tm rank order is identical: the engines
 *   disagree on conventions (Ct/2 vs Ct/4, salt model), never on ranking.
 */

interface Goldens {
  matched_tm: Record<string, number>;
  pair_deltas: Array<[string, string, number]>;
  homodimer_dg: Record<string, number>;
  full_tm: Record<string, number>;
}

const G = goldens as unknown as Goldens;

const MATCHED_COND = {
  na_conc: 1000,
  mg_conc: 0,
  dNTPs_conc: 0,
  primer_conc: 200,
};

describe('Primer3 cross-validation (frozen goldens)', () => {
  it('matches Primer3 Tm at matched engine conditions (≤ 2.5 °C)', () => {
    for (const [seq, expected] of Object.entries(G.matched_tm)) {
      expect(
        Math.abs(calculateTm(seq, MATCHED_COND) - expected),
      ).toBeLessThanOrEqual(2.5);
    }
  });

  it('reproduces Primer3 differential stack structure (≤ 0.05 °C)', () => {
    for (const [a, b, expectedDelta] of G.pair_deltas) {
      const delta = calculateTm(a, MATCHED_COND) - calculateTm(b, MATCHED_COND);
      expect(Math.abs(delta - expectedDelta)).toBeLessThanOrEqual(0.05);
    }
  });

  it('matches Primer3 homodimer ΔG°37 (≤ 1.5 kcal/mol)', () => {
    const cond = resolveConditions({});
    for (const [seq, expected] of Object.entries(G.homodimer_dg)) {
      const d = bestDimer(seq, seq, cond, true);
      expect(Math.abs((d.deltaG as number) - expected)).toBeLessThanOrEqual(
        1.5,
      );
    }
  });

  it('ranks primers identically to Primer3 under PCR conditions', () => {
    const entries = Object.entries(G.full_tm);
    const ours = entries.map(
      ([seq]) => [seq, calculateTm(seq)] as [string, number],
    );
    for (let i = 0; i < entries.length; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        const refI = entries[i] as [string, number];
        const refJ = entries[j] as [string, number];
        const ourI = ours[i] as [string, number];
        const ourJ = ours[j] as [string, number];
        expect(Math.sign(ourI[1] - ourJ[1])).toBe(
          Math.sign(refI[1] - refJ[1]),
        );
      }
    }
  });
});
