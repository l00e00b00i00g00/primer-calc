import { IUPAC_GC_FRACTION } from './iupac.js';

/**
 * GC content in percent (0–100).
 * Ambiguous IUPAC codes contribute fractionally (e.g. R → 0.5, N → 0.5).
 */
export function gcContent(seq: string): number {
  const s = seq.toUpperCase();
  if (s.length === 0) return 0;
  let gc = 0;
  for (const c of s) {
    const f = IUPAC_GC_FRACTION[c];
    if (f === undefined) throw new Error(`Unknown IUPAC code: "${c}".`);
    gc += f;
  }
  return (gc / s.length) * 100;
}

/** AT content in percent (100 − GC). */
export function atContent(seq: string): number {
  return 100 - gcContent(seq);
}

/** Counts of unambiguous bases (ambiguous IUPAC codes are ignored). */
export function baseCounts(seq: string): Record<'A' | 'C' | 'G' | 'T', number> {
  const counts = { A: 0, C: 0, G: 0, T: 0 };
  for (const c of seq.toUpperCase()) {
    if (c === 'A' || c === 'C' || c === 'G' || c === 'T') {
      counts[c] += 1;
    }
  }
  return counts;
}
