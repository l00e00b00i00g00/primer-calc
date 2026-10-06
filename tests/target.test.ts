import { describe, expect, it } from 'vitest';
import { evaluateAgainstTarget } from '../src/target.js';
import { PrimerAnalyzer } from '../src/PrimerAnalyzer.js';
import { PrimerValidationError } from '../src/sequence/validate.js';

describe('evaluateAgainstTarget', () => {
  it('scores a perfect duplex with zero divergence', () => {
    const r = evaluateAgainstTarget('ATGCGTAGCTAG', 'CTAGCTACGCAT');
    expect(r.deltaG as number).toBeCloseTo(-13.43, 1);
    expect(r.deltaDeltaG37 as number).toBeCloseTo(0, 1);
    expect(r.differences).toEqual([]);
    expect(r.threePrime).toBe('paired');
    expect(r.extendable).toBe(true);
    expect(r.hasRisks).toBe(false);
    expect(r.alignedPrimer).toBe('ATGCGTAGCTAG');
    expect(r.alignedTarget).toBe('CTAGCTACGCAT');
  });

  it('reports an internal mismatch with ΔΔG and stays extendable', () => {
    const r = evaluateAgainstTarget('ATGCGTAGCTAG', 'CTAGCAACGCAT');
    expect(r.deltaG as number).toBeCloseTo(-10.45, 1);
    expect(r.deltaDeltaG37 as number).toBeCloseTo(2.98, 1);
    expect(r.differences).toHaveLength(1);
    expect(r.differences[0]).toMatchObject({
      kind: 'mismatch',
      primerIndex: 6,
      primerBase: 'A',
    });
    expect(r.threePrime).toBe('paired');
    expect(r.extendable).toBe(true);
    expect(r.hasRisks).toBe(false);
  });

  it('flags a 3′-terminal mismatch as non-extendable', () => {
    const r = evaluateAgainstTarget('TTTGACAGCCTCTGAC', 'ATCAGAGGCTGTCAAA');
    expect(r.deltaG as number).toBeCloseTo(-18.28, 1);
    expect(r.threePrime).toBe('mismatched');
    expect(r.extendable).toBe(false);
    expect(r.differences).toHaveLength(1);
    expect(r.differences[0]).toMatchObject({
      kind: 'mismatch',
      primerIndex: 15,
      targetIndex: 0,
    });
    expect(r.warnings.some((w) => w.code === 'TARGET_3P_MISMATCH')).toBe(true);
    expect(r.hasRisks).toBe(true);
  });

  it('flags flaps and weak binding on divergent targets', () => {
    const r = evaluateAgainstTarget('ATGCGTAGCTAG', 'CTATCTACTCAT');
    expect(r.threePrime).toBe('unpaired');
    expect(r.extendable).toBe(false);
    expect(r.warnings.some((w) => w.code === 'TARGET_3P_FLAP')).toBe(true);
    expect(r.warnings.some((w) => w.code === 'TARGET_WEAK_BINDING')).toBe(true);
  });

  it('reports no binding as a critical finding', () => {
    const r = evaluateAgainstTarget('AAAAAAAAAAAA', 'AAAAAAAAAAAA');
    expect(r.deltaG).toBeNull();
    expect(r.tm).toBeNull();
    expect(r.deltaDeltaG37).toBeNull();
    expect(r.extendable).toBe(false);
    expect(
      r.warnings.some((w) => w.code === 'TARGET_NO_BINDING' && w.severity === 'critical'),
    ).toBe(true);
    expect(r.hasRisks).toBe(true);
  });

  it('validates both sequences', () => {
    expect(() => evaluateAgainstTarget('ATGCX', 'ATGCATGC')).toThrow(PrimerValidationError);
    expect(() => evaluateAgainstTarget('ATGCATGC', '')).toThrow(PrimerValidationError);
  });

  it('is exposed on PrimerAnalyzer with its conditions', () => {
    const analyzer = new PrimerAnalyzer({ temp_unit: 'F' });
    const r = analyzer.evaluateAgainstTarget('ATGCGTAGCTAG', 'CTAGCTACGCAT');
    expect(r.tmUnit).toBe('F');
    expect(r.tm as number).toBeGreaterThan(90);
  });
});
