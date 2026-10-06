/**
 * IUPAC nucleotide code handling: expansion, complements, degeneracy.
 *
 * Full IUPAC nomenclature is supported:
 * `A C G T` (unambiguous) plus `R Y S W K M B D H V N` (ambiguous).
 */

/** IUPAC code → concrete bases it represents. */
export const IUPAC_BASES: Record<string, readonly string[]> = {
  A: ['A'],
  C: ['C'],
  G: ['G'],
  T: ['T'],
  R: ['A', 'G'],
  Y: ['C', 'T'],
  S: ['G', 'C'],
  W: ['A', 'T'],
  K: ['G', 'T'],
  M: ['A', 'C'],
  B: ['C', 'G', 'T'],
  D: ['A', 'G', 'T'],
  H: ['A', 'C', 'T'],
  V: ['A', 'C', 'G'],
  N: ['A', 'C', 'G', 'T'],
};

/** IUPAC code → its Watson–Crick complement code. */
export const IUPAC_COMPLEMENT: Record<string, string> = {
  A: 'T',
  T: 'A',
  G: 'C',
  C: 'G',
  R: 'Y',
  Y: 'R',
  S: 'S',
  W: 'W',
  K: 'M',
  M: 'K',
  B: 'V',
  D: 'H',
  H: 'D',
  V: 'B',
  N: 'N',
};

/** Fractional GC contribution of each IUPAC code (0–1). */
export const IUPAC_GC_FRACTION: Record<string, number> = {
  A: 0,
  T: 0,
  G: 1,
  C: 1,
  R: 0.5,
  Y: 0.5,
  S: 1,
  W: 0,
  K: 0.5,
  M: 0.5,
  B: 2 / 3,
  D: 1 / 3,
  H: 1 / 3,
  V: 2 / 3,
  N: 0.5,
};

/** True when `ch` is a recognised IUPAC nucleotide code. */
export function isIupacBase(ch: string): boolean {
  return ch.length === 1 && ch.toUpperCase() in IUPAC_BASES;
}

/** Concrete bases represented by an IUPAC code (upper-case). */
export function expandIupac(code: string): string[] {
  const bases = IUPAC_BASES[code.toUpperCase()];
  if (!bases) throw new Error(`Unknown IUPAC code: "${code}".`);
  return [...bases];
}

/**
 * Reverse complement of a (possibly degenerate) sequence.
 * Ambiguous codes map to their ambiguous complements (R↔Y, K↔M, …).
 */
export function reverseComplement(seq: string): string {
  return seq
    .toUpperCase()
    .split('')
    .reverse()
    .map((c) => {
      const comp = IUPAC_COMPLEMENT[c];
      if (comp === undefined) throw new Error(`Unknown IUPAC code: "${c}".`);
      return comp;
    })
    .join('');
}

/** Total degeneracy factor D = ∏ nᵢ over every sequence position. */
export function degeneracyFactor(seq: string): number {
  let d = 1;
  for (const c of seq.toUpperCase()) {
    const bases = IUPAC_BASES[c];
    if (!bases) throw new Error(`Unknown IUPAC code: "${c}".`);
    d *= bases.length;
  }
  return d;
}

/** True when two IUPAC codes share at least one Watson–Crick pair. */
export function canPair(a: string, b: string): boolean {
  const ea = IUPAC_BASES[a.toUpperCase()] ?? [];
  const eb = new Set(IUPAC_BASES[b.toUpperCase()] ?? []);
  return ea.some((x) => {
    const c = IUPAC_COMPLEMENT[x];
    return c !== undefined && eb.has(c);
  });
}

/** True for strict A·T / T·A / G·C / C·G pairs (unambiguous codes only). */
export function isWatsonCrickPair(a: string, b: string): boolean {
  const x = a.toUpperCase();
  const y = b.toUpperCase();
  return (
    (x === 'A' && y === 'T') ||
    (x === 'T' && y === 'A') ||
    (x === 'G' && y === 'C') ||
    (x === 'C' && y === 'G')
  );
}
