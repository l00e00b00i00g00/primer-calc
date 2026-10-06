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
