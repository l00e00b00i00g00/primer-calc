import { describe, expect, it } from 'vitest';
import { analyzeBatch } from '../src/batch.js';
import { analyzePrimer } from '../src/analyze.js';

describe('analyzeBatch', () => {
  it('matches per-primer analysis in order, echoing ids', () => {
    const primers = [
      'ATGCGTAGCTAGCTAGCTA',
      { id: 'gc8', seq: 'GCGCGCGC' },
      { id: 'at20', seq: 'ATATATATATATATATATAT' },
    ];
    const out = analyzeBatch(primers);
    expect(out).toHaveLength(3);
    expect(out[0]?.id).toBeUndefined();
    expect(out[1]).toMatchObject({ id: 'gc8', sequence: 'GCGCGCGC' });
    expect(out[2]).toMatchObject({ id: 'at20' });
    expect(out[0]?.tm).toBe(analyzePrimer('ATGCGTAGCTAGCTAGCTA').tm);
    expect(out[1]?.tm).toBe(analyzePrimer('GCGCGCGC').tm);
  });

  it('shares conditions across the batch', () => {
    const out = analyzeBatch(['ATGCGTAGCTAGCTAGCTA'], { temp_unit: 'F' });
    expect(out[0]?.tmUnit).toBe('F');
    expect(out[0]?.tm).toBeGreaterThan(120);
  });

  it('handles an empty batch', () => {
    expect(analyzeBatch([])).toEqual([]);
  });

  it('validates labelled entries', () => {
    expect(() => analyzeBatch([{ id: 42 as never, seq: 'ATGCATGC' }])).toThrow(
      /non-empty string id/,
    );
    expect(() => analyzeBatch([{ id: '', seq: 'ATGCATGC' }])).toThrow(/non-empty string id/);
    expect(() => analyzeBatch([{ id: 'x', seq: 'ATGCX' } as never])).toThrow();
  });
});
