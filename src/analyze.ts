import type { PcrConditions, PrimerAnalysis } from './types.js';
import { PrimerAnalyzer } from './PrimerAnalyzer.js';
import { normalizeSequence } from './sequence/validate.js';
import { analyzeDegeneracy } from './sequence/degenerate.js';
import { resolveConditions } from './PrimerAnalyzer.js';
import { toUnit } from './thermo/tm.js';
import { TypeScriptBackend } from './backend/backend.js';

/**
 * Quick melting-temperature calculation with default PCR conditions.
 *
 * ```ts
 * const tm = calculateTm('ATGCGTAGCTAGCTAGCTA');
 * ```
 */
export function calculateTm(seq: string, conditions: PcrConditions = {}): number {
  const sequence = normalizeSequence(seq);
  const cond = resolveConditions(conditions);
  const backend = new TypeScriptBackend();
  const degeneracy = analyzeDegeneracy(sequence, cond);
  if (degeneracy.isDegenerate) return degeneracy.tmWeighted as number;
  return toUnit(backend.tm(sequence, cond).tmC, cond.temp_unit);
}

/**
 * Full single-primer analysis with default PCR conditions.
 *
 * ```ts
 * const analysis = analyzePrimer('ATGCGTAGCTAGCTAGCTA');
 * ```
 */
export function analyzePrimer(seq: string, conditions: PcrConditions = {}): PrimerAnalysis {
  return new PrimerAnalyzer(conditions).evaluate(seq);
}
