import { INITIATION, immParams, nnParams } from '../constants.js';
import { BULGE_DG37 } from '../thermo/nearest-neighbor.js';
import { isWatsonCrickPair } from '../sequence/iupac.js';
import { ZERO_C_KELVIN } from '../constants.js';
import { assertUnambiguous } from '../sequence/validate.js';

/** One DP-traced local alignment between two antiparallel strands. */
export interface DpAlignment {
  /** Top segment, 5′ → 3′ (`-` = bulged position on this strand). */
  top: string;
  /** Bottom segment, 3′ → 5′ (`-` = bulged position on this strand). */
  bottom: string;
  /** Top-strand start index (strand coordinates, gaps excluded). */
  aStart: number;
  /** Bottom-strand start index (strand coordinates, gaps excluded). */
  bStartRev: number;
  /** Core-motif ΔG at the evaluation temperature (stacks/IMM/bulges/init only;
   terminal corrections and dangling ends are finalized by the caller). */
  deltaG: number;
}

const START = 0;
const STACK = 1;
const MISMATCH = 2;
const BULGE_TOP = 3;
const BULGE_BOT = 4;

/**
 * Thermodynamic local alignment (Smith–Waterman over WC-pair states).
 *
 * Finds the minimum-ΔG local alignment between antiparallel `a` (5′ → 3′)
 * and `b` (3′ → 5′): Watson–Crick stacks, isolated single mismatches
 * (IMM pairs), and single-nucleotide bulges on either strand. Initiation is
 * paid once per alignment; terminal corrections and dangling ends are
 * finalized by the caller (see `alignmentThermodynamics`), which also
 * re-scores the traced alignment exactly.
 *
 * Runs in O(n·m) time and memory.
 */
export function tracebackBestAlignment(
  a: string,
  b: string,
  evalTempC: number,
): DpAlignment | null {
  const A = assertUnambiguous(a, 'tracebackBestAlignment');
  const B = assertUnambiguous(b, 'tracebackBestAlignment');
  const n = A.length;
  const m = B.length;
  if (n === 0 || m === 0) return null;
  const tK = evalTempC + ZERO_C_KELVIN;
  const dgInit = INITIATION.dH - (tK * INITIATION.dS) / 1000;
  const at = (i: number, j: number): number => i * m + j;
  const wc = (i: number, j: number): boolean => isWatsonCrickPair(A[i] as string, B[j] as string);
  const S = new Float64Array(n * m).fill(Infinity);
  const P = new Int8Array(n * m);
  let best = Infinity;
  let bi = -1;
  let bj = -1;

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < m; j++) {
      if (!wc(i, j)) continue;
      let v = dgInit;
      let p = START;
      // WC stack over the previous pair (total: consecutive WC pairs
      // always form a valid NN step).
      if (i > 0 && j > 0 && (S[at(i - 1, j - 1)] as number) < Infinity) {
        const s = nnParams(
          `${A[i - 1] as string}${A[i] as string}`,
          `${B[j - 1] as string}${B[j] as string}`,
        ) as { dH: number; dS: number };
        const step = s.dH - (tK * s.dS) / 1000;
        const cand = (S[at(i - 1, j - 1)] as number) + step;
        if (cand < v) {
          v = cand;
          p = STACK;
        }
      }
      // Isolated single mismatch bridged between two WC pairs.
      if (i >= 2 && j >= 2 && (S[at(i - 2, j - 2)] as number) < Infinity) {
        const left = immParams(
          `${A[i - 2] as string}${A[i - 1] as string}`,
          `${B[j - 2] as string}${B[j - 1] as string}`,
        );
        const right = immParams(
          `${A[i - 1] as string}${A[i] as string}`,
          `${B[j - 1] as string}${B[j] as string}`,
        );
        if (left && right) {
          const step = left.dH + right.dH - (tK * (left.dS + right.dS)) / 1000;
          const cand = (S[at(i - 2, j - 2)] as number) + step;
          if (cand < v) {
            v = cand;
            p = MISMATCH;
          }
        }
      }
      // Single-nucleotide bulges (flat penalty, T-independent).
      if (i >= 2 && j >= 1 && (S[at(i - 2, j - 1)] as number) < Infinity) {
        const cand = (S[at(i - 2, j - 1)] as number) + BULGE_DG37;
        if (cand < v) {
          v = cand;
          p = BULGE_TOP;
        }
      }
      if (i >= 1 && j >= 2 && (S[at(i - 1, j - 2)] as number) < Infinity) {
        const cand = (S[at(i - 1, j - 2)] as number) + BULGE_DG37;
        if (cand < v) {
          v = cand;
          p = BULGE_BOT;
        }
      }
      S[at(i, j)] = v;
      P[at(i, j)] = p;
      if (v < best) {
        best = v;
        bi = i;
        bj = j;
      }
    }
  }
  if (bi < 0) return null;

  let ci = bi;
  let cj = bj;
  const tops: string[] = [];
  const bots: string[] = [];
  for (;;) {
    tops.unshift(A[ci] as string);
    bots.unshift(B[cj] as string);
    const t = P[at(ci, cj)] as number;
    if (t === START) break;
    if (t === STACK) {
      ci -= 1;
      cj -= 1;
    } else if (t === MISMATCH) {
      tops.unshift(A[ci - 1] as string);
      bots.unshift(B[cj - 1] as string);
      ci -= 2;
      cj -= 2;
    } else if (t === BULGE_TOP) {
      tops.unshift(A[ci - 1] as string);
      bots.unshift('-');
      ci -= 2;
      cj -= 1;
    } else {
      tops.unshift('-');
      bots.unshift(B[cj - 1] as string);
      ci -= 1;
      cj -= 2;
    }
  }
  return {
    top: tops.join(''),
    bottom: bots.join(''),
    aStart: ci,
    bStartRev: cj,
    deltaG: best,
  };
}
