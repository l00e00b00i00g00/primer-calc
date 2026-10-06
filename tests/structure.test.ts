import { describe, expect, it } from 'vitest';
import { bestHairpin } from '../src/structure/hairpin.js';
import { bestDimer } from '../src/structure/dimer.js';
import { analyzeThreePrime } from '../src/bias/threePrime.js';
import { resolveConditions } from '../src/PrimerAnalyzer.js';

const cond = resolveConditions({});

describe('bestHairpin', () => {
  it('returns no structure for sequences too short to fold', () => {
    const h = bestHairpin('ATGC', 37);
    expect(h.found).toBe(false);
    expect(h.deltaG).toBeNull();
  });

  it('finds a weak AT hairpin (positive ΔG)', () => {
    const h = bestHairpin('ATATATATATATATATATAT', 37);
    expect(h.found).toBe(true);
    expect(h.deltaG as number).toBeGreaterThan(-6);
  });

  it('flags a stable GC hairpin below the −9 kcal/mol critical line', () => {
    // 8-bp GC stem + TAT loop: ΔG°37 ≈ −10.3 kcal/mol
    const h = bestHairpin('GCGCGCGCTATGCGCGCGC', 37);
    expect(h.found).toBe(true);
    expect(h.deltaG as number).toBeLessThan(-9);
    expect(h.stemLength).toBe(8);
    expect(h.loopLength).toBe(3);
  });

  it('prefers longer, GC-rich stems', () => {
    const weak = bestHairpin('AAAATTTTAAAATTTTAAAA', 37);
    const strong = bestHairpin('GCGCGCGCTATGCGCGCGC', 37);
    expect((strong.deltaG as number)).toBeLessThan(
      (weak.deltaG as number) ?? Infinity,
    );
  });
});

describe('bestDimer', () => {
  it('reports no dimer for non-complementary oligos', () => {
    const d = bestDimer('AAAA', 'AAAA', cond, false);
    expect(d.found).toBe(false);
    expect(d.deltaG).toBeNull();
    expect(d.threePrimeAnchored).toBe(false);
  });

  it('reports no dimer against empty strands', () => {
    expect(bestDimer('', 'ATGC', cond, false).found).toBe(false);
    expect(bestDimer('ATGC', '', cond, false).found).toBe(false);
  });

  it('scores a perfect poly-A/poly-T heterodimer', () => {
    // 12-bp AT duplex (AA/TT stacks): ΔG°37 ≈ −8.84 kcal/mol, 3′-anchored
    const d = bestDimer('AAAAAAAAAAAA', 'TTTTTTTTTTTT', cond, false);
    expect(d.found).toBe(true);
    expect(d.deltaG as number).toBeCloseTo(-8.84, 1);
    expect(d.pairedBases).toBe(12);
    expect(d.threePrimeAnchored).toBe(true);
    expect(d.threePrimeRun).toBe(12);
  });

  it('detects a critical palindromic homodimer', () => {
    // GCGCGCGC is self-complementary: ΔG°37 ≈ −13.0 kcal/mol
    const d = bestDimer('GCGCGCGC', 'GCGCGCGC', cond, true);
    expect(d.found).toBe(true);
    expect(d.deltaG as number).toBeLessThan(-9);
    expect(d.pairedBases).toBe(8);
  });

  it('grades a weaker palindrome at warning level', () => {
    // ATCGCGAT self-dimer: ΔG°37 ≈ −8.4 kcal/mol (warning, not critical)
    const d = bestDimer('ATCGCGAT', 'ATCGCGAT', cond, true);
    expect(d.found).toBe(true);
    expect(d.deltaG as number).toBeGreaterThan(-9);
    expect(d.deltaG as number).toBeLessThanOrEqual(-6);
  });

  it('is symmetric: ΔG(a,b) = ΔG(b,a)', () => {
    const ab = bestDimer('AAAACCCC', 'GGGGTTTT', cond, false);
    const ba = bestDimer('GGGGTTTT', 'AAAACCCC', cond, false);
    expect(ab.deltaG).toBeCloseTo(ba.deltaG as number, 9);
  });

  it('supports disabling the salt correction', () => {
    const nosalt = resolveConditions({ salt_method: 'none' });
    const d = bestDimer('AAAAAAAAAAAA', 'TTTTTTTTTTTT', nosalt, false);
    expect(d.found).toBe(true);
    expect(d.tm as number).toBeGreaterThan(
      (bestDimer('AAAAAAAAAAAA', 'TTTTTTTTTTTT', cond, false).tm as number),
    );
  });

  it('bridges a single internal mismatch with one initiation', () => {
    // A·C mismatch inside an 8-bp block must still be detected, weaker
    // than the perfect block.
    const perfect = bestDimer('GCGCGCGC', 'GCGCGCGC', cond, true);
    const mismatch = bestDimer('GCGCACGC', 'GCGCGCGC', cond, false);
    expect(mismatch.found).toBe(true);
    expect(mismatch.deltaG as number).toBeGreaterThan(
      perfect.deltaG as number,
    );
  });

  it('reports run 0 when the block misses both 3′ termini', () => {
    // Central 12-bp block with 3′ overhangs on both strands: stable but
    // not polymerase-extendable.
    const d = bestDimer('CCATATATATATATCC', 'CCATATATATATATCC', cond, true);
    expect(d.found).toBe(true);
    expect(d.deltaG as number).toBeLessThanOrEqual(-6);
    expect(d.threePrimeRun).toBe(0);
    expect(d.threePrimeAnchored).toBe(false);
  });
});

describe('analyzeThreePrime', () => {
  it('scores the 3′-terminal pentamer (hand-check TATGC ≈ −3.13)', () => {
    const r = analyzeThreePrime('ATATATATATATATATGC');
    expect(r.deltaG37 as number).toBeCloseTo(-3.13, 2);
    expect(r.gcClamp).toBe('double');
    expect(r.gcCount3p).toBe(2);
  });

  it('flags an over-stable GC-rich 3′ end', () => {
    const r = analyzeThreePrime('ATATATATATATATATGGGGG');
    expect(r.deltaG37 as number).toBeLessThan(-5);
    expect(r.gcCount3p).toBe(5);
  });

  it('reports a missing GC clamp', () => {
    const r = analyzeThreePrime('GCGCGCGCGCGCGCGCGATA');
    expect(r.gcClamp).toBe('none');
  });

  it('reports a single GC clamp', () => {
    const r = analyzeThreePrime('GCGCGCGCGCGCGCGCGCGA');
    expect(r.gcClamp).toBe('single');
  });

  it('returns null stability for degenerate windows', () => {
    const r = analyzeThreePrime('ATGCATGCATGCATGCNNNNN');
    expect(r.deltaG37).toBeNull();
  });
});
