import type {
  CrossDimerConflict,
  CrossDimerizationResult,
  DimerResult,
  PoolPrimer,
  ResolvedConditions,
} from '../types.js';
import type { ComputeBackend } from '../backend/backend.js';
import { TypeScriptBackend } from '../backend/backend.js';
import { CRITICAL_DG, WARNING_DG } from '../constants.js';

/**
 * Assembles a full cross-dimerization report from per-pair dimer results.
 * Shared by the synchronous, WASM and worker-thread evaluation paths so
 * every engine reports identical conflicts.
 */
export function assembleCrossDimerization(
  ids: string[],
  pairResults: Array<{ i: number; j: number; dimer: DimerResult }>,
): CrossDimerizationResult {
  const n = ids.length;
  const matrix: (number | null)[][] = Array.from({ length: n }, () =>
    new Array<number | null>(n).fill(null),
  );
  const conflicts: CrossDimerConflict[] = [];
  for (const { i, j, dimer } of pairResults) {
    const dG = dimer.deltaG;
    (matrix[i] as (number | null)[])[j] = dG;
    (matrix[j] as (number | null)[])[i] = dG;
    if (dG !== null && dG <= WARNING_DG) {
      const severity =
        dG < CRITICAL_DG || (dimer.threePrimeAnchored && dG < -7)
          ? 'critical'
          : 'warning';
      conflicts.push({
        primerA: ids[i] as string,
        primerB: ids[j] as string,
        deltaG: dG,
        severity,
        threePrimeAnchored: dimer.threePrimeAnchored,
      });
    }
  }
  conflicts.sort((x, y) => x.deltaG - y.deltaG);
  return { matrix, ids, conflicts, hasCrossDimers: conflicts.length > 0 };
}

/**
 * Pairwise cross-dimerization of a multiplex primer pool.
 *
 * Every unordered pair (including self-pairs → homodimers) is scored through
 * `backend` (TypeScript engine by default, compiled Rust/WASM via
 * {@link WasmBackend}); degenerate primers are scanned on their canonical
 * variant. Pairs with ΔG ≤ {@link WARNING_DG} become conflicts, `critical`
 * when ΔG < {@link CRITICAL_DG} (spec §2.B) or when a polymerase-extendable
 * 3′ anchor pairs with ΔG < −7 kcal/mol.
 */
export function crossDimerizationMatrix(
  primers: PoolPrimer[],
  cond: ResolvedConditions,
  backend: ComputeBackend = new TypeScriptBackend(),
): CrossDimerizationResult {
  const n = primers.length;
  const ids = primers.map((p) => p.id);
  const pairResults: Array<{ i: number; j: number; dimer: DimerResult }> = [];
  for (let i = 0; i < n; i++) {
    for (let j = i; j < n; j++) {
      const a = (primers[i] as PoolPrimer).seq;
      const b = (primers[j] as PoolPrimer).seq;
      const dimer: DimerResult =
        i === j ? backend.homodimer(a, cond) : backend.heterodimer(a, b, cond);
      pairResults.push({ i, j, dimer });
    }
  }
  return assembleCrossDimerization(ids, pairResults);
}
