/**
 * Public type definitions for `@sfstudio_tools/primer-calc`.
 *
 * All concentrations follow the units documented on each field.
 * Temperatures are expressed in the unit selected via {@link PcrConditions.temp_unit}
 * (`'C'` for Celsius by default, `'F'` for Fahrenheit).
 */

/** Temperature unit selector. */
export type TempUnit = 'C' | 'F';

/** Salt-correction strategy applied to the melting temperature. */
export type SaltMethod = 'vonAhsen' | 'owczarzy' | 'none';

/** Severity level attached to an analysis warning. */
export type WarningSeverity = 'info' | 'warning' | 'critical';

/** PCR / assay buffer conditions shared by every thermodynamic computation. */
export interface PcrConditions {
  /** Monovalent cation concentration (Na⁺ + K⁺), in mM. @default 50 */
  na_conc?: number;
  /** Magnesium concentration (Mg²⁺), in mM. von Ahsen correction. @default 2.5 */
  mg_conc?: number;
  /** Total dNTP concentration (sum of the 4 dNTPs), in mM. @default 0.8 */
  dNTPs_conc?: number;
  /** Total primer (oligo) concentration, in nM. @default 200 */
  primer_conc?: number;
  /** DMSO percentage (v/v). Applies −0.75 °C per % (von Ahsen 2001). @default 0 */
  dmso_percent?: number;
  /** Salt-correction strategy. @default 'vonAhsen' */
  salt_method?: SaltMethod;
  /** Output temperature unit. @default 'C' */
  temp_unit?: TempUnit;
  /**
   * Temperature at which secondary-structure ΔG values are evaluated, in °C.
   * @default 37
   */
  eval_temp_c?: number;
}

/** Fully resolved conditions (no optional fields). */
export interface ResolvedConditions {
  na_conc: number;
  mg_conc: number;
  dNTPs_conc: number;
  primer_conc: number;
  dmso_percent: number;
  salt_method: SaltMethod;
  temp_unit: TempUnit;
  eval_temp_c: number;
}

/** A single structured warning produced by an analysis. */
export interface AnalysisWarning {
  code: string;
  severity: WarningSeverity;
  message: string;
}

/** Degeneracy report for (possibly ambiguous) IUPAC sequences. */
export interface DegeneracyInfo {
  /** Total degeneracy factor D = ∏ nᵢ. */
  factor: number;
  /** True when the sequence contains at least one ambiguous IUPAC code. */
  isDegenerate: boolean;
  /** Tm of the least stable enumerated variant (°C or °F). */
  tmMin: number | null;
  /** Tm of the most stable enumerated variant. */
  tmMax: number | null;
  /**
   * Abundance-weighted mean Tm over enumerated variants
   * (O'Donnell–Maloney). Exhaustive when D ≤ 4096, else a deterministic
   * sample — min/max then bound the observed, not the theoretical, range.
   */
  tmWeighted: number | null;
  /** Number of concrete variants effectively enumerated. */
  variantsEnumerated: number;
}

/** Hairpin (stem–loop) analysis result. */
export interface HairpinResult {
  /** True when a stem–loop with a paired stem was found. */
  found: boolean;
  /** ΔG of the most stable hairpin at the evaluation temperature (kcal/mol). */
  deltaG: number | null;
  /** Length of the paired stem (bp) of the best hairpin. */
  stemLength: number;
  /** Length of the unpaired loop (nt) of the best hairpin. */
  loopLength: number;
}

/** Homo/hetero-dimer analysis result for one pair of oligos. */
export interface DimerResult {
  /** True when a WC-paired alignment was found. */
  found: boolean;
  /** ΔG of the most stable dimer alignment (kcal/mol). */
  deltaG: number | null;
  /** Tm of the dimer duplex, always in °C (no temp_unit conversion). */
  tm: number | null;
  /** Number of Watson–Crick pairs in the best alignment. */
  pairedBases: number;
  /**
   * Longest 3′-terminal complementary run (either strand), counted from the
   * actual strand terminus: 0 when the alignment leaves a 3′ overhang
   * (non-extendable), else the paired run into the duplex.
   */
  threePrimeRun: number;
  /** True when the 3′ end of either strand can be extended by a polymerase. */
  threePrimeAnchored: boolean;
}

/** 3′-end stability report (5-nt window). */
export interface ThreePrimeResult {
  /** ΔG°37 of the 3′-terminal pentamer duplex (kcal/mol). */
  deltaG37: number | null;
  /** GC-clamp description of the last two 3′ bases. */
  gcClamp: 'none' | 'single' | 'double';
  /** Number of G/C among the last 5 bases. */
  gcCount3p: number;
}

/** Full single-primer analysis report returned by `PrimerAnalyzer.evaluate`. */
export interface PrimerAnalysis {
  /** Normalised (upper-case, trimmed) input sequence. */
  sequence: string;
  /** Sequence length (nt). */
  length: number;
  /** GC content in percent (0–100, fractional counting for IUPAC codes). */
  gcContent: number;
  /** SantaLucia nearest-neighbor melting temperature. */
  tm: number;
  /** Unit of {@link PrimerAnalysis.tm}. */
  tmUnit: TempUnit;
  /** Cumulative duplex enthalpy ΔH° (kcal/mol) for the perfect-match duplex. */
  deltaH: number;
  /** Cumulative duplex entropy ΔS° (cal/(mol·K)) for the perfect-match duplex. */
  deltaS: number;
  /**
   * Sodium-equivalent cation concentration (mM, von Ahsen). Under the
   * Owczarzy mixed-salt model this carries the monovalent input instead.
   */
  naEquivalent: number;
  degeneracy: DegeneracyInfo;
  hairpin: HairpinResult;
  homodimer: DimerResult;
  threePrime: ThreePrimeResult;
  warnings: AnalysisWarning[];
  /** True when at least one `warning` or `critical` warning was raised. */
  hasRisks: boolean;
}

/** A primer registered in a multiplex pool. */
export interface PoolPrimer {
  id: string;
  seq: string;
}

/** One cross-dimer conflict between two pool members. */
export interface CrossDimerConflict {
  primerA: string;
  primerB: string;
  deltaG: number;
  severity: WarningSeverity;
  threePrimeAnchored: boolean;
}

/** Result of `MultiplexPool.evaluateCrossDimerization`. */
export interface CrossDimerizationResult {
  /** Full N×N ΔG matrix (kcal/mol, `null` on the diagonal when no homodimer). */
  matrix: (number | null)[][];
  /** Pool member ids, in matrix order. */
  ids: string[];
  conflicts: CrossDimerConflict[];
  /** True when at least one conflict was detected. */
  hasCrossDimers: boolean;
}
