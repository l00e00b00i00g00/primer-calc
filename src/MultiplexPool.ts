import type { CrossDimerizationResult, PcrConditions, PoolPrimer } from './types.js';
import type { ComputeBackend as Backend } from './backend/backend.js';
import { TypeScriptBackend } from './backend/backend.js';
import { resolveConditions } from './PrimerAnalyzer.js';
import { crossDimerizationMatrix } from './multiplex/pool.js';
import { crossDimerizationParallel, type ParallelOptions } from './multiplex/parallel.js';
import { normalizeSequence } from './sequence/validate.js';

/**
 * A pool of primers co-amplified in one multiplex reaction (spec §4).
 *
 * ```ts
 * const pool = new MultiplexPool([
 *   { id: 'primer_fwd_1', seq: 'ATCGATCGATCGATCG' },
 *   { id: 'primer_rev_1', seq: 'GCTAGCTAGCTAGCTA' },
 * ]);
 * const crossCheck = pool.evaluateCrossDimerization();
 * ```
 *
 * The pool score engine is the injected {@link Backend} (TypeScript by
 * default, compiled Rust/WASM via `WasmBackend` + `loadWasmBackend()`).
 */
export class MultiplexPool {
  readonly primers: PoolPrimer[];
  readonly backend: Backend;

  constructor(primers: PoolPrimer[], backend?: Backend) {
    if (!Array.isArray(primers) || primers.length === 0) {
      throw new Error('MultiplexPool requires at least one primer.');
    }
    const seen = new Set<string>();
    this.primers = primers.map((p) => {
      if (!p || typeof p.id !== 'string' || p.id.length === 0) {
        throw new Error('Every pool primer needs a non-empty string id.');
      }
      if (seen.has(p.id)) throw new Error(`Duplicate primer id: "${p.id}".`);
      seen.add(p.id);
      return { id: p.id, seq: normalizeSequence(p.seq) };
    });
    this.backend = backend ?? new TypeScriptBackend();
  }

  /** N×N cross-dimerization scan under the given PCR conditions. */
  evaluateCrossDimerization(conditions: PcrConditions = {}): CrossDimerizationResult {
    const cond = resolveConditions(conditions);
    return crossDimerizationMatrix(this.primers, cond, this.backend);
  }

  /**
   * N×N scan distributed over `node:worker_threads` (always the
   * TypeScript engine inside workers). Identical results to
   * {@link evaluateCrossDimerization}; requires `npm run build`.
   */
  evaluateCrossDimerizationParallel(
    conditions: PcrConditions = {},
    opts: ParallelOptions = {},
  ): Promise<CrossDimerizationResult> {
    const cond = resolveConditions(conditions);
    return crossDimerizationParallel(this.primers, cond, opts);
  }
}
