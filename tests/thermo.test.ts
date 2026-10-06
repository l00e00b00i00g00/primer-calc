import { describe, expect, it } from 'vitest';
import { danglingParams, nnParams } from '../src/constants.js';
import { alignmentThermodynamics, duplexThermodynamics } from '../src/thermo/nearest-neighbor.js';
import { saltAdjustmentCelsius, sodiumEquivalent, owczarzySaltTm, freeMagnesium } from '../src/thermo/salt.js';
import { gcContent } from '../src/sequence/gc.js';
import { gibbsFreeEnergy } from '../src/thermo/gibbs.js';
import { meltingTemperature } from '../src/thermo/tm.js';
import { hairpinLoopParams } from '../src/constants.js';
import { resolveConditions } from '../src/PrimerAnalyzer.js';

describe('nnParams (SantaLucia 1998 unified)', () => {
  it('returns tabulated stack values', () => {
    expect(nnParams('AA', 'TT')).toEqual({ dH: -7.6, dS: -21.3 });
    expect(nnParams('CG', 'GC')).toEqual({ dH: -10.6, dS: -27.2 });
    expect(nnParams('GC', 'CG')).toEqual({ dH: -9.8, dS: -24.4 });
  });

  it('resolves strand symmetry (TG/AC ≡ CA/GT, TT/AA ≡ AA/TT)', () => {
    expect(nnParams('TG', 'AC')).toEqual(nnParams('CA', 'GT'));
    expect(nnParams('TT', 'AA')).toEqual(nnParams('AA', 'TT'));
    expect(nnParams('CA', 'GT')).toEqual({ dH: -8.5, dS: -22.7 });
  });

  it('returns null for non-Watson–Crick steps', () => {
    expect(nnParams('AA', 'AA')).toBeNull();
    expect(nnParams('AC', 'AC')).toBeNull();
  });
});

describe('duplexThermodynamics', () => {
  it('hand-check: 5′-ATGC-3′ duplex', () => {
    // AT/TA (−7.2/−20.4) + TG/AC≡CA/GT (−8.5/−22.7) + GC/CG (−9.8/−24.4)
    // + initiation (+0.2/−5.7) + one terminal AT (+2.2/+6.9)
    // dH = −25.5 + 0.2 + 2.2 = −23.1 ; dS = −67.5 − 5.7 + 6.9 = −66.3
    const t = duplexThermodynamics('ATGC');
    expect(t.dH).toBeCloseTo(-23.1, 9);
    expect(t.dS).toBeCloseTo(-66.3, 9);
    expect(t.terminalAT).toBe(1);
    expect(gibbsFreeEnergy(t.dH, t.dS, 37)).toBeCloseTo(-2.54, 2);
  });

  it('gold standard: CGTTGA duplex (SantaLucia 1998 worked example)', () => {
    // Reference: ΔH = −40.9 kcal/mol, ΔS = −114.6 cal/(mol·K),
    // ΔG°37 = −5.35 kcal/mol.
    const t = duplexThermodynamics('CGTTGA');
    expect(t.dH).toBeCloseTo(-40.9, 1);
    expect(t.dS).toBeCloseTo(-114.6, 1);
    expect(gibbsFreeEnergy(t.dH, t.dS, 37)).toBeCloseTo(-5.35, 1);
  });

  it('gold standard: GCGCGC duplex (SantaLucia & Hicks 2004 ΔG°37)', () => {
    // dH = 5×stack + 0.2 = −50.4 ; dS = −133.3 ; ΔG°37 ≈ −9.06
    const t = duplexThermodynamics('GCGCGC');
    expect(t.dH).toBeCloseTo(-50.4, 9);
    expect(t.dS).toBeCloseTo(-133.3, 9);
    expect(gibbsFreeEnergy(t.dH, t.dS, 37)).toBeCloseTo(-9.06, 2);
  });

  it('applies the symmetry correction to self-complementary duplexes', () => {
    const plain = duplexThermodynamics('ATAT', false);
    const sym = duplexThermodynamics('ATAT', true);
    expect(sym.dS).toBeCloseTo(plain.dS - 1.4, 9);
    expect(sym.dH).toBeCloseTo(plain.dH, 9);
  });

  it('rejects ambiguous sequences', () => {
    expect(() => duplexThermodynamics('ATGN')).toThrow();
    expect(() => duplexThermodynamics('NATGC')).toThrow();
  });
});

describe('alignmentThermodynamics', () => {
  it('scores a perfect 4-bp block like the duplex model', () => {
    const a = alignmentThermodynamics('ATGC', 'TACG', false);
    const d = duplexThermodynamics('ATGC', false);
    expect(a.dH).toBeCloseTo(d.dH, 9);
    expect(a.dS).toBeCloseTo(d.dS, 9);
  });

  it('breaks stacking across mismatches', () => {
    const broken = alignmentThermodynamics('ATGC', 'TAGG', false);
    const full = alignmentThermodynamics('ATGC', 'TACG', false);
    expect(broken.dH).toBeGreaterThan(full.dH);
  });

  it('rejects misaligned segment lengths', () => {
    expect(() => alignmentThermodynamics('ATGC', 'TAC', false)).toThrow();
  });
});

describe('danglingParams (Bommarito et al. 2000)', () => {
  it('returns tabulated 5′ dangling increments', () => {
    // 5′-A overhang on closing pair A·T: dH 0.2, ΔG°37 −0.51
    const p = danglingParams(true, 'A', 'T', 'A');
    expect(p?.dH).toBeCloseTo(0.2, 9);
    expect(p?.dS).toBeCloseTo(((0.2 + 0.51) * 1000) / 310.15, 2);
  });

  it('returns tabulated 3′ dangling increments', () => {
    // 3′-A overhang on closing pair G·C: dH −2.1, ΔG°37 −0.92
    const p = danglingParams(false, 'G', 'C', 'A');
    expect(p?.dH).toBeCloseTo(-2.1, 9);
    expect(p?.dS).toBeCloseTo(((-2.1 + 0.92) * 1000) / 310.15, 2);
  });

  it('returns null for non-canonical input', () => {
    expect(danglingParams(true, 'A', 'T', 'N')).toBeNull();
  });
});

describe('alignmentThermodynamics flanks', () => {
  it('adds a 3′ dangling end (hand-check)', () => {
    // Blunt ATGC duplex: dH −23.1, dS −66.3.
    // 3′-A overhang on closing C·G: dH −5.9, ΔG°37 −0.82.
    const d = alignmentThermodynamics('ATGC', 'TACG', false, { top3: 'A' });
    expect(d.dH).toBeCloseTo(-29.0, 1);
    expect(d.dS).toBeCloseTo(-82.7, 1);
  });

  it('adds a 5′ dangling end (hand-check)', () => {
    // 5′-G overhang on closing A·T: dH −1.1, ΔG°37 −0.62.
    const d = alignmentThermodynamics('ATGC', 'TACG', false, { top5: 'G' });
    expect(d.dH).toBeCloseTo(-24.2, 2);
  });

  it('leaves blunt alignments unchanged', () => {
    const blunt = alignmentThermodynamics('ATGC', 'TACG', false);
    const explicit = alignmentThermodynamics('ATGC', 'TACG', false, {});
    expect(explicit.dH).toBeCloseTo(blunt.dH, 12);
    expect(explicit.dS).toBeCloseTo(blunt.dS, 12);
  });

  it('scores fully unpaired alignments as initiation-only', () => {
    const d = alignmentThermodynamics('AAAA', 'AAAA', false);
    expect(d.dH).toBeCloseTo(0.2, 12);
    expect(d.dS).toBeCloseTo(-5.7, 12);
  });

  it('breaks stacking across bulges with a fixed penalty', () => {
    // Pairs at 0, 1, 2, 4 (bulge at 3): stacks AA/TT + AG/TC≡CT/GA,
    // one terminal AT, one +3.0 kcal/mol bulge penalty.
    const d = alignmentThermodynamics('AAG-C', 'TTCGC', false);
    expect(d.dH).toBeCloseTo(-7.6 - 7.8 + 0.2 + 2.2 + 3.0, 9);
    expect(d.dS).toBeCloseTo(-21.3 - 21.0 - 5.7 + 6.9, 9);
  });

  it('ignores non-canonical dangling bases', () => {
    const d = alignmentThermodynamics('ATGC', 'TACG', false, { top3: 'N' });
    const blunt = alignmentThermodynamics('ATGC', 'TACG', false);
    expect(d.dH).toBeCloseTo(blunt.dH, 12);
    expect(d.dS).toBeCloseTo(blunt.dS, 12);
  });
});

describe('salt corrections (von Ahsen 2001)', () => {  it('computes the sodium equivalent', () => {
    // 50 + 120·√(2.5 − 0.8) = 50 + 120·√1.7 ≈ 206.46 mM
    expect(sodiumEquivalent(50, 2.5, 0.8)).toBeCloseTo(206.46, 2);
  });

  it('clamps free Mg²⁺ at zero when dNTPs chelate everything', () => {
    expect(sodiumEquivalent(50, 0.5, 0.8)).toBe(50);
  });

  it('computes the 16.6·log₁₀ adjustment', () => {
    expect(saltAdjustmentCelsius(206.46)).toBeCloseTo(-11.37, 2);
    expect(saltAdjustmentCelsius(1000)).toBeCloseTo(0, 9);
  });
});

describe('Owczarzy salt correction (2004/2008, via Biopython goldens)', () => {
  // Frozen from Bio.SeqUtils.MeltingTemp.salt_correction(..., method=7):
  // Tm = 1/(1/Tm_old + corr) − 273.15 for (Na, Mg, dNTPs, seq, Tm_old).
  const GOLDENS: Array<[number, number, number, string, number, number]> = [
    [50, 2.5, 0.8, 'ATGCATGCATGCATGCATGC', 45.0, 37.5904],
    [50, 2.5, 0.8, 'ATGCATGCATGCATGCATGC', 60.0, 51.8842],
    [50, 0.0, 0.0, 'ATGCATGCATGCATGCATGC', 45.0, 31.579],
    [50, 0.0, 0.0, 'ATGCATGCATGCATGCATGC', 60.0, 45.3129],
    [10, 10.0, 0.0, 'GCGCGCGCGCGCGCGCGCGCGCGCG', 45.0, 39.5615],
    [10, 10.0, 0.0, 'GCGCGCGCGCGCGCGCGCGCGCGCG', 60.0, 54.0413],
    [0, 2.5, 0.8, 'ATGCATGCATGCATGCATGC', 45.0, 37.9413],
    [0, 2.5, 0.8, 'ATGCATGCATGCATGCATGC', 60.0, 52.2681],
    [50, 1.0, 2.0, 'ATGCATGCATGCATGCATGC', 45.0, 31.579],
    [50, 1.0, 2.0, 'ATGCATGCATGCATGCATGC', 60.0, 45.3129],
    [200, 5.0, 0.8, 'ATATATATATATATATATATATATAT', 45.0, 38.1194],
    [200, 5.0, 0.8, 'ATATATATATATATATATATATATAT', 60.0, 52.463],
    [50, 0.5, 0.0, 'GCGCGCGCGCGCGCGCGCGC', 45.0, 38.4487],
    [50, 0.5, 0.0, 'GCGCGCGCGCGCGCGCGCGC', 60.0, 52.8234],
  ];

  it('reproduces the reference 1/Tm correction (≤ 0.01 °C)', () => {
    for (const [na, mg, dntp, seq, tmOld, expected] of GOLDENS) {
      expect(
        owczarzySaltTm(tmOld, na, mg, dntp, gcContent(seq) / 100, seq.length),
      ).toBeCloseTo(expected, 2);
    }
  });

  it('computes free Mg²⁺ via the Ka equilibrium (hand-check)', () => {
    // No dNTPs → total returned. Mg 2.5 mM + dNTP 0.8 mM → ≈ 1.715 mM.
    expect(freeMagnesium(2.5, 0)).toBeCloseTo(2.5e-3, 12);
    expect(freeMagnesium(2.5, 0.8)).toBeCloseTo(1.715e-3, 6);
    expect(freeMagnesium(0.5, 2.0)).toBeLessThan(0.5e-3);
  });

  it('rejects zero salt and degenerate lengths', () => {
    expect(() => owczarzySaltTm(60, 0, 0, 0, 0.5, 20)).toThrow(RangeError);
    expect(() => owczarzySaltTm(60, 50, 2.5, 0.8, 0.5, 1)).toThrow(RangeError);
  });
});

describe('meltingTemperature', () => {
  const cond = resolveConditions({});

  it('rises with GC content', () => {
    const gc = meltingTemperature('GGGGGGGG', cond);
    const at = meltingTemperature('ATATATAT', cond);
    expect(gc.tmC).toBeGreaterThan(at.tmC);
  });

  it('rises with salt and primer concentration', () => {
    const low = meltingTemperature('ATGCGTAGCTAGCTAGCTA', resolveConditions({ na_conc: 10 }));
    const high = meltingTemperature('ATGCGTAGCTAGCTAGCTA', resolveConditions({ na_conc: 200 }));
    expect(high.tmC).toBeGreaterThan(low.tmC);
    const dilute = meltingTemperature(
      'ATGCGTAGCTAGCTAGCTA',
      resolveConditions({ primer_conc: 50 }),
    );
    const conc = meltingTemperature('ATGCGTAGCTAGCTAGCTA', resolveConditions({ primer_conc: 500 }));
    expect(conc.tmC).toBeGreaterThan(dilute.tmC);
  });

  it('is lowered by DMSO (−0.75 °C per %)', () => {
    const plain = meltingTemperature('ATGCGTAGCTAGCTAGCTA', resolveConditions({ dmso_percent: 0 }));
    const dmso = meltingTemperature('ATGCGTAGCTAGCTAGCTA', resolveConditions({ dmso_percent: 4 }));
    expect(plain.tmC - dmso.tmC).toBeCloseTo(3.0, 9);
  });

  it('gives a sensible Tm for the spec example primer', () => {
    const { tmC } = meltingTemperature('ATGCGTAGCTAGCTAGCTA', cond);
    expect(tmC).toBeGreaterThan(40);
    expect(tmC).toBeLessThan(75);
  });

  it('hand-derived absolute Tm: 5′-ATGC-3′ at default conditions ≈ −52.82 °C', () => {
    // dH = −23.1, dS = −66.3 (see duplex hand-check above);
    // Ct = 200 nM → R·ln(Ct/4) = −33.40;
    // Tm(1 M) = −23100/−99.70 − 273.15 = −41.45 °C;
    // von Ahsen Na_eq = 206.46 mM → 16.6·log10(0.20646) = −11.37 °C.
    const { tmC } = meltingTemperature('ATGC', cond);
    expect(tmC).toBeCloseTo(-52.82, 1);
  });
});

describe('hairpinLoopParams (Turner)', () => {
  it('tabulates short loops', () => {
    const l3 = hairpinLoopParams(3);
    expect(l3.dH).toBeCloseTo(1.3, 9);
    // ΔS = (1.3 − 3.2)·1000/310.15
    expect(l3.dS).toBeCloseTo(-6.13, 2);
  });

  it('extrapolates beyond 9 nt (Jacobson–Stockmayer)', () => {
    const l12 = hairpinLoopParams(12);
    expect(l12.dH).toBe(5.0);
    const dG37 = l12.dH - (310.15 * l12.dS) / 1000;
    expect(dG37).toBeGreaterThan(4.8);
  });

  it('rejects loops shorter than 3 nt', () => {
    expect(() => hairpinLoopParams(2)).toThrow(RangeError);
  });
});
