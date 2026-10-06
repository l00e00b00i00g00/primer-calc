import type { ResolvedConditions } from '../types.js';
import { duplexThermodynamics } from './nearest-neighbor.js';
import { tmTwoState } from './gibbs.js';
import { sodiumEquivalent, saltAdjustmentCelsius } from './salt.js';

/** Primer concentration: nM → M. */
export function primerConcToMolar(primerConc_nM: number): number {
  return primerConc_nM * 1e-9;
}

/**
 * SantaLucia nearest-neighbor melting temperature of an unambiguous primer.
 *
 * Tm = ΔH°/(ΔS° + R·ln(Ct/4)) − 273.15 + 16.6·log₁₀[Na⁺]eq − 0.75·DMSO%.
 * Always returns Celsius; unit conversion happens at the API boundary.
 */
export function meltingTemperature(
  seq: string,
  cond: ResolvedConditions,
): { tmC: number; dH: number; dS: number; naEq_mM: number } {
  const { dH, dS } = duplexThermodynamics(seq.toUpperCase(), false);
  const ctM = primerConcToMolar(cond.primer_conc);
  let saltAdj = 0;
  let naEq = cond.na_conc;
  if (cond.salt_method === 'vonAhsen') {
    naEq = sodiumEquivalent(cond.na_conc, cond.mg_conc, cond.dNTPs_conc);
    saltAdj = saltAdjustmentCelsius(naEq);
  }
  let tmC = tmTwoState(dH, dS, ctM, saltAdj);
  tmC -= 0.75 * cond.dmso_percent;
  return { tmC, dH, dS, naEq_mM: naEq };
}

/** Celsius → configured unit. */
export function toUnit(tmC: number, unit: 'C' | 'F'): number {
  return unit === 'F' ? tmC * 1.8 + 32 : tmC;
}
