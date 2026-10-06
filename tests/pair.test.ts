import { describe, expect, it } from 'vitest';
import { analyzePrimerPair, PAIR_TM_TOLERANCE } from '../src/pair.js';
import { PrimerValidationError } from '../src/sequence/validate.js';

describe('analyzePrimerPair', () => {
  it('flags Tm mismatch and critical cross-dimer', () => {
    const r = analyzePrimerPair('ATGCGTAGCTAGCTAGCTA', 'GCTAGCTAGCTAGCTA');
    expect(r.tmDifference).toBeCloseTo(7.46, 1);
    expect(r.tmMatched).toBe(false);
    expect(r.crossDimer.deltaG as number).toBeLessThan(-9);
    expect(r.warnings.some((w) => w.code === 'PAIR_TM_MISMATCH' && w.severity === 'warning')).toBe(
      true,
    );
    expect(r.warnings.some((w) => w.code === 'PAIR_CROSS_DIMER' && w.severity === 'critical')).toBe(
      true,
    );
    expect(r.hasRisks).toBe(true);
  });

  it('reports matched Tm within tolerance', () => {
    expect(PAIR_TM_TOLERANCE).toBe(5);
    const r = analyzePrimerPair('GCGCGCGC', 'CGCGCGCG');
    expect(r.tmDifference).toBeCloseTo(0.49, 1);
    expect(r.tmMatched).toBe(true);
  });

  it('reports a clean pair without pair-level warnings', () => {
    const r = analyzePrimerPair('GCTAGCTAGCTAGCTA', 'CGATCGATCGATCGAT');
    expect(r.tmMatched).toBe(true);
    expect(r.crossDimer.deltaG as number).toBeGreaterThan(-6);
    expect(r.warnings).toEqual([]);
  });

  it('grades a weak cross-dimer at warning level', () => {
    // 5-bp GC heterodimer: ΔG°37 ≈ −6.8, anchored but above −7.
    const r = analyzePrimerPair('GCGCG', 'CGCGC');
    expect(r.crossDimer.deltaG as number).toBeGreaterThan(-9);
    expect(r.crossDimer.deltaG as number).toBeLessThanOrEqual(-6);
    expect(r.warnings.some((w) => w.code === 'PAIR_CROSS_DIMER' && w.severity === 'warning')).toBe(
      true,
    );
  });

  it('scales the Tm tolerance to Fahrenheit output', () => {
    const r = analyzePrimerPair('ATGCGTAGCTAGCTAGCTA', 'GCTAGCTAGCTAGCTA', { temp_unit: 'F' });
    expect(r.tmMatched).toBe(false);
    expect(r.warnings.some((w) => w.code === 'PAIR_TM_MISMATCH')).toBe(true);
    // 7.46 °C gap ≈ 13.4 °F, tolerance 9 °F.
    expect(r.tmDifference).toBeCloseTo(7.46 * 1.8, 0);
  });

  it('validates both sequences', () => {
    expect(() => analyzePrimerPair('ATGCX', 'ATGCATGC')).toThrow(PrimerValidationError);
    expect(() => analyzePrimerPair('ATGCATGC', 'AUGC')).toThrow(PrimerValidationError);
  });
});
