import type { DegeneracyMode, PcrConditions, PrimerAnalysis } from './types.js';
import type { ComputeBackend } from './backend/backend.js';
import { PrimerAnalyzer } from './PrimerAnalyzer.js';

/** Batch input: bare sequence or labelled primer. */
export type BatchInput = string | { id: string; seq: string };

/** Single-primer analysis with the input id echoed when provided. */
export interface BatchResult extends PrimerAnalysis {
  id?: string;
}

/**
 * Batch analysis sharing one analyzer (conditions + backend) across primers.
 * Per-primer cost is identical to `analyzePrimer`; the win is one backend
 * setup (notably a single WASM instantiation) and ordered results.
 */
export function analyzeBatch(
  primers: BatchInput[],
  conditions: PcrConditions = {},
  backend?: ComputeBackend,
  opts: { degeneracyMode?: DegeneracyMode } = {},
): BatchResult[] {
  const analyzer = new PrimerAnalyzer(conditions, backend, opts);
  return primers.map((p) => {
    if (typeof p === 'string') {
      return analyzer.evaluate(p);
    }
    return { ...analyzer.evaluate(p.seq), id: p.id };
  });
}
