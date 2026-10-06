import type { DimerResult, ResolvedConditions } from '../types.js';
import type { DuplexFlanks } from '../thermo/nearest-neighbor.js';
import { gibbsFreeEnergy } from '../thermo/gibbs.js';
import { alignmentThermodynamics } from '../thermo/nearest-neighbor.js';
import { dimerMeltingTemp } from '../thermo/tm.js';
import { isWatsonCrickPair } from '../sequence/iupac.js';

/** Minimum 3′-terminal paired run (nt) considered polymerase-extendable. */
export const ANCHORED_RUN_MIN = 2;

interface ScoredBlock {
  top: string;
  bottom: string;
  aStart: number;
  bStartRev: number;
  length: number;
}

/**
 * Most stable ungapped dimer between `a` (5′ → 3′) and `b` (5′ → 3′).
 *
 * Strand `b` is scanned in antiparallel orientation over every offset; each
 * maximal Watson–Crick block — plus merges across a single internal mismatch
 * (one shared initiation) — is scored with SantaLucia thermodynamics,
 * including single-nucleotide dangling ends (Bommarito et al. 2000).
 *
 * @param selfComplementary set for homodimers (symmetry −1.4 e.u., R·ln Ct).
 */
export function bestDimer(
  a: string,
  b: string,
  cond: ResolvedConditions,
  selfComplementary: boolean,
): DimerResult {
  const A = a.toUpperCase();
  const brev = [...b.toUpperCase()].reverse().join(''); // b in 3' → 5'
  const none: DimerResult = {
    found: false,
    deltaG: null,
    tm: null,
    pairedBases: 0,
    threePrimeRun: 0,
    threePrimeAnchored: false,
  };
  if (A.length === 0 || brev.length === 0) return none;

  // paired[i][j]: A[i] pairs with brev[j].
  const pair: boolean[][] = Array.from({ length: A.length }, (_, i) =>
    Array.from({ length: brev.length }, (_, j) =>
      isWatsonCrickPair(A[i] as string, brev[j] as string),
    ),
  );

  let best: DimerResult = none;
  const consider = (top: string, bottom: string, aStart: number, bStartRev: number) => {
    const paired = countPaired(top, bottom);
    if (paired < 2) return;
    const len = top.length;
    const flanks: DuplexFlanks = {};
    if (aStart > 0) flanks.top5 = A[aStart - 1] as string;
    if (bStartRev > 0) flanks.bottom3 = brev[bStartRev - 1] as string;
    if (aStart + len < A.length) flanks.top3 = A[aStart + len] as string;
    if (bStartRev + len < brev.length) {
      flanks.bottom5 = brev[bStartRev + len] as string;
    }
    const { dH, dS } = alignmentThermodynamics(top, bottom, selfComplementary, flanks);
    const dG = gibbsFreeEnergy(dH, dS, cond.eval_temp_c);
    // 3′ runs on the gapped depiction: top is 5′→3′ (3′ end = right),
    // bottom is 3′→5′ (3′ end = left). Runs stop at mismatches/boundaries.
    // A strand whose block does not reach its 3′ terminus (overhang)
    // cannot be extended: its run is 0 by definition.
    const [depTop, depBottom] = depictMerged(top, bottom);
    const topReached = aStart + len === A.length;
    const bottomReached = bStartRev === 0;
    const run = Math.max(
      topReached ? trailingRun(depTop) : 0,
      bottomReached ? leadingRun(depBottom) : 0,
    );
    const anchored = run >= ANCHORED_RUN_MIN;
    // Traced duplex composition for the Owczarzy %GC/N (GC pairs over span).
    let gcPaired = 0;
    for (let p = 0; p < top.length; p++) {
      const t = (top[p] as string).toUpperCase();
      const u = (bottom[p] as string).toUpperCase();
      if (t !== '-' && u !== '-' && isWatsonCrickPair(t, u) && (t === 'G' || t === 'C')) {
        gcPaired++;
      }
    }
    if (best.deltaG === null || dG < best.deltaG) {
      best = {
        found: true,
        deltaG: dG,
        tm: dimerMeltingTemp(
          dH,
          dS,
          cond,
          selfComplementary,
          gcPaired / len,
          len,
        ),
        pairedBases: paired,
        threePrimeRun: run,
        threePrimeAnchored: anchored,
      };
    }
  };

  // Diagonals of the pairing matrix = ungapped offsets.
  for (let d = -(brev.length - 1); d <= A.length - 1; d++) {
    // Collect overlap positions (i, j) with i - j = d, j ascending.
    const cells: Array<[number, number]> = [];
    for (let i = 0; i < A.length; i++) {
      const j = i - d;
      if (j >= 0 && j < brev.length) cells.push([i, j]);
    }
    // Maximal paired blocks along this diagonal.
    const blocks: ScoredBlock[] = [];
    let k = 0;
    const isPaired = (cell: readonly [number, number]): boolean =>
      (pair[cell[0]] as boolean[])[cell[1]] === true;
    while (k < cells.length) {
      const first = cells[k] as [number, number];
      if (!isPaired(first)) {
        k++;
        continue;
      }
      let k2 = k;
      while (k2 + 1 < cells.length && isPaired(cells[k2 + 1] as [number, number])) {
        k2++;
      }
      const i1 = (cells[k] as [number, number])[0];
      const j1 = (cells[k] as [number, number])[1];
      const len = k2 - k + 1;
      blocks.push({
        top: A.slice(i1, i1 + len),
        bottom: brev.slice(j1, j1 + len),
        aStart: i1,
        bStartRev: j1,
        length: len,
      });
      k = k2 + 1;
    }
    for (const bl of blocks) {
      consider(bl.top, bl.bottom, bl.aStart, bl.bStartRev);
    }
    // Single-mismatch-bridged merges (one shared initiation).
    for (let bi = 0; bi + 1 < blocks.length; bi++) {
      const left = blocks[bi] as ScoredBlock;
      const right = blocks[bi + 1] as ScoredBlock;
      const gapA = right.aStart - (left.aStart + left.length);
      const gapB = right.bStartRev - (left.bStartRev + left.length);
      if (gapA === 1 && gapB === 1) {
        const top = left.top + A[left.aStart + left.length] + right.top;
        const bottom = left.bottom + brev[left.bStartRev + left.length] + right.bottom;
        consider(top, bottom, left.aStart, left.bStartRev);
      }
    }
  }
  return best;
}

/** Paired run counted backwards from the right end (top strand, 5′→3′). */
function trailingRun(depicted: string): number {
  let run = 0;
  for (let i = depicted.length - 1; i >= 0; i--) {
    if (depicted[i] === '-') break;
    run++;
  }
  return run;
}

/** Paired run counted forwards from the left end (bottom strand, 3′→5′). */
function leadingRun(depicted: string): number {
  let run = 0;
  for (let i = 0; i < depicted.length; i++) {
    if (depicted[i] === '-') break;
    run++;
  }
  return run;
}

/** Number of Watson–Crick pairs in a raw (possibly mismatch-bridged) alignment. */
function countPaired(top: string, bottom: string): number {
  let n = 0;
  for (let i = 0; i < top.length; i++) {
    const t = (top[i] as string).toUpperCase();
    const u = (bottom[i] as string).toUpperCase();
    if (t !== '-' && u !== '-' && isWatsonCrickPair(t, u)) n++;
  }
  return n;
}

/**
 * Builds the gapped depiction of a merged alignment so 3′ runs stop at the
 * internal mismatch. For gap-free blocks the raw strings are already correct.
 */
export function depictMerged(top: string, bottom: string): [string, string] {
  let t = '';
  let u = '';
  for (let i = 0; i < top.length; i++) {
    const a = (top[i] as string).toUpperCase();
    const b = (bottom[i] as string).toUpperCase();
    if (isWatsonCrickPair(a, b)) {
      t += a;
      u += b;
    } else {
      t += '-';
      u += '-';
    }
  }
  return [t, u];
}
