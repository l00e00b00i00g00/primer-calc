import type { DimerResult, HairpinResult, ResolvedConditions, ThreePrimeResult } from '../types.js';
import { bestHairpin } from '../structure/hairpin.js';
import { bestDimer } from '../structure/dimer.js';
import { analyzeThreePrime } from '../bias/threePrime.js';
import { canonicalVariant } from '../sequence/degenerate.js';
import { meltingTemperature } from '../thermo/tm.js';

/**
 * Compute-backend abstraction (spec §1 hybrid architecture).
 *
 * - `TypeScriptBackend` (default): pure-TS engine, zero native dependency,
 *   runs on Node.js ≥ 18, Bun and browsers.
 * - `WasmBackend` (optional, see `wasm/`): the same kernels compiled from
 *   Rust to WebAssembly for N×N multiplex matrices and batch scans, with
 *   Web-Worker / worker-thread parallelism. Loaded lazily; falls back to
 *   the TypeScript engine when the WASM module is unavailable.
 */
export interface ComputeBackend {
  readonly name: 'typescript' | 'wasm';
  /**
   * All methods accept normalized (possibly degenerate IUPAC) sequences
   * and canonicalize internally; callers never need to pre-process.
   */
  hairpin(seq: string, cond: ResolvedConditions): HairpinResult;
  homodimer(seq: string, cond: ResolvedConditions): DimerResult;
  heterodimer(a: string, b: string, cond: ResolvedConditions): DimerResult;
  threePrime(seq: string): ThreePrimeResult;
  tm(
    seq: string,
    cond: ResolvedConditions,
  ): {
    tmC: number;
    dH: number;
    dS: number;
    naEq_mM: number;
  };
}

/** Default pure-TypeScript compute backend. */
export class TypeScriptBackend implements ComputeBackend {
  readonly name = 'typescript' as const;

  hairpin(seq: string, cond: ResolvedConditions): HairpinResult {
    return bestHairpin(canonicalVariant(seq), cond.eval_temp_c);
  }

  homodimer(seq: string, cond: ResolvedConditions): DimerResult {
    const canon = canonicalVariant(seq);
    return bestDimer(canon, canon, cond, true);
  }

  heterodimer(a: string, b: string, cond: ResolvedConditions): DimerResult {
    return bestDimer(canonicalVariant(a), canonicalVariant(b), cond, false);
  }

  threePrime(seq: string): ThreePrimeResult {
    return analyzeThreePrime(seq);
  }

  tm(seq: string, cond: ResolvedConditions) {
    return meltingTemperature(canonicalVariant(seq), cond);
  }
}
