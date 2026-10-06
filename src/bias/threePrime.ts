import type { ThreePrimeResult } from '../types.js';
import { duplexThermodynamics } from '../thermo/nearest-neighbor.js';
import { gibbsFreeEnergy } from '../thermo/gibbs.js';

/** Width of the 3′-terminal stability window (nt). */
export const THREE_PRIME_WINDOW = 5;

/**
 * 3′-end specificity report.
 *
 * Scores the ΔG°37 of the perfect duplex formed by the 3′-terminal pentamer:
 * an over-stable 3′ end can prime non-specific extension (mispriming).
 * Also reports the GC clamp (last two 3′ bases: 0, 1 or 2 G/C).
 */
export function analyzeThreePrime(seq: string): ThreePrimeResult {
  const s = seq.toUpperCase();
  const window = s.slice(-THREE_PRIME_WINDOW);
  let deltaG37: number | null = null;
  try {
    const { dH, dS } = duplexThermodynamics(window, false);
    deltaG37 = gibbsFreeEnergy(dH, dS, 37);
  } catch {
    deltaG37 = null; // degenerate window: no single stability value
  }
  const tail = s.slice(-2);
  const gcTail = [...tail].filter((c) => c === 'G' || c === 'C').length;
  const gcClamp = gcTail === 0 ? 'none' : gcTail === 1 ? 'single' : 'double';
  const gcCount3p = [...window].filter((c) => c === 'G' || c === 'C').length;
  return { deltaG37, gcClamp, gcCount3p };
}
