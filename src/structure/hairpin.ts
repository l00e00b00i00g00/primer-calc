import type { HairpinResult } from '../types.js';
import type { DuplexFlanks } from '../thermo/nearest-neighbor.js';
import { hairpinLoopParams } from '../constants.js';
import { alignmentThermodynamics } from '../thermo/nearest-neighbor.js';
import { isWatsonCrickPair } from '../sequence/iupac.js';

/** Minimum paired stem length considered. */
export const MIN_STEM = 3;
/** Minimum unpaired loop length (steric constraint). */
export const MIN_LOOP = 3;

/**
 * Most stable stem–loop (hairpin) of an unambiguous sequence.
 *
 * Every (5′ arm, loop ≥ 3 nt, 3′ arm) combination with a perfectly paired
 * stem ≥ {@link MIN_STEM} bp is scored with SantaLucia stacks plus the
 * Turner loop penalty; the minimum-ΔG structure at `evalTempC` is returned.
 *
 * Terminal A·T corrections apply to both stem ends (conservative convention;
 * ≈ +0.06 kcal/mol per end at 37 °C).
 */
export function bestHairpin(seq: string, evalTempC: number): HairpinResult {
  const s = seq.toUpperCase();
  const n = s.length;
  const none: HairpinResult = {
    found: false,
    deltaG: null,
    stemLength: 0,
    loopLength: 0,
  };
  if (n < 2 * MIN_STEM + MIN_LOOP) return none;

  let best: HairpinResult = none;
  for (let loopStart = 1; loopStart < n; loopStart++) {
    for (let loopLen = MIN_LOOP; loopStart + loopLen < n; loopLen++) {
      // Longest WC-paired stem around this loop.
      let stem = 0;
      while (
        stem < loopStart &&
        loopStart + loopLen + stem < n &&
        isWatsonCrickPair(
          s[loopStart - 1 - stem] as string,
          s[loopStart + loopLen + stem] as string,
        )
      ) {
        stem++;
      }
      for (let k = MIN_STEM; k <= stem; k++) {
        const fiveArm = s.slice(loopStart - k, loopStart);
        const threeArm = s.slice(loopStart + loopLen, loopStart + loopLen + k);
        const bottom = [...threeArm].reverse().join('');
        // Open-end dangling bases (loop side stays blunt/constrained).
        const flanks: DuplexFlanks = {};
        if (loopStart - k - 1 >= 0) {
          flanks.top5 = s[loopStart - k - 1] as string;
        }
        if (loopStart + loopLen + k < n) {
          flanks.bottom3 = s[loopStart + loopLen + k] as string;
        }
        const { dH, dS } = alignmentThermodynamics(
          fiveArm,
          bottom,
          false,
          flanks,
        );
        const loop = hairpinLoopParams(loopLen);
        const dG =
          dH + loop.dH - ((evalTempC + 273.15) * (dS + loop.dS)) / 1000;
        if (best.deltaG === null || dG < best.deltaG) {
          best = { found: true, deltaG: dG, stemLength: k, loopLength: loopLen };
        }
      }
    }
  }
  return best;
}
