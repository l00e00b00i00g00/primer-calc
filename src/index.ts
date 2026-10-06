/**
 * `@sfstudio_tools/primer-calc` — scientific-grade primer/probe thermodynamics.
 *
 * @packageDocumentation
 */

export { PrimerAnalyzer, resolveConditions } from './PrimerAnalyzer.js';
export { MultiplexPool } from './MultiplexPool.js';
export { analyzePrimer, calculateTm } from './analyze.js';
export { evaluateAgainstTarget } from './target.js';
export { analyzePrimerPair, PAIR_TM_TOLERANCE } from './pair.js';
export { analyzeBatch } from './batch.js';
export type { BatchInput, BatchResult } from './batch.js';

export { PrimerValidationError, assertUnambiguous } from './sequence/validate.js';
export { MIN_SEQUENCE_LENGTH, MAX_SEQUENCE_LENGTH } from './sequence/validate.js';
export {
  IUPAC_BASES,
  IUPAC_COMPLEMENT,
  expandIupac,
  reverseComplement,
  degeneracyFactor,
  canPair,
  isWatsonCrickPair,
  isIupacBase,
} from './sequence/iupac.js';
export { gcContent, atContent, baseCounts } from './sequence/gc.js';
export {
  enumerateVariants,
  analyzeDegeneracy,
  canonicalVariant,
  MAX_VARIANTS_ENUMERATED,
} from './sequence/degenerate.js';

export {
  duplexThermodynamics,
  alignmentThermodynamics,
  BULGE_DG37,
} from './thermo/nearest-neighbor.js';
export type { DuplexFlanks, DuplexThermo } from './thermo/nearest-neighbor.js';
export {
  sodiumEquivalent,
  saltAdjustmentCelsius,
  freeMagnesium,
  owczarzySaltTm,
} from './thermo/salt.js';
export { gibbsFreeEnergy, tmTwoState, tmSelfComplementary } from './thermo/gibbs.js';
export { meltingTemperature, dimerMeltingTemp, primerConcToMolar, toUnit } from './thermo/tm.js';

export { bestHairpin, MIN_STEM, MIN_LOOP } from './structure/hairpin.js';
export {
  bestDimer,
  bestDimerAlignment,
  depictMerged,
  ANCHORED_RUN_MIN,
} from './structure/dimer.js';
export type { DimerAlignment } from './structure/dimer.js';
export { tracebackBestAlignment } from './structure/dp-align.js';
export type { DpAlignment } from './structure/dp-align.js';
export { analyzeThreePrime, THREE_PRIME_WINDOW } from './bias/threePrime.js';
export { crossDimerizationMatrix, assembleCrossDimerization } from './multiplex/pool.js';
export { crossDimerizationParallel } from './multiplex/parallel.js';
export type { ParallelOptions } from './multiplex/parallel.js';
export {
  crossDimerizationWebWorkers,
  handleWorkerMessage,
  DEFAULT_WEB_WORKERS,
} from './multiplex/webworker.js';
export type {
  WebWorkerOptions,
  WorkerPair,
  WorkerRequest,
  WorkerResponse,
  WebWorkerLike,
} from './multiplex/webworker.js';

export { TypeScriptBackend } from './backend/backend.js';
export type { ComputeBackend } from './backend/backend.js';
export {
  WasmBackend,
  loadWasmBackend,
  loadWasmBackendWeb,
  initWasmModule,
} from './backend/wasm.js';
export type { WasmDimerModule, WasmWebModule, WasmLoadOptions } from './backend/wasm.js';

export {
  INITIATION,
  TERMINAL_AT,
  SYMMETRY_DS,
  CRITICAL_DG,
  WARNING_DG,
  THREE_PRIME_DG_WARN,
  THREE_PRIME_DG_CRITICAL,
  DEGENERACY_WARN,
  OWCZARZY_2008,
  IMM_TABLE,
  TMM_TABLE,
  DEFAULT_CONDITIONS,
  nnParams,
  immParams,
  tmmParams,
  danglingParams,
  hairpinLoopParams,
} from './constants.js';

export type {
  TempUnit,
  SaltMethod,
  WarningSeverity,
  PcrConditions,
  ResolvedConditions,
  AnalysisWarning,
  DegeneracyInfo,
  HairpinResult,
  DimerResult,
  ThreePrimeResult,
  PrimerAnalysis,
  TargetDuplexAnalysis,
  DuplexDifference,
  PrimerPairAnalysis,
  DegeneracyMode,
  PoolPrimer,
  CrossDimerConflict,
  CrossDimerizationResult,
} from './types.js';
