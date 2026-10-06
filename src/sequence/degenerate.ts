import type { DegeneracyInfo, ResolvedConditions } from '../types.js';
import { IUPAC_BASES, degeneracyFactor } from './iupac.js';
import { meltingTemperature, toUnit } from '../thermo/tm.js';

/** Maximum number of concrete variants enumerated before deterministic sampling. */
export const MAX_VARIANTS_ENUMERATED = 4096;

/** Exact odometer enumeration (no index arithmetic: safe for any D ≤ cap). */
function* odometer(pools: readonly (readonly string[])[]): Generator<string> {
  const idx = new Array<number>(pools.length).fill(0);
  for (;;) {
    yield pools.map((p, i) => p[idx[i] as number] as string).join('');
    let k = pools.length - 1;
    while (k >= 0) {
      idx[k] = (idx[k] as number) + 1;
      if ((idx[k] as number) < (pools[k] as readonly string[]).length) break;
      idx[k] = 0;
      k--;
    }
    if (k < 0) return;
  }
}

/** Deterministic PRNG (mulberry32) for reproducible variant sampling. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Lazily yields concrete variants of a (possibly degenerate) sequence.
 *
 * Exact enumeration up to {@link MAX_VARIANTS_ENUMERATED} variants, then a
 * deterministic pseudo-random sample — never materialises the D-sized index
 * space, so astronomical degeneracies (e.g. `N×100`) cannot overflow.
 */
export function* enumerateVariants(seq: string): Generator<string> {
  const s = seq.toUpperCase();
  const pools = [...s].map((c) => {
    const b = IUPAC_BASES[c];
    if (!b) throw new Error(`Unknown IUPAC code: "${c}".`);
    return b;
  });
  const total = pools.reduce((acc, p) => acc * p.length, 1);
  if (total <= MAX_VARIANTS_ENUMERATED) {
    yield* odometer(pools);
    return;
  }
  const rand = mulberry32(0x1a2b3c4d);
  const seen = new Set<string>();
  while (seen.size < MAX_VARIANTS_ENUMERATED) {
    const v = pools.map((p) => p[Math.floor(rand() * p.length)] as string).join('');
    if (!seen.has(v)) {
      seen.add(v);
      yield v;
    }
  }
}

/**
 * Degeneracy analysis with O'Donnell–Maloney Tm approximation.
 *
 * Every concrete variant is assumed equimolar at synthesis, so the reported
 * primer Tm is the abundance-weighted mean over enumerated variants
 * (exhaustive when D ≤ 4096, else a deterministic sample); min/max bound the
 * observed stability range.
 */
export function analyzeDegeneracy(seq: string, cond: ResolvedConditions): DegeneracyInfo {
  const factor = degeneracyFactor(seq);
  const isDegenerate = factor > 1;
  if (!isDegenerate) {
    return {
      factor: 1,
      isDegenerate: false,
      tmMin: null,
      tmMax: null,
      tmWeighted: null,
      variantsEnumerated: 1,
    };
  }
  let min = Infinity;
  let max = -Infinity;
  let sum = 0;
  let count = 0;
  for (const variant of enumerateVariants(seq)) {
    const { tmC } = meltingTemperature(variant, cond);
    const tm = toUnit(tmC, cond.temp_unit);
    if (tm < min) min = tm;
    if (tm > max) max = tm;
    sum += tm;
    count++;
  }
  return {
    factor,
    isDegenerate: true,
    tmMin: min,
    tmMax: max,
    tmWeighted: sum / count,
    variantsEnumerated: count,
  };
}

/** Canonical (first-base) concrete representative of a degenerate sequence. */
export function canonicalVariant(seq: string): string {
  return [...seq.toUpperCase()]
    .map((c) => {
      const b = IUPAC_BASES[c];
      if (!b) throw new Error(`Unknown IUPAC code: "${c}".`);
      return b[0] as string;
    })
    .join('');
}
