import { describe, expect, it } from 'vitest';
import { MultiplexPool } from '../src/MultiplexPool.js';
import { PrimerAnalyzer } from '../src/PrimerAnalyzer.js';
import { analyzePrimer, calculateTm } from '../src/analyze.js';
import { PrimerValidationError } from '../src/sequence/validate.js';

const SPEC_CONDITIONS = {
  na_conc: 50,
  mg_conc: 2.5,
  dNTPs_conc: 0.8,
  primer_conc: 200,
  temp_unit: 'C' as const,
};

describe('PrimerAnalyzer (spec §4)', () => {
  it('evaluates the spec example primer', () => {
    const analyzer = new PrimerAnalyzer(SPEC_CONDITIONS);
    const result = analyzer.evaluate('ATGCGTAGCTAGCTAGCTA');

    expect(result.sequence).toBe('ATGCGTAGCTAGCTAGCTA');
    expect(result.length).toBe(19);
    expect(result.gcContent).toBeCloseTo((9 / 19) * 100, 9);
    expect(result.tm).toBeGreaterThan(40);
    expect(result.tm).toBeLessThan(75);
    expect(result.tmUnit).toBe('C');
    expect(result.hairpin.deltaG === null || typeof result.hairpin.deltaG === 'number').toBe(true);
    expect(Array.isArray(result.warnings)).toBe(true);
    expect(typeof result.hasRisks).toBe('boolean');
    expect(result.naEquivalent).toBeCloseTo(206.46, 1);
  });

  it('converts Tm to Fahrenheit with temp_unit F', () => {
    const c = new PrimerAnalyzer({ ...SPEC_CONDITIONS, temp_unit: 'C' }).evaluate(
      'ATGCGTAGCTAGCTAGCTA',
    );
    const f = new PrimerAnalyzer({ ...SPEC_CONDITIONS, temp_unit: 'F' }).evaluate(
      'ATGCGTAGCTAGCTAGCTA',
    );
    expect(f.tmUnit).toBe('F');
    expect(f.tm).toBeCloseTo(c.tm * 1.8 + 32, 6);
  });

  it('flags a critical GC hairpin', () => {
    const result = new PrimerAnalyzer(SPEC_CONDITIONS).evaluate('GCGCGCGCTATGCGCGCGC');
    expect(result.hasRisks).toBe(true);
    expect(
      result.warnings.some((w) => w.code === 'STABLE_HAIRPIN' && w.severity === 'critical'),
    ).toBe(true);
  });

  it('grades a weaker hairpin at warning level', () => {
    // 7-bp GC stem: ΔG°37 in the (−9, −6] window.
    const result = new PrimerAnalyzer(SPEC_CONDITIONS).evaluate('GCGCGCGTATCGCGCGC');
    const hit = result.warnings.find((w) => w.code === 'STABLE_HAIRPIN');
    expect(hit?.severity).toBe('warning');
  });

  it('grades a weaker palindrome at warning level', () => {
    // ATCGCGAT self-dimer ΔG°37 ≈ −8.4: warning, not critical.
    const result = new PrimerAnalyzer(SPEC_CONDITIONS).evaluate('ATCGCGAT');
    const hit = result.warnings.find((w) => w.code === 'STABLE_HOMODIMER');
    expect(hit?.severity).toBe('warning');
  });

  it('flags a critical palindromic homodimer', () => {
    const result = new PrimerAnalyzer(SPEC_CONDITIONS).evaluate('GCGCGCGC');
    expect(
      result.warnings.some((w) => w.code === 'STABLE_HOMODIMER' && w.severity === 'critical'),
    ).toBe(true);
    expect(result.hasRisks).toBe(true);
  });

  it('flags an over-stable 3′ end', () => {
    const result = new PrimerAnalyzer(SPEC_CONDITIONS).evaluate('ATATATATATATATATGGGGG');
    expect(result.warnings.some((w) => w.code === 'STABLE_3P_END')).toBe(true);
  });

  it('flags a critically stable 3′ end', () => {
    const result = new PrimerAnalyzer(SPEC_CONDITIONS).evaluate('ATATATATATATATATGCGCG');
    expect(
      result.warnings.some((w) => w.code === 'STABLE_3P_END' && w.severity === 'critical'),
    ).toBe(true);
  });

  it('weights Tm for degenerate primers', () => {
    const result = new PrimerAnalyzer(SPEC_CONDITIONS).evaluate('ATGCRYATGC');
    expect(result.degeneracy.factor).toBe(4);
    expect(result.degeneracy.isDegenerate).toBe(true);
    expect(result.tm).toBeCloseTo(result.degeneracy.tmWeighted as number, 9);
  });

  it('warns on extreme degeneracy', () => {
    const result = new PrimerAnalyzer(SPEC_CONDITIONS).evaluate('NNNNNNNN');
    expect(result.degeneracy.factor).toBe(65536);
    expect(result.warnings.some((w) => w.code === 'HIGH_DEGENERACY')).toBe(true);
  });

  it('propagates sequence validation errors', () => {
    const analyzer = new PrimerAnalyzer(SPEC_CONDITIONS);
    expect(() => analyzer.evaluate('ATGCX')).toThrow(PrimerValidationError);
    expect(() => analyzer.evaluate('')).toThrow(PrimerValidationError);
    expect(() => analyzer.evaluate('AUGC')).toThrow(PrimerValidationError);
  });
});

describe('quick functions (spec §installation)', () => {
  it('calculateTm matches the analyzer Tm under default conditions', () => {
    const tm = calculateTm('ATGCGTAGCTAGCTAGCTA');
    const expected = new PrimerAnalyzer({}).evaluate('ATGCGTAGCTAGCTAGCTA').tm;
    expect(tm).toBeCloseTo(expected, 9);
  });

  it('calculateTm weights degenerate primers like the analyzer', () => {
    const tm = calculateTm('ATGCATGCATRY');
    const expected = new PrimerAnalyzer({}).evaluate('ATGCATGCATRY').tm;
    expect(tm).toBeCloseTo(expected, 9);
  });

  it('analyzePrimer matches new PrimerAnalyzer().evaluate()', () => {
    const a = analyzePrimer('ATGCGTAGCTAGCTAGCTA');
    const b = new PrimerAnalyzer().evaluate('ATGCGTAGCTAGCTAGCTA');
    expect(a).toEqual(b);
  });
});

describe('MultiplexPool (spec §4)', () => {
  it('evaluates the spec example pool (homodimer conflicts detected)', () => {
    const pool = new MultiplexPool([
      { id: 'primer_fwd_1', seq: 'ATCGATCGATCGATCG' },
      { id: 'primer_rev_1', seq: 'GCTAGCTAGCTAGCTA' },
    ]);
    const crossCheck = pool.evaluateCrossDimerization(SPEC_CONDITIONS);
    expect(crossCheck.ids).toEqual(['primer_fwd_1', 'primer_rev_1']);
    expect(crossCheck.matrix).toHaveLength(2);
    // Symmetric matrix
    expect(crossCheck.matrix[0]?.[1]).toBe(crossCheck.matrix[1]?.[0]);
    // The (ATCG)n repeat slips into a stable shifted homodimer → conflict.
    expect(crossCheck.hasCrossDimers).toBe(true);
    expect(crossCheck.conflicts.length).toBeGreaterThan(0);
    expect(crossCheck.conflicts.every((c) => c.deltaG <= -6)).toBe(true);
  });

  it('detects cross-dimerization between complementary primers', () => {
    // rev_2 is the exact reverse complement of fwd_2 → 16-bp duplex.
    const pool = new MultiplexPool([
      { id: 'primer_fwd_2', seq: 'ATCGATCGATCGATCG' },
      { id: 'primer_rev_2', seq: 'CGATCGATCGATCGAT' },
    ]);
    const crossCheck = pool.evaluateCrossDimerization(SPEC_CONDITIONS);
    expect(crossCheck.hasCrossDimers).toBe(true);
    expect(
      crossCheck.conflicts.some(
        (c) =>
          (c.primerA === 'primer_fwd_2' && c.primerB === 'primer_rev_2') ||
          (c.primerA === 'primer_rev_2' && c.primerB === 'primer_fwd_2'),
      ),
    ).toBe(true);
    expect(crossCheck.conflicts[0]?.severity).toBe('critical');
  });

  it('reports a clean pool without cross-dimers', () => {
    const pool = new MultiplexPool([
      { id: 'a20', seq: 'AAAAAAAAAAAAAAAAAAAA' },
      { id: 'a20b', seq: 'AAAAAAAAAAAAAAAAAAAA' },
    ]);
    const crossCheck = pool.evaluateCrossDimerization(SPEC_CONDITIONS);
    expect(crossCheck.hasCrossDimers).toBe(false);
    expect(crossCheck.conflicts).toEqual([]);
  });

  it('escalates 3′-anchored dimers to critical below −7 kcal/mol', () => {
    // Poly-A/poly-T heterodimer: ΔG°37 ≈ −8.8, fully 3′-anchored.
    const pool = new MultiplexPool([
      { id: 'pa', seq: 'AAAAAAAAAAAA' },
      { id: 'pt', seq: 'TTTTTTTTTTTT' },
    ]);
    const crossCheck = pool.evaluateCrossDimerization(SPEC_CONDITIONS);
    expect(crossCheck.hasCrossDimers).toBe(true);
    const hit = crossCheck.conflicts.find(
      (c) =>
        (c.primerA === 'pa' && c.primerB === 'pt') || (c.primerA === 'pt' && c.primerB === 'pa'),
    );
    expect(hit?.severity).toBe('critical');
    expect(hit?.threePrimeAnchored).toBe(true);
  });

  it('keeps weak dimers at warning level', () => {
    // 5-bp GC heterodimer: ΔG°37 ≈ −6.8, anchored but above −7.
    const pool = new MultiplexPool([
      { id: 'g5a', seq: 'GCGCG' },
      { id: 'g5b', seq: 'CGCGC' },
    ]);
    const crossCheck = pool.evaluateCrossDimerization(SPEC_CONDITIONS);
    expect(crossCheck.hasCrossDimers).toBe(true);
    expect(crossCheck.conflicts.every((c) => c.severity === 'warning')).toBe(true);
  });

  it('does not escalate non-anchored dimers via the 3′ rule', () => {
    // Central-block homodimer: stable (≤ −6) but not 3′-anchored.
    const pool = new MultiplexPool([{ id: 'central', seq: 'CCATATATATATATCC' }]);
    const crossCheck = pool.evaluateCrossDimerization(SPEC_CONDITIONS);
    expect(crossCheck.hasCrossDimers).toBe(true);
    const hit = crossCheck.conflicts.find((c) => c.primerA === 'central');
    expect(hit?.severity).toBe('warning');
    expect(hit?.threePrimeAnchored).toBe(false);
  });

  it('validates pool construction', () => {
    expect(() => new MultiplexPool([])).toThrow();
    expect(() => new MultiplexPool('nope' as never)).toThrow();
    expect(() => new MultiplexPool([{ id: 42 as never, seq: 'ATGCATGC' }])).toThrow(
      /non-empty string id/,
    );
    expect(() => new MultiplexPool([{ id: '', seq: 'ATGCATGC' }])).toThrow(/non-empty string id/);
    expect(
      () =>
        new MultiplexPool([
          { id: 'x', seq: 'ATGCATGC' },
          { id: 'x', seq: 'ATGCATGC' },
        ]),
    ).toThrow(/Duplicate primer id/);
    expect(() => new MultiplexPool([{ id: 'bad', seq: 'ATGCX' }])).toThrow(PrimerValidationError);
  });
});
