import type {
  AnalysisWarning,
  PcrConditions,
  PrimerAnalysis,
  ResolvedConditions,
} from './types.js';
import type { ComputeBackend } from './backend/backend.js';
import { TypeScriptBackend } from './backend/backend.js';
import {
  CRITICAL_DG,
  DEFAULT_CONDITIONS,
  DEGENERACY_WARN,
  THREE_PRIME_DG_CRITICAL,
  THREE_PRIME_DG_WARN,
  WARNING_DG,
} from './constants.js';
import { normalizeSequence } from './sequence/validate.js';
import { gcContent } from './sequence/gc.js';
import { analyzeDegeneracy, canonicalVariant } from './sequence/degenerate.js';
import { toUnit } from './thermo/tm.js';

function finiteNumber(
  value: number | undefined,
  fallback: number,
  name: string,
  min: number,
): number {
  const v = value ?? fallback;
  if (typeof v !== 'number' || !Number.isFinite(v) || v < min) {
    throw new RangeError(
      `Invalid PCR condition ${name}=${String(value)}: ` + `expected a finite number ≥ ${min}.`,
    );
  }
  return v;
}

/** Resolves user conditions over {@link DEFAULT_CONDITIONS} (validated). */
export function resolveConditions(input: PcrConditions = {}): ResolvedConditions {
  const salt_method = input.salt_method ?? DEFAULT_CONDITIONS.salt_method;
  if (salt_method !== 'vonAhsen' && salt_method !== 'owczarzy' && salt_method !== 'none') {
    throw new RangeError(
      `Invalid PCR condition salt_method=${String(input.salt_method)}: ` +
        `expected 'vonAhsen', 'owczarzy' or 'none'.`,
    );
  }
  const temp_unit = input.temp_unit ?? DEFAULT_CONDITIONS.temp_unit;
  if (temp_unit !== 'C' && temp_unit !== 'F') {
    throw new RangeError(
      `Invalid PCR condition temp_unit=${String(input.temp_unit)}: ` + `expected 'C' or 'F'.`,
    );
  }
  return {
    na_conc: finiteNumber(input.na_conc, DEFAULT_CONDITIONS.na_conc, 'na_conc', 0),
    mg_conc: finiteNumber(input.mg_conc, DEFAULT_CONDITIONS.mg_conc, 'mg_conc', 0),
    dNTPs_conc: finiteNumber(input.dNTPs_conc, DEFAULT_CONDITIONS.dNTPs_conc, 'dNTPs_conc', 0),
    primer_conc: finiteNumber(
      input.primer_conc,
      DEFAULT_CONDITIONS.primer_conc,
      'primer_conc',
      Number.MIN_VALUE,
    ),
    dmso_percent: finiteNumber(
      input.dmso_percent,
      DEFAULT_CONDITIONS.dmso_percent,
      'dmso_percent',
      0,
    ),
    salt_method,
    temp_unit,
    eval_temp_c: finiteNumber(
      input.eval_temp_c,
      DEFAULT_CONDITIONS.eval_temp_c,
      'eval_temp_c',
      -273.15,
    ),
  };
}

/**
 * High-level single-primer analyzer (spec §4).
 *
 * ```ts
 * const analyzer = new PrimerAnalyzer({ na_conc: 50, mg_conc: 2.5 });
 * const result = analyzer.evaluate('ATGCGTAGCTAGCTAGCTA');
 * ```
 */
export class PrimerAnalyzer {
  readonly conditions: ResolvedConditions;
  readonly backend: ComputeBackend;

  constructor(conditions: PcrConditions = {}, backend?: ComputeBackend) {
    this.conditions = resolveConditions(conditions);
    this.backend = backend ?? new TypeScriptBackend();
  }

  /** Full analysis of one primer sequence. */
  evaluate(input: string): PrimerAnalysis {
    const sequence = normalizeSequence(input);
    const cond = this.conditions;
    const warnings: AnalysisWarning[] = [];
    const push = (code: string, severity: AnalysisWarning['severity'], message: string) =>
      warnings.push({ code, severity, message });

    const length = sequence.length;
    const gc = gcContent(sequence);

    // Degenerate primers: Tm on the abundance-weighted variant space,
    // structures on the canonical variant (documented approximation).
    const degeneracy = analyzeDegeneracy(sequence, cond);
    const canon = canonicalVariant(sequence);

    const { tmC, dH, dS, naEq_mM } = this.backend.tm(canon, cond);
    const tm = degeneracy.isDegenerate
      ? (degeneracy.tmWeighted as number)
      : toUnit(tmC, cond.temp_unit);

    const hairpin = this.backend.hairpin(sequence, cond);
    const homodimer = this.backend.homodimer(sequence, cond);
    const threePrime = this.backend.threePrime(sequence);

    // ---- Heuristic rule set (documented, deterministic) ----
    if (length < 15) {
      push(
        'SEQUENCE_TOO_SHORT',
        'warning',
        `Short primer (${length} nt): typical PCR primers are 18–25 nt.`,
      );
    }
    if (length > 35) {
      push(
        'SEQUENCE_TOO_LONG',
        'warning',
        `Long primer (${length} nt): specificity and synthesis yield drop beyond ~35 nt.`,
      );
    }
    if (gc < 30 || gc > 70) {
      push(
        'GC_CONTENT_SUBOPTIMAL',
        'warning',
        `GC content ${gc.toFixed(1)}% outside the recommended 30–70% range.`,
      );
    }
    const tmCForRange = degeneracy.isDegenerate ? (degeneracy.tmWeighted as number) : tmC;
    const tmInC = cond.temp_unit === 'F' ? (tmCForRange - 32) / 1.8 : tmCForRange;
    if (tmInC < 50 || tmInC > 68) {
      push(
        'TM_OUT_OF_RANGE',
        'warning',
        `Tm ${tmInC.toFixed(1)} °C outside the recommended 50–68 °C range.`,
      );
    }
    if (degeneracy.isDegenerate && degeneracy.factor > DEGENERACY_WARN) {
      push(
        'HIGH_DEGENERACY',
        'warning',
        `High degeneracy D=${degeneracy.factor}: keep D ≤ ${DEGENERACY_WARN} ` +
          'to preserve effective primer concentration.',
      );
    }
    if (hairpin.deltaG !== null) {
      if (hairpin.deltaG < CRITICAL_DG) {
        push(
          'STABLE_HAIRPIN',
          'critical',
          `Stable hairpin ΔG=${hairpin.deltaG.toFixed(2)} kcal/mol ` +
            `(stem ${hairpin.stemLength} bp, loop ${hairpin.loopLength} nt) ` +
            'may inhibit PCR.',
        );
      } else if (hairpin.deltaG <= WARNING_DG) {
        push(
          'STABLE_HAIRPIN',
          'warning',
          `Hairpin ΔG=${hairpin.deltaG.toFixed(2)} kcal/mol detected.`,
        );
      }
    }
    if (homodimer.deltaG !== null) {
      if (homodimer.deltaG < CRITICAL_DG) {
        push(
          'STABLE_HOMODIMER',
          'critical',
          `Stable homodimer ΔG=${homodimer.deltaG.toFixed(2)} kcal/mol ` + 'may inhibit PCR.',
        );
      } else if (homodimer.deltaG <= WARNING_DG) {
        push(
          'STABLE_HOMODIMER',
          'warning',
          `Homodimer ΔG=${homodimer.deltaG.toFixed(2)} kcal/mol detected.`,
        );
      }
      if (homodimer.threePrimeAnchored && homodimer.deltaG <= WARNING_DG) {
        push(
          'HOMODIMER_3P_ANCHORED',
          'warning',
          'Homodimer is 3′-anchored and polymerase-extendable (primer-dimer risk).',
        );
      }
    }
    if (threePrime.deltaG37 !== null) {
      if (threePrime.deltaG37 <= THREE_PRIME_DG_CRITICAL) {
        push(
          'STABLE_3P_END',
          'critical',
          `Critically stable 3′ end (pentamer ΔG°37=${threePrime.deltaG37.toFixed(2)} ` +
            'kcal/mol): severe mispriming risk.',
        );
      } else if (threePrime.deltaG37 < THREE_PRIME_DG_WARN) {
        push(
          'STABLE_3P_END',
          'warning',
          `Over-stable 3′ end (pentamer ΔG°37=${threePrime.deltaG37.toFixed(2)} ` +
            'kcal/mol): mispriming risk.',
        );
      }
    }
    if (threePrime.gcClamp === 'none') {
      push(
        'NO_GC_CLAMP',
        'info',
        'No 3′ GC clamp: a terminal G/C pair improves priming specificity.',
      );
    }

    const hasRisks = warnings.some((w) => w.severity !== 'info');
    return {
      sequence,
      length,
      gcContent: gc,
      tm,
      tmUnit: cond.temp_unit,
      deltaH: dH,
      deltaS: dS,
      naEquivalent: naEq_mM,
      degeneracy,
      hairpin,
      homodimer,
      threePrime,
      warnings,
      hasRisks,
    };
  }
}
