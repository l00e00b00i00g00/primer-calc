import { INITIATION, SYMMETRY_DS, TERMINAL_AT, danglingParams, nnParams } from '../constants.js';
import { isWatsonCrickPair } from '../sequence/iupac.js';

/** Cumulative duplex thermodynamics. */
export interface DuplexThermo {
  /** ΣΔH° in kcal/mol (stacks + initiation + terminal AT + symmetry). */
  dH: number;
  /** ΣΔS° in cal/(mol·K). */
  dS: number;
  /** Number of terminal A·T pairs penalised. */
  terminalAT: number;
}

/**
 * Cumulative nearest-neighbor thermodynamics of the perfect-match duplex
 * formed by `seq` (5′ → 3′) and its Watson–Crick complement.
 *
 * Implements SantaLucia (1998) unified parameters: NN stacks, duplex
 * initiation (+0.2 / −5.7), one terminal A·T penalty per A·T-terminated end,
 * and the symmetry correction (−1.4 e.u.) for self-complementary duplexes.
 *
 * @param selfComplementary apply the symmetry correction (homoduplexes).
 */
export function duplexThermodynamics(seq: string, selfComplementary = false): DuplexThermo {
  const s = seq.toUpperCase();
  let dH = INITIATION.dH;
  let dS = INITIATION.dS;
  const comp: Record<string, string> = { A: 'T', T: 'A', G: 'C', C: 'G' };
  for (let i = 0; i < s.length - 1; i++) {
    const a = s[i] as string;
    const b = s[i + 1] as string;
    // Bottom strand (3' → 5') dinucleotide complementing top 5'-a-b-3'.
    const ca = comp[a];
    const cb = comp[b];
    if (ca === undefined || cb === undefined) {
      throw new Error(`duplexThermodynamics requires an unambiguous sequence (got "${a}${b}").`);
    }
    // Bottom 3'→5' = comp(a) followed by comp(b).
    // Total lookup: ca/cb are the Watson–Crick complements of a/b, so every
    // step is one of the 10 unified stacks modulo 180° strand symmetry.
    const p = nnParams(`${a}${b}`, `${ca}${cb}`) as {
      dH: number;
      dS: number;
    };
    dH += p.dH;
    dS += p.dS;
  }
  let terminalAT = 0;
  const first = s[0] as string;
  const last = s[s.length - 1] as string;
  if (first === 'A' || first === 'T') terminalAT++;
  if (last === 'A' || last === 'T') terminalAT++;
  dH += TERMINAL_AT.dH * terminalAT;
  dS += TERMINAL_AT.dS * terminalAT;
  if (selfComplementary) dS += SYMMETRY_DS;
  return { dH, dS, terminalAT };
}

/**
 * Flanking unpaired bases adjacent to a duplex alignment, at most one per
 * strand per end. Each is treated as a single-nucleotide dangling end
 * (Bommarito, Peyret & SantaLucia 2000). Omit an end to model a blunt end
 * (e.g. the loop side of a hairpin stem).
 */
export interface DuplexFlanks {
  /** Base on the 5′ side of `top[0]` (top is 5′ → 3′). */
  top5?: string;
  /** Base on the 3′ side of `top[top.length − 1]`. */
  top3?: string;
  /** Base on the 3′ side of `bottom[0]` (bottom is 3′ → 5′). */
  bottom3?: string;
  /** Base on the 5′ side of `bottom[bottom.length − 1]`. */
  bottom5?: string;
}

/**
 * Thermodynamics of an arbitrary ungapped WC-paired alignment.
 *
 * @param top top-strand segment, 5′ → 3′.
 * @param bottom bottom-strand segment, 3′ → 5′ (aligned position by position).
 * Positions holding `-` denote single-nucleotide bulges: stacking across a
 * bulge is broken and a fixed penalty applies (see `BULGE_DG37`).
 */
export const BULGE_DG37 = 3.0;

export function alignmentThermodynamics(
  top: string,
  bottom: string,
  selfComplementary = false,
  flanks: DuplexFlanks = {},
): DuplexThermo {
  if (top.length !== bottom.length) {
    throw new Error('Aligned segments must have equal length.');
  }
  let dH = INITIATION.dH;
  let dS = INITIATION.dS;
  // Terminal AT penalties apply to the duplex ends (first/last paired bases).
  const pairedIdx: number[] = [];
  for (let i = 0; i < top.length; i++) {
    const a = (top[i] as string).toUpperCase();
    const b = (bottom[i] as string).toUpperCase();
    if (a !== '-' && b !== '-' && isWatsonCrickPair(a, b)) pairedIdx.push(i);
  }
  let terminalAT = 0;
  const firstPaired = pairedIdx[0];
  const lastPaired = pairedIdx[pairedIdx.length - 1];
  if (firstPaired !== undefined && lastPaired !== undefined) {
    for (const e of [firstPaired, lastPaired]) {
      const a = (top[e] as string).toUpperCase();
      if (a === 'A' || a === 'T') terminalAT++;
    }
  }
  for (let k = 0; k < pairedIdx.length - 1; k++) {
    const i = pairedIdx[k] as number;
    const j = pairedIdx[k + 1] as number;
    if (j !== i + 1) continue; // mismatch or bulge breaks stacking
    // Total lookup: consecutive paired ACGT positions with vertical
    // Watson–Crick pairing always form a valid NN step (see above).
    const p = nnParams(
      `${top[i]}${top[j]}`.toUpperCase(),
      `${bottom[i]}${bottom[j]}`.toUpperCase(),
    ) as { dH: number; dS: number };
    dH += p.dH;
    dS += p.dS;
  }
  dH += TERMINAL_AT.dH * terminalAT;
  dS += TERMINAL_AT.dS * terminalAT;
  // Single-nucleotide dangling ends (first-order: summed independently).
  if (firstPaired !== undefined && lastPaired !== undefined) {
    const t5 = top[firstPaired] as string;
    const u5 = bottom[firstPaired] as string;
    const t3 = top[lastPaired] as string;
    const u3 = bottom[lastPaired] as string;
    const dangles: Array<{
      fivePrime: boolean;
      same: string;
      opp: string;
      base: string | undefined;
    }> = [
      { fivePrime: true, same: t5, opp: u5, base: flanks.top5 },
      { fivePrime: false, same: u5, opp: t5, base: flanks.bottom3 },
      { fivePrime: false, same: t3, opp: u3, base: flanks.top3 },
      { fivePrime: true, same: u3, opp: t3, base: flanks.bottom5 },
    ];
    for (const d of dangles) {
      if (d.base === undefined) continue;
      const p = danglingParams(d.fivePrime, d.same, d.opp, d.base);
      if (!p) continue;
      dH += p.dH;
      dS += p.dS;
    }
  }
  if (selfComplementary) dS += SYMMETRY_DS;
  // Bulge penalty converted to (dH, dS) at 37 °C: pure-enthalpy penalty.
  const bulges =
    [...top].filter((c) => c === '-').length + [...bottom].filter((c) => c === '-').length;
  dH += BULGE_DG37 * bulges;
  return { dH, dS, terminalAT };
}
