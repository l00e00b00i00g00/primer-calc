import { describe, expect, it } from 'vitest';
import { PrimerAnalyzer, resolveConditions } from '../src/PrimerAnalyzer.js';
import { analyzePrimer, calculateTm } from '../src/analyze.js';
import { gcContent } from '../src/sequence/gc.js';
import { meltingTemperature } from '../src/thermo/tm.js';

describe('extreme GC contents (0% / 100%)', () => {
  it('analyses a 0%-GC primer without throwing', () => {
    const r = analyzePrimer('AAAAAAAAAAAAAAAAAAAA');
    expect(r.gcContent).toBe(0);
    // Consistent with the Wallace rule (2 °C per A·T pair ≈ 40 °C)
    expect(r.tm).toBeGreaterThan(35);
    expect(r.tm).toBeLessThan(45);
    expect(r.warnings.some((w) => w.code === 'GC_CONTENT_SUBOPTIMAL')).toBe(true);
  });

  it('analyses a 100%-GC primer without throwing', () => {
    const r = analyzePrimer('GGGGGGGGGGGGGGGGGGGG');
    expect(r.gcContent).toBe(100);
    expect(r.tm).toBeGreaterThan(60);
  });
});

describe('extreme lengths', () => {
  it('handles a very short primer (minimum length)', () => {
    const r = analyzePrimer('ATGC');
    expect(r.length).toBe(4);
    expect(r.tm).toBeLessThan(0);
    expect(r.warnings.some((w) => w.code === 'SEQUENCE_TOO_SHORT')).toBe(true);
  });

  it('handles a very long sequence (200 nt)', () => {
    const r = analyzePrimer('AT'.repeat(100));
    expect(r.length).toBe(200);
    expect(r.warnings.some((w) => w.code === 'SEQUENCE_TOO_LONG')).toBe(true);
  }, 30000);
});

describe('complex degenerate sequences', () => {
  it('supports every IUPAC code in one sequence', () => {
    const seq = 'RYSWKMBDHVN';
    expect(gcContent(seq)).toBeGreaterThan(0);
    expect(gcContent(seq)).toBeLessThan(100);
    const r = analyzePrimer(seq);
    expect(r.degeneracy.factor).toBe(2 ** 6 * 3 ** 4 * 4);
    expect(r.degeneracy.isDegenerate).toBe(true);
  });

  it('keeps weighted Tm inside the variant range', () => {
    const r = analyzePrimer('ATGCNNATGC');
    const { tmMin, tmMax, tmWeighted } = r.degeneracy;
    expect(tmWeighted as number).toBeGreaterThanOrEqual(tmMin as number);
    expect(tmWeighted as number).toBeLessThanOrEqual(tmMax as number);
  });
});

describe('thermodynamic consistency', () => {
  const cond = resolveConditions({});

  it('GC-rich duplexes melt hotter than AT-rich ones at equal length', () => {
    const gc = meltingTemperature('GCGCGCGCGCGCGCGCGCGC', cond);
    const at = meltingTemperature('ATATATATATATATATATAT', cond);
    expect(gc.tmC - at.tmC).toBeGreaterThan(20);
  });

  it('Tm is deterministic across repeated calls', () => {
    const seq = 'ATGCGTAGCTAGCTAGCTA';
    expect(calculateTm(seq)).toBe(calculateTm(seq));
  });

  it('default conditions match the documented spec values', () => {
    const analyzer = new PrimerAnalyzer();
    expect(analyzer.conditions.na_conc).toBe(50);
    expect(analyzer.conditions.mg_conc).toBe(2.5);
    expect(analyzer.conditions.dNTPs_conc).toBe(0.8);
    expect(analyzer.conditions.primer_conc).toBe(200);
    expect(analyzer.conditions.temp_unit).toBe('C');
  });
});

describe('conditions validation', () => {
  it('rejects non-positive primer concentrations', () => {
    expect(() => resolveConditions({ primer_conc: 0 })).toThrow(RangeError);
    expect(() => resolveConditions({ primer_conc: -5 })).toThrow(RangeError);
  });

  it('rejects negative salt and DMSO inputs', () => {
    expect(() => resolveConditions({ na_conc: -1 })).toThrow(RangeError);
    expect(() => resolveConditions({ mg_conc: -1 })).toThrow(RangeError);
    expect(() => resolveConditions({ dNTPs_conc: -1 })).toThrow(RangeError);
    expect(() => resolveConditions({ dmso_percent: -1 })).toThrow(RangeError);
  });

  it('rejects unknown salt methods and temperature units', () => {
    expect(() => resolveConditions({ salt_method: 'owczarzy' as never })).toThrow(RangeError);
    expect(() => resolveConditions({ temp_unit: 'K' as never })).toThrow(RangeError);
  });

  it('rejects non-numeric, NaN and out-of-range conditions', () => {
    expect(() => resolveConditions({ na_conc: 'x' as never })).toThrow(RangeError);
    expect(() => resolveConditions({ primer_conc: NaN })).toThrow(RangeError);
    expect(() => resolveConditions({ eval_temp_c: -300 })).toThrow(RangeError);
  });
});

describe('astronomical degeneracy', () => {
  it('analyses N×100 without overflow, deterministically', () => {
    const seq = 'N'.repeat(100);
    const a = analyzePrimer(seq);
    const b = analyzePrimer(seq);
    expect(a.degeneracy.factor).toBe(4 ** 100);
    expect(a.degeneracy.variantsEnumerated).toBeLessThanOrEqual(4096);
    expect(a.tm).toBe(b.tm);
    expect(a.degeneracy.tmWeighted).toBe(b.degeneracy.tmWeighted);
    expect(a.degeneracy.tmMin as number).toBeLessThanOrEqual(a.degeneracy.tmWeighted as number);
    expect(a.degeneracy.tmWeighted as number).toBeLessThanOrEqual(a.degeneracy.tmMax as number);
  });
});
