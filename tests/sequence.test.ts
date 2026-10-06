import { describe, expect, it } from 'vitest';
import {
  IUPAC_BASES,
  canPair,
  degeneracyFactor,
  expandIupac,
  isIupacBase,
  isWatsonCrickPair,
  reverseComplement,
} from '../src/sequence/iupac.js';
import { PrimerValidationError, normalizeSequence } from '../src/sequence/validate.js';
import { atContent, baseCounts, gcContent } from '../src/sequence/gc.js';
import {
  analyzeDegeneracy,
  canonicalVariant,
  enumerateVariants,
} from '../src/sequence/degenerate.js';
import { resolveConditions } from '../src/PrimerAnalyzer.js';

describe('IUPAC codes', () => {
  it('recognises all 15 IUPAC codes', () => {
    expect(Object.keys(IUPAC_BASES)).toHaveLength(15);
    for (const code of 'ACGT RYSWKMBDHVN'.replace(' ', '')) {
      expect(isIupacBase(code)).toBe(true);
      expect(isIupacBase(code.toLowerCase())).toBe(true);
    }
    expect(isIupacBase('X')).toBe(false);
    expect(isIupacBase('U')).toBe(false);
  });

  it('expands ambiguous codes', () => {
    expect(expandIupac('R')).toEqual(['A', 'G']);
    expect(expandIupac('n')).toEqual(['A', 'C', 'G', 'T']);
    expect(() => expandIupac('X')).toThrow();
  });

  it('computes reverse complements including ambiguous codes', () => {
    expect(reverseComplement('ATGC')).toBe('GCAT');
    expect(reverseComplement('atgc')).toBe('GCAT');
    // 5'-A T R G-3' → reverse G R T A → complement C Y A T
    expect(reverseComplement('ATRG')).toBe('CYAT');
    expect(reverseComplement('NNNN')).toBe('NNNN');
    expect(() => reverseComplement('ATX')).toThrow();
  });

  it('computes degeneracy factors D = ∏ nᵢ', () => {
    expect(degeneracyFactor('ATGC')).toBe(1);
    expect(degeneracyFactor('R')).toBe(2);
    expect(degeneracyFactor('RY')).toBe(4);
    expect(degeneracyFactor('NN')).toBe(16);
    expect(degeneracyFactor('RYSWKMBDHVN')).toBe(2 ** 6 * 3 ** 4 * 4);
    expect(() => degeneracyFactor('AX')).toThrow();
  });

  it('tests Watson–Crick pairing', () => {
    expect(isWatsonCrickPair('A', 'T')).toBe(true);
    expect(isWatsonCrickPair('G', 'C')).toBe(true);
    expect(isWatsonCrickPair('A', 'G')).toBe(false);
    // R (A/G) can pair with T via its A member
    expect(canPair('R', 'T')).toBe(true);
    expect(canPair('R', 'A')).toBe(false);
    expect(canPair('N', 'G')).toBe(true);
    expect(canPair('X', 'A')).toBe(false);
    expect(canPair('A', 'X')).toBe(false);
  });
});

describe('normalizeSequence', () => {
  it('normalises case and whitespace', () => {
    expect(normalizeSequence('  atgcry  ')).toBe('ATGCRY');
  });

  it('rejects empty input', () => {
    expect(() => normalizeSequence('')).toThrow(PrimerValidationError);
    expect(() => normalizeSequence('   ')).toThrow(PrimerValidationError);
  });

  it('rejects uracil with a helpful message', () => {
    expect(() => normalizeSequence('AUGC')).toThrowError(/Uracil/);
  });

  it('rejects invalid characters', () => {
    expect(() => normalizeSequence('ATGCX')).toThrowError(/Invalid nucleotide/);
  });

  it('rejects sequences below the thermodynamic minimum', () => {
    expect(() => normalizeSequence('ATG')).toThrowError(/too short/);
  });

  it('rejects sequences above the supported maximum', () => {
    expect(() => normalizeSequence('A'.repeat(501))).toThrowError(/too long/);
  });

  it('rejects non-string input', () => {
    expect(() => normalizeSequence(42 as unknown as string)).toThrow(PrimerValidationError);
  });
});

describe('gcContent', () => {
  it('handles extreme GC contents', () => {
    expect(gcContent('AAAAAAAAAAAAAAAAAAAA')).toBe(0);
    expect(gcContent('GGGGGGGGGGGGGGGGGGGG')).toBe(100);
    expect(gcContent('ATGC')).toBe(50);
  });

  it('counts ambiguous codes fractionally', () => {
    expect(gcContent('R')).toBe(50);
    expect(gcContent('S')).toBe(100);
    expect(gcContent('W')).toBe(0);
    expect(gcContent('N')).toBe(50);
    expect(gcContent('')).toBe(0);
    expect(() => gcContent('X')).toThrow();
  });

  it('complements AT content', () => {
    expect(atContent('ATGC') + gcContent('ATGC')).toBe(100);
  });

  it('counts concrete bases', () => {
    expect(baseCounts('AAGGTTCC')).toEqual({ A: 2, C: 2, G: 2, T: 2 });
  });
});

describe('degeneracy', () => {
  it('enumerates all concrete variants', () => {
    expect([...enumerateVariants('RY')].sort()).toEqual(['AC', 'AT', 'GC', 'GT']);
    expect([...enumerateVariants('ATGC')]).toEqual(['ATGC']);
  });

  it('returns the canonical first-base variant', () => {
    expect(canonicalVariant('RYN')).toBe('ACA');
    expect(() => canonicalVariant('AX')).toThrow();
  });

  it('rejects unknown codes during enumeration', () => {
    expect(() => [...enumerateVariants('AX')]).toThrow();
  });

  it('reports a trivial degeneracy for unambiguous sequences', () => {
    const cond = resolveConditions({});
    const info = analyzeDegeneracy('ATGCATGC', cond);
    expect(info.factor).toBe(1);
    expect(info.isDegenerate).toBe(false);
    expect(info.tmMin).toBeNull();
  });

  it('weights Tm over the variant space (O’Donnell–Maloney)', () => {
    const cond = resolveConditions({});
    const info = analyzeDegeneracy('AN', cond);
    expect(info.factor).toBe(4);
    expect(info.isDegenerate).toBe(true);
    expect(info.tmMin).not.toBeNull();
    expect(info.tmMax).not.toBeNull();
    expect(info.tmMin as number).toBeLessThan(info.tmMax as number);
    expect(info.tmWeighted as number).toBeGreaterThanOrEqual(info.tmMin as number);
    expect(info.tmWeighted as number).toBeLessThanOrEqual(info.tmMax as number);
    expect(info.variantsEnumerated).toBe(4);
  });
});
