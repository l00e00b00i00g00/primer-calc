import type {
  AnalysisWarning,
  DuplexDifference,
  PcrConditions,
  TargetDuplexAnalysis,
} from './types.js';
import type { DuplexFlanks } from './thermo/nearest-neighbor.js';
import { resolveConditions } from './PrimerAnalyzer.js';
import { normalizeSequence } from './sequence/validate.js';
import { canonicalVariant } from './sequence/degenerate.js';
import { isWatsonCrickPair } from './sequence/iupac.js';
import { alignmentThermodynamics, duplexThermodynamics } from './thermo/nearest-neighbor.js';
import { gibbsFreeEnergy } from './thermo/gibbs.js';
import { meltingTemperature, toUnit } from './thermo/tm.js';
import { bestDimerAlignment } from './structure/dimer.js';

/**
 * Primer-vs-target duplex analysis (SNP discrimination, mispriming).
 *
 * Both sequences are given 5′ → 3′; the target is scanned antiparallel for
 * its best binding frame (thermodynamic DP + block union, single
 * initiation). Mismatches score with IMM/TMM parameters, bulges break
 * stacking. Degenerate primers are scored on their canonical variant
 * (documented approximation shared with the rest of the library).
 *
 * Runs on the TypeScript engine in every configuration — bit-exact parity
 * with the WASM backend is enforced by the shared test suite.
 * Degenerate targets are scored on their canonical variant (same documented
 * approximation as degenerate primers; positions still refer to the input).
 */
export function evaluateAgainstTarget(
  primerSeq: string,
  targetSeq: string,
  conditions: PcrConditions = {},
): TargetDuplexAnalysis {
  const primer = normalizeSequence(primerSeq);
  const target = normalizeSequence(targetSeq);
  const cond = resolveConditions(conditions);
  const warnings: AnalysisWarning[] = [];
  const push = (code: string, severity: AnalysisWarning['severity'], message: string) =>
    warnings.push({ code, severity, message });

  const canon = canonicalVariant(primer);
  const targetCanon = canonicalVariant(target);
  const found = bestDimerAlignment(canon, targetCanon, cond, false);

  // Perfect-match reference (duplex model at 37 °C + primer Tm).
  const perfect = duplexThermodynamics(canon, false);
  const deltaGPerfect37 = gibbsFreeEnergy(perfect.dH, perfect.dS, 37);
  const tmPerfect = toUnit(meltingTemperature(canon, cond).tmC, cond.temp_unit);

  if (!found.result.found || found.result.deltaG === null) {
    push(
      'TARGET_NO_BINDING',
      'critical',
      'No stable primer·target alignment found under these conditions.',
    );
    return {
      primer,
      target,
      alignedPrimer: '',
      alignedTarget: '',
      deltaG: null,
      tm: null,
      tmUnit: cond.temp_unit,
      deltaGPerfect37,
      tmPerfect,
      deltaDeltaG37: null,
      differences: [],
      threePrime: 'unpaired',
      extendable: false,
      warnings,
      hasRisks: true,
    };
  }

  const { top, bottom, aStart, bStartRev } = found;
  // Display depiction: primer 5′ → 3′ as-is; target flipped to 5′ → 3′.
  const alignedPrimer = top;
  const alignedTarget = [...bottom].reverse().join('');

  // Walk the traced alignment in strand coordinates (gaps excluded).
  // Bottom runs 3′ → 5′: target index (5′ → 3′) counts down from the end.
  const differences: DuplexDifference[] = [];
  let pi = aStart;
  let ti = targetCanon.length - 1 - bStartRev;
  let lastPi = -1;
  let lastPiPaired = false;
  for (let k = 0; k < top.length; k++) {
    const t = (top[k] as string).toUpperCase();
    const u = (bottom[k] as string).toUpperCase();
    if (t === '-') {
      differences.push({
        kind: 'bulge',
        primerIndex: null,
        targetIndex: ti,
        primerBase: '-',
        targetBase: u,
      });
      ti--;
    } else if (u === '-') {
      differences.push({
        kind: 'bulge',
        primerIndex: pi,
        targetIndex: null,
        primerBase: t,
        targetBase: '-',
      });
      lastPi = pi;
      lastPiPaired = false;
      pi++;
    } else if (isWatsonCrickPair(t, u)) {
      lastPi = pi;
      lastPiPaired = true;
      pi++;
      ti--;
    } else {
      differences.push({
        kind: 'mismatch',
        primerIndex: pi,
        targetIndex: ti,
        primerBase: t,
        targetBase: u,
      });
      lastPi = pi;
      lastPiPaired = false;
      pi++;
      ti--;
    }
  }

  // Primer 3′ terminus state.
  let threePrime: TargetDuplexAnalysis['threePrime'] = 'unpaired';
  if (lastPi === primer.length - 1) {
    threePrime = lastPiPaired ? 'paired' : 'mismatched';
  }
  const extendable = threePrime === 'paired';

  // ΔG°37 of the traced alignment, for the perfect-match comparison.
  // Strand consumption (gaps excluded) drives flank lookup.
  let consTop = 0;
  let consBottom = 0;
  for (let k = 0; k < top.length; k++) {
    if ((top[k] as string) !== '-') consTop++;
    if ((bottom[k] as string) !== '-') consBottom++;
  }
  const flanks: DuplexFlanks = {};
  if (aStart > 0) flanks.top5 = canon[aStart - 1] as string;
  if (bStartRev > 0) flanks.bottom3 = targetCanon[targetCanon.length - bStartRev] as string;
  if (aStart + consTop < canon.length) flanks.top3 = canon[aStart + consTop] as string;
  if (bStartRev + consBottom < targetCanon.length) {
    flanks.bottom5 = targetCanon[targetCanon.length - 1 - (bStartRev + consBottom)] as string;
  }
  const traced = alignmentThermodynamics(top, bottom, false, flanks);
  const deltaG37 = gibbsFreeEnergy(traced.dH, traced.dS, 37);
  const deltaDeltaG37 = Math.max(0, deltaG37 - deltaGPerfect37);

  const deltaG = found.result.deltaG;
  if (!extendable) {
    push(
      threePrime === 'mismatched' ? 'TARGET_3P_MISMATCH' : 'TARGET_3P_FLAP',
      'warning',
      threePrime === 'mismatched'
        ? 'Primer 3′ terminus is mismatched: polymerase extension is severely impaired (allele-specific behavior).'
        : 'Primer 3′ terminus is unpaired (flap): extension cannot initiate here.',
    );
  }
  if (differences.length > 3) {
    push(
      'TARGET_HIGH_DIVERGENCE',
      'warning',
      `${differences.length} differences in the binding footprint: weak, potentially non-specific binding.`,
    );
  }
  if ((deltaG as number) > -6) {
    push(
      'TARGET_WEAK_BINDING',
      'warning',
      `Weak primer·target duplex (ΔG=${(deltaG as number).toFixed(2)} kcal/mol at ${cond.eval_temp_c} °C).`,
    );
  }

  return {
    primer,
    target,
    alignedPrimer,
    alignedTarget,
    deltaG,
    // Invariant of bestDimer: a found duplex always carries its Tm.
    tm: toUnit(found.result.tm as number, cond.temp_unit),
    tmUnit: cond.temp_unit,
    deltaGPerfect37,
    tmPerfect,
    deltaDeltaG37,
    differences,
    threePrime,
    extendable,
    warnings,
    hasRisks: warnings.length > 0,
  };
}
