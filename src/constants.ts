/**
 * Physical constants and SantaLucia (1998) unified nearest-neighbor parameters.
 *
 * Sources:
 * - SantaLucia, J. (1998). "A unified view of polymer, dumbbell, and
 *   oligonucleotide DNA nearest-neighbor thermodynamics."
 *   Proc. Natl. Acad. Sci. USA 95:1460–1465.
 * - SantaLucia, J. & Hicks, D. (2004). "The thermodynamics of DNA structural
 *   motifs." Annu. Rev. Biophys. Biomol. Struct. 33:415–440.
 * - Turner hairpin-loop parameters as tabulated for the SantaLucia model
 *   (loop ΔG°37 / ΔH°, extrapolation 1.75·RT·ln(L/9) beyond L = 9).
 * - von Ahsen, N. et al. (2001). "Oligonucleotide melting temperatures under
 *   PCR conditions." Clin. Chem. 47:1956–1961 (salt correction).
 */

/** Ideal gas constant R in cal/(mol·K). */
export const R_CAL = 1.987;
/** Ideal gas constant R in kcal/(mol·K). */
export const R_KCAL = 0.001987;
/** 0 °C in Kelvin. */
export const ZERO_C_KELVIN = 273.15;
/** Reference temperature 37 °C in Kelvin. */
export const T37_KELVIN = 310.15;

/** ΔH° in kcal/mol, keyed by `top(5'XY) + '/' + bottom(3'WZ)` dinucleotide. */
export const NN_DH: Record<string, number> = {
  'AA/TT': -7.6,
  'AT/TA': -7.2,
  'TA/AT': -7.2,
  'CA/GT': -8.5,
  'GT/CA': -8.4,
  'CT/GA': -7.8,
  'GA/CT': -8.2,
  'CG/GC': -10.6,
  'GC/CG': -9.8,
  'GG/CC': -8.0,
};

/** ΔS° in cal/(mol·K), same keys as {@link NN_DH}. */
export const NN_DS: Record<string, number> = {
  'AA/TT': -21.3,
  'AT/TA': -20.4,
  'TA/AT': -21.3,
  'CA/GT': -22.7,
  'GT/CA': -22.4,
  'CT/GA': -21.0,
  'GA/CT': -22.2,
  'CG/GC': -27.2,
  'GC/CG': -24.4,
  'GG/CC': -19.9,
};

/** Duplex initiation parameters. */
export const INITIATION = { dH: 0.2, dS: -5.7 } as const;
/** Penalty applied once per terminal A·T pair. */
export const TERMINAL_AT = { dH: 2.2, dS: 6.9 } as const;
/** Entropy symmetry correction for self-complementary duplexes. */
export const SYMMETRY_DS = -1.4;

/**
 * Returns the SantaLucia unified NN parameters for one dinucleotide step.
 *
 * @param top5 two top-strand bases, 5' → 3' (e.g. `"CA"`).
 * @param bottom3 two bottom-strand bases, 3' → 5' (e.g. `"GT"`).
 * @returns `{ dH, dS }` or `null` when the step is not a Watson–Crick step.
 */
export function nnParams(top5: string, bottom3: string): { dH: number; dS: number } | null {
  const t = top5.toUpperCase();
  const b = bottom3.toUpperCase();
  const direct = NN_DH[`${t}/${b}`];
  if (direct !== undefined) {
    return { dH: direct, dS: NN_DS[`${t}/${b}`] as number };
  }
  // Strand symmetry (180° rotation): XY/WZ ≡ reverse(WZ)/reverse(XY).
  // E.g. TG/AC ≡ CA/GT, TT/AA ≡ AA/TT.
  const rev = (s: string) => s.split('').reverse().join('');
  const t2 = rev(b);
  const b2 = rev(t);
  const swapped = NN_DH[`${t2}/${b2}`];
  if (swapped !== undefined) {
    return { dH: swapped, dS: NN_DS[`${t2}/${b2}`] as number };
  }
  return null;
}

/** Turner hairpin-loop parameters: loop length → { ΔG°37, ΔH° } (kcal/mol). */
const HAIRPIN_LOOPS: Record<number, { dG37: number; dH: number }> = {
  3: { dG37: 3.2, dH: 1.3 },
  4: { dG37: 3.6, dH: 4.8 },
  5: { dG37: 4.0, dH: 3.6 },
  6: { dG37: 4.4, dH: -2.9 },
  7: { dG37: 4.6, dH: 1.3 },
  8: { dG37: 4.7, dH: -2.9 },
  9: { dG37: 4.8, dH: 5.0 },
};

/**
 * Hairpin-loop free-energy parameters for a loop of `n` unpaired nucleotides.
 *
 * For n > 9 the Jacobson–Stockmayer extrapolation
 * ΔG°37(L) = ΔG°37(9) + 1.75·RT·ln(L/9) is used with the L = 9 enthalpy.
 */
export function hairpinLoopParams(n: number): { dH: number; dS: number } {
  if (n < 3) throw new RangeError('Hairpin loops must contain at least 3 nt.');
  let dG37: number;
  let dH: number;
  if (n <= 9) {
    const p = HAIRPIN_LOOPS[n] as { dG37: number; dH: number };
    dG37 = p.dG37;
    dH = p.dH;
  } else {
    dG37 = 4.8 + 1.75 * R_KCAL * T37_KELVIN * Math.log(n / 9);
    dH = 5.0;
  }
  const dS = ((dH - dG37) * 1000) / T37_KELVIN;
  return { dH, dS };
}

/** ΔG (kcal/mol) below which a secondary structure is a critical PCR risk. */
export const CRITICAL_DG = -9.0;
/** ΔG (kcal/mol) below which a secondary structure raises a warning. */
export const WARNING_DG = -6.0;
/** 3′-pentamer ΔG°37 (kcal/mol) below which mispriming risk is flagged. */
export const THREE_PRIME_DG_WARN = -5.0;
/** 3′-pentamer ΔG°37 (kcal/mol) at or below which risk is critical. */
export const THREE_PRIME_DG_CRITICAL = -6.0;
/** Degeneracy factor above which a warning is raised. */
export const DEGENERACY_WARN = 128;

/** Default assay conditions (spec §4 example). */
export const DEFAULT_CONDITIONS = {
  na_conc: 50,
  mg_conc: 2.5,
  dNTPs_conc: 0.8,
  primer_conc: 200,
  dmso_percent: 0,
  salt_method: 'vonAhsen',
  temp_unit: 'C',
  eval_temp_c: 37,
} as const;

/**
 * Internal single-mismatch NN parameters (dH kcal/mol, dS cal/(mol·K)),
 * Allawi & SantaLucia (1997, 1998), Peyret et al. (1999),
 * Watkins & SantaLucia (2005), via Biopython DNA_IMM1 (inosine rows omitted).
 * Keys use the NN orientation (top 5′→3′ / bottom 3′→5′); each entry covers
 * one NN step containing exactly one mismatch. The set is COMPLETE for
 * isolated single mismatches (verified: every such step resolves directly
 * or via 180° strand symmetry) — see tests/thermo.test.ts.
 */
export const IMM_TABLE: Record<string, readonly [number, number]> = {
  'AA/TA': [1.2, 1.7],
  'AA/TC': [2.3, 4.6],
  'AA/TG': [-0.6, -2.3],
  'AC/TA': [5.3, 14.6],
  'AC/TC': [0.0, -4.4],
  'AC/TT': [0.7, 0.2],
  'AG/TA': [-0.7, -2.3],
  'AG/TG': [-3.1, -9.5],
  'AG/TT': [1.0, 0.9],
  'AT/TC': [-1.2, -6.2],
  'AT/TG': [-2.5, -8.3],
  'AT/TT': [-2.7, -10.8],
  'CA/GA': [-0.9, -4.2],
  'CA/GC': [1.9, 3.7],
  'CA/GG': [-0.7, -2.3],
  'CC/GA': [0.6, -0.6],
  'CC/GC': [-1.5, -7.2],
  'CC/GT': [-0.8, -4.5],
  'CG/GA': [-4.0, -13.2],
  'CG/GG': [-4.9, -15.3],
  'CG/GT': [-4.1, -11.7],
  'CT/GC': [-1.5, -6.1],
  'CT/GG': [-2.8, -8.0],
  'CT/GT': [-5.0, -15.8],
  'GA/CA': [-2.9, -9.8],
  'GA/CC': [5.2, 14.2],
  'GA/CG': [-0.6, -1.0],
  'GC/CA': [-0.7, -3.8],
  'GC/CC': [3.6, 8.9],
  'GC/CT': [2.3, 5.4],
  'GG/CA': [0.5, 3.2],
  'GG/CG': [-6.0, -15.8],
  'GG/CT': [3.3, 10.4],
  'GG/TT': [5.8, 16.3],
  'GT/CC': [5.2, 13.5],
  'GT/CG': [-4.4, -12.3],
  'GT/CT': [-2.2, -8.4],
  'GT/TG': [4.1, 9.5],
  'TA/AA': [4.7, 12.9],
  'TA/AC': [3.4, 8.0],
  'TA/AG': [0.7, 0.7],
  'TC/AA': [7.6, 20.2],
  'TC/AC': [6.1, 16.4],
  'TC/AT': [1.2, 0.7],
  'TG/AA': [3.0, 7.4],
  'TG/AG': [1.6, 3.6],
  'TG/AT': [-0.1, -1.7],
  'TG/GT': [-1.4, -6.2],
  'TT/AC': [1.0, 0.7],
  'TT/AG': [-1.3, -5.3],
  'TT/AT': [0.2, -1.5],
};

/**
 * Terminal-mismatch NN parameters (dH, dS), SantaLucia & Peyret (2001),
 * via Biopython DNA_TMM1. Each entry covers a terminal mismatch plus its
 * adjacent Watson–Crick pair as a unit, subsuming that end's terminal
 * corrections. COMPLETE for all (terminal-mismatch × inner-WC)
 * configurations, directly or via symmetry — see tests/thermo.test.ts.
 */
export const TMM_TABLE: Record<string, readonly [number, number]> = {
  'AA/TA': [-3.1, -7.8],
  'AA/TC': [-1.6, -4.0],
  'AA/TG': [-1.9, -4.4],
  'AC/TA': [-1.8, -3.8],
  'AC/TC': [-0.1, 0.5],
  'AC/TT': [-0.9, -1.7],
  'AG/TA': [-2.5, -5.9],
  'AG/TG': [-1.1, -2.1],
  'AG/TT': [-3.2, -8.7],
  'AT/TC': [-2.3, -6.3],
  'AT/TG': [-3.5, -9.4],
  'AT/TT': [-2.4, -6.5],
  'CA/GA': [-4.3, -10.7],
  'CA/GC': [-2.6, -5.9],
  'CA/GG': [-3.9, -9.6],
  'CC/GA': [-2.7, -6.0],
  'CC/GC': [-2.1, -5.1],
  'CC/GT': [-3.2, -8.0],
  'CG/GA': [-6.0, -15.5],
  'CG/GG': [-3.8, -9.5],
  'CG/GT': [-3.8, -9.0],
  'CT/GC': [-3.9, -10.6],
  'CT/GG': [-6.6, -18.7],
  'CT/GT': [-6.1, -16.9],
  'GA/CA': [-8.0, -22.5],
  'GA/CC': [-5.0, -13.8],
  'GA/CG': [-4.3, -11.1],
  'GC/CA': [-3.2, -7.1],
  'GC/CC': [-3.9, -10.6],
  'GC/CT': [-4.9, -13.5],
  'GG/CA': [-4.6, -11.4],
  'GG/CG': [-0.7, -19.2],
  'GG/CT': [-5.7, -15.9],
  'GT/CC': [-3.0, -7.8],
  'GT/CG': [-5.9, -16.1],
  'GT/CT': [-7.4, -21.2],
  'TA/AA': [-2.5, -6.3],
  'TA/AC': [-2.3, -5.9],
  'TA/AG': [-2.0, -4.7],
  'TC/AA': [-2.7, -7.0],
  'TC/AC': [-0.7, -1.3],
  'TC/AT': [-2.5, -6.3],
  'TG/AA': [-2.4, -5.8],
  'TG/AG': [-1.1, -2.7],
  'TG/AT': [-3.9, -10.5],
  'TT/AC': [-0.7, -1.2],
  'TT/AG': [-3.6, -9.8],
  'TT/AT': [-3.2, -8.9],
};

/** Internal-mismatch NN lookup (direct + 180° symmetry), else null. */
export function immParams(top5: string, bottom3: string): { dH: number; dS: number } | null {
  const t = top5.toUpperCase();
  const b = bottom3.toUpperCase();
  const direct = IMM_TABLE[`${t}/${b}`];
  if (direct !== undefined) {
    return { dH: direct[0], dS: direct[1] };
  }
  const rev = (s: string) => s.split('').reverse().join('');
  const swapped = IMM_TABLE[`${rev(b)}/${rev(t)}`];
  if (swapped !== undefined) {
    return { dH: swapped[0], dS: swapped[1] };
  }
  return null;
}

/** Terminal-mismatch NN lookup (direct + 180° symmetry), else null. */
export function tmmParams(top5: string, bottom3: string): { dH: number; dS: number } | null {
  const t = top5.toUpperCase();
  const b = bottom3.toUpperCase();
  const direct = TMM_TABLE[`${t}/${b}`];
  if (direct !== undefined) {
    return { dH: direct[0], dS: direct[1] };
  }
  const rev = (s: string) => s.split('').reverse().join('');
  const swapped = TMM_TABLE[`${rev(b)}/${rev(t)}`];
  if (swapped !== undefined) {
    return { dH: swapped[0], dS: swapped[1] };
  }
  return null;
}

/**
 * Owczarzy et al. (2008) divalent-salt empirical constants, via Biopython's
 * verified implementation (Biochemistry 47:5336–5353). `KA` is the Mg:dNTP
 * dissociation constant (M⁻¹) for the free-Mg²⁺ equilibrium.
 */
export const OWCZARZY_2008 = {
  a: 3.92,
  b: -0.911,
  c: 6.26,
  d: 1.42,
  e: -48.2,
  f: 52.5,
  g: 8.31,
  KA: 3e4,
} as const;

type DangleEntry = [dH: number, dG37: number];
type DangleTable = Record<string, Record<string, DangleEntry>>;

/**
 * 5′-dangling-end increments (Bommarito, Peyret & SantaLucia 2000, via
 * SantaLucia & Hicks 2004 Table 3). Row = closing pair with the paired base
 * on the dangling strand first (`P/Q`); column = dangling base.
 */
const DANGLE_5: DangleTable = {
  'A/T': { A: [0.2, -0.51], C: [0.6, -0.42], G: [-1.1, -0.62], T: [-6.9, -0.71] },
  'C/G': { A: [-6.3, -0.96], C: [-4.4, -0.52], G: [-5.1, -0.72], T: [-4.0, -0.58] },
  'G/C': { A: [-3.7, -0.58], C: [-4.0, -0.34], G: [-3.9, -0.56], T: [-4.9, -0.61] },
  'T/A': { A: [-2.9, -0.5], C: [-4.1, -0.02], G: [-4.2, 0.48], T: [-0.2, -0.1] },
};

/** 3′-dangling-end increments, same layout as {@link DANGLE_5}. */
const DANGLE_3: DangleTable = {
  'A/T': { A: [-0.5, -0.12], C: [4.7, 0.28], G: [-4.1, -0.01], T: [-3.8, 0.13] },
  'C/G': { A: [-5.9, -0.82], C: [-2.6, -0.31], G: [-3.2, -0.01], T: [-5.2, -0.52] },
  'G/C': { A: [-2.1, -0.92], C: [-0.2, -0.23], G: [-3.9, -0.44], T: [-4.4, -0.35] },
  'T/A': { A: [-0.7, -0.48], C: [4.4, -0.19], G: [-1.6, -0.5], T: [2.9, -0.29] },
};

/**
 * Single-nucleotide dangling-end parameters.
 *
 * @param fivePrime true for a 5′ overhang, false for 3′.
 * @param pairedSame closing-pair base on the dangling strand.
 * @param pairedOpp closing-pair base on the opposite strand.
 * @param dangle the unpaired overhanging base.
 * @returns `{ dH, dS }` or `null` for non-canonical input.
 */
export function danglingParams(
  fivePrime: boolean,
  pairedSame: string,
  pairedOpp: string,
  dangle: string,
): { dH: number; dS: number } | null {
  const table = fivePrime ? DANGLE_5 : DANGLE_3;
  const row = table[`${pairedSame.toUpperCase()}/${pairedOpp.toUpperCase()}`];
  const entry = row?.[dangle.toUpperCase()];
  if (!entry) return null;
  const [dH, dG37] = entry;
  return { dH, dS: ((dH - dG37) * 1000) / T37_KELVIN };
}
