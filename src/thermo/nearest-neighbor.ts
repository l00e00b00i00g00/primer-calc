import {
  INITIATION,
  SYMMETRY_DS,
  TERMINAL_AT,
  danglingParams,
  immParams,
  nnParams,
  tmmParams,
} from '../constants.js';
import { isWatsonCrickPair } from '../sequence/iupac.js';

/** Cumulative duplex thermodynamics. */
export interface DuplexThermo {
  /** ΣΔH° in kcal/mol (stacks + initiation + terminal AT + symmetry). */
  dH: number;
  /** ΣΔS° in cal/(mol·K). */
  dS: number;
  /** Number of terminal A·T pairs penalised. */
  terminalAT: number;
  /** Number of terminal mismatches scored (SantaLucia & Peyret 2001). */
  terminalMM: number;
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
  return { dH, dS, terminalAT, terminalMM: 0 };
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
 * Thermodynamics of an arbitrary ungapped alignment with single mismatches.
 *
 * Watson–Crick stacks use SantaLucia (1998); isolated single internal
 * mismatches use Allawi/SantaLucia/Peyret/Watkins NN steps (IMM, one entry
 * per flanking step — completeness is test-locked); terminal mismatches use
 * SantaLucia & Peyret (2001) units subsuming that end's terminal corrections.
 * Tandem mismatches and bulges break stacking (`-` = single-nt bulge with a
 * fixed penalty, see `BULGE_DG37`).
 *
 * @param top top-strand segment, 5′ → 3′.
 * @param bottom bottom-strand segment, 3′ → 5′ (aligned position by position).
 */
export const BULGE_DG37 = 3.0;

type Pair = { dH: number; dS: number };

export function alignmentThermodynamics(
  top: string,
  bottom: string,
  selfComplementary = false,
  flanks: DuplexFlanks = {},
): DuplexThermo {
  if (top.length !== bottom.length) {
    throw new Error('Aligned segments must have equal length.');
  }
  const up = (s: string, i: number): string => (s[i] as string).toUpperCase();
  let dH = INITIATION.dH;
  let dS = INITIATION.dS;
  const pairedIdx: number[] = [];
  for (let i = 0; i < top.length; i++) {
    const a = up(top, i);
    const b = up(bottom, i);
    if (a !== '-' && b !== '-' && isWatsonCrickPair(a, b)) pairedIdx.push(i);
  }
  if (pairedIdx.length === 0) {
    if (selfComplementary) dS += SYMMETRY_DS;
    const bulges =
      [...top].filter((c) => c === '-').length + [...bottom].filter((c) => c === '-').length;
    return { dH: dH + BULGE_DG37 * bulges, dS, terminalAT: 0, terminalMM: 0 };
  }
  // Non-empty: first/last paired positions always exist.
  const firstPaired = pairedIdx[0] as number;
  const lastPaired = pairedIdx[pairedIdx.length - 1] as number;
  // Terminal mismatches: a facing non-gap pair just outside the paired span
  // is necessarily mismatched (pairedIdx is complete), scoring as a
  // (mismatch, WC) unit subsuming that end.
  let leftTMM = false;
  let rightTMM = false;
  let terminalMM = 0;
  const lo = firstPaired - 1;
  if (lo >= 0) {
    const a = up(top, lo);
    const b = up(bottom, lo);
    if (a !== '-' && b !== '-') {
      // Total per the test-locked TMM completeness invariant.
      const p = tmmParams(
        `${up(top, lo)}${up(top, firstPaired)}`,
        `${up(bottom, lo)}${up(bottom, firstPaired)}`,
      ) as Pair;
      dH += p.dH;
      dS += p.dS;
      leftTMM = true;
      terminalMM++;
    }
  }
  const hi = lastPaired + 1;
  if (hi < top.length) {
    const a = up(top, hi);
    const b = up(bottom, hi);
    if (a !== '-' && b !== '-') {
      const p = tmmParams(
        `${up(top, lastPaired)}${up(top, hi)}`,
        `${up(bottom, lastPaired)}${up(bottom, hi)}`,
      ) as Pair;
      dH += p.dH;
      dS += p.dS;
      rightTMM = true;
      terminalMM++;
    }
  }
  // Terminal AT penalties apply to paired blunt ends (not TMM ends).
  let terminalAT = 0;
  const ends =
    firstPaired === lastPaired
      ? [{ pos: firstPaired, tmm: leftTMM || rightTMM }]
      : [
          { pos: firstPaired, tmm: leftTMM },
          { pos: lastPaired, tmm: rightTMM },
        ];
  for (const e of ends) {
    if (e.tmm) continue;
    const a = up(top, e.pos);
    if (a === 'A' || a === 'T') terminalAT++;
  }
  for (let k = 0; k < pairedIdx.length - 1; k++) {
    const i = pairedIdx[k] as number;
    const j = pairedIdx[k + 1] as number;
    if (j === i + 1) {
      // Total lookup: consecutive paired ACGT positions with vertical
      // Watson–Crick pairing always form a valid NN step (see above).
      const p = nnParams(
        `${top[i]}${top[j]}`.toUpperCase(),
        `${bottom[i]}${bottom[j]}`.toUpperCase(),
      ) as Pair;
      dH += p.dH;
      dS += p.dS;
      continue;
    }
    if (j === i + 2) {
      const m = i + 1;
      const tm = up(top, m);
      const bm = up(bottom, m);
      // A non-gap middle between consecutive paired positions is
      // necessarily mismatched (pairedIdx is complete).
      if (tm !== '-' && bm !== '-') {
        // Isolated single internal mismatch: left + right IMM steps.
        // Total per the test-locked IMM completeness invariant.
        const left = immParams(`${up(top, i)}${tm}`, `${up(bottom, i)}${bm}`) as Pair;
        const right = immParams(`${tm}${up(top, j)}`, `${bm}${up(bottom, j)}`) as Pair;
        dH += left.dH + right.dH;
        dS += left.dS + right.dS;
        continue;
      }
    }
    // Tandem mismatch or bulge: stacking broken.
  }
  dH += TERMINAL_AT.dH * terminalAT;
  dS += TERMINAL_AT.dS * terminalAT;
  // Single-nucleotide dangling ends (first-order: summed independently),
  // skipped at mismatch-terminated ends.
  const t5 = up(top, firstPaired);
  const u5 = up(bottom, firstPaired);
  const t3 = up(top, lastPaired);
  const u3 = up(bottom, lastPaired);
  const dangles: Array<{
    fivePrime: boolean;
    same: string;
    opp: string;
    base: string | undefined;
    skip: boolean;
  }> = [
    { fivePrime: true, same: t5, opp: u5, base: flanks.top5, skip: leftTMM },
    { fivePrime: false, same: u5, opp: t5, base: flanks.bottom3, skip: leftTMM },
    { fivePrime: false, same: t3, opp: u3, base: flanks.top3, skip: rightTMM },
    { fivePrime: true, same: u3, opp: t3, base: flanks.bottom5, skip: rightTMM },
  ];
  for (const d of dangles) {
    if (d.skip || d.base === undefined) continue;
    const p = danglingParams(d.fivePrime, d.same, d.opp, d.base);
    if (!p) continue;
    dH += p.dH;
    dS += p.dS;
  }
  if (selfComplementary) dS += SYMMETRY_DS;
  // Bulge penalty converted to (dH, dS) at 37 °C: pure-enthalpy penalty.
  const bulges =
    [...top].filter((c) => c === '-').length + [...bottom].filter((c) => c === '-').length;
  dH += BULGE_DG37 * bulges;
  return { dH, dS, terminalAT, terminalMM };
}
