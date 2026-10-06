import type { AnalysisWarning, DimerResult, PcrConditions, PrimerPairAnalysis } from './types.js';
import type { ComputeBackend } from './backend/backend.js';
import { TypeScriptBackend } from './backend/backend.js';
import { PrimerAnalyzer } from './PrimerAnalyzer.js';
import { CRITICAL_DG, WARNING_DG } from './constants.js';

/** Recommended maximum Tm gap within a primer pair (°C). */
export const PAIR_TM_TOLERANCE = 5;

/**
 * Forward/reverse primer pair analysis: individual reports under shared
 * conditions and backend, Tm matching, and the cross-dimer between them.
 */
export function analyzePrimerPair(
  fwdSeq: string,
  revSeq: string,
  conditions: PcrConditions = {},
  backend?: ComputeBackend,
): PrimerPairAnalysis {
  const engine: ComputeBackend = backend ?? new TypeScriptBackend();
  const fwdAnalyzer = new PrimerAnalyzer(conditions, engine);
  const revAnalyzer = new PrimerAnalyzer(conditions, engine);
  const forward = fwdAnalyzer.evaluate(fwdSeq);
  const reverse = revAnalyzer.evaluate(revSeq);
  const warnings: AnalysisWarning[] = [];
  const push = (code: string, severity: AnalysisWarning['severity'], message: string) =>
    warnings.push({ code, severity, message });

  // Tm values share the configured unit, so the gap is directly comparable.
  // The tolerance is defined in °C and converted for Fahrenheit output.
  const unit = forward.tmUnit;
  const tolerance = unit === 'F' ? PAIR_TM_TOLERANCE * 1.8 : PAIR_TM_TOLERANCE;
  const tmDifference = Math.abs(forward.tm - reverse.tm);
  const tmMatched = tmDifference <= tolerance;
  if (!tmMatched) {
    push(
      'PAIR_TM_MISMATCH',
      'warning',
      `Forward/reverse Tm gap ${tmDifference.toFixed(1)} °${unit} exceeds ${tolerance.toFixed(1)} °${unit}.`,
    );
  }

  const crossDimer: DimerResult = engine.heterodimer(
    forward.sequence,
    reverse.sequence,
    fwdAnalyzer.conditions,
  );
  if (crossDimer.deltaG !== null) {
    if (crossDimer.deltaG < CRITICAL_DG) {
      push(
        'PAIR_CROSS_DIMER',
        'critical',
        `Forward↔reverse heterodimer ΔG=${crossDimer.deltaG.toFixed(2)} kcal/mol may inhibit PCR.`,
      );
    } else if (crossDimer.deltaG <= WARNING_DG) {
      push(
        'PAIR_CROSS_DIMER',
        'warning',
        `Forward↔reverse heterodimer ΔG=${crossDimer.deltaG.toFixed(2)} kcal/mol detected.`,
      );
    }
  }

  const hasRisks =
    warnings.some((w) => w.severity !== 'info') || forward.hasRisks || reverse.hasRisks;
  return {
    forward,
    reverse,
    tmDifference,
    tmMatched,
    crossDimer,
    warnings,
    hasRisks,
  };
}
