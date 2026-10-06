import type { ResolvedConditions } from '../types.js';
import { R_CAL, ZERO_C_KELVIN } from '../constants.js';
import { gcContent } from '../sequence/gc.js';
import { duplexThermodynamics } from './nearest-neighbor.js';
import { tmTwoState, tmSelfComplementary } from './gibbs.js';
import { sodiumEquivalent, saltAdjustmentCelsius, owczarzySaltTm } from './salt.js';

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
  const s = seq.toUpperCase();
  const { dH, dS } = duplexThermodynamics(s, false);
  const ctM = primerConcToMolar(cond.primer_conc);
  let saltAdj = 0;
  let naEq = cond.na_conc;
  if (cond.salt_method === 'vonAhsen') {
    naEq = sodiumEquivalent(cond.na_conc, cond.mg_conc, cond.dNTPs_conc);
    saltAdj = saltAdjustmentCelsius(naEq);
  }
  let tmC: number;
  if (cond.salt_method === 'owczarzy') {
    tmC = owczarzySaltTm(
      tmTwoState(dH, dS, ctM, 0),
      cond.na_conc,
      cond.mg_conc,
      cond.dNTPs_conc,
      gcContent(s) / 100,
      s.length,
    );
  } else {
    tmC = tmTwoState(dH, dS, ctM, saltAdj);
  }
  tmC -= 0.75 * cond.dmso_percent;
  return { tmC, dH, dS, naEq_mM: naEq };
}

/**
 * Dimer duplex melting temperature honoring homo/hetero concentration
 * conventions (R·ln Ct with symmetry correction, R·ln(Ct/2) respectively)
 * and the configured salt strategy. `gcFrac`/`alnLen` describe the traced
 * duplex (Owczarzy %GC/N); ignored by other salt methods.
 */
export function dimerMeltingTemp(
  dH: number,
  dS: number,
  cond: ResolvedConditions,
  selfComplementary: boolean,
  gcFrac: number,
  alnLen: number,
): number {
  const ctM = primerConcToMolar(cond.primer_conc);
  if (cond.salt_method === 'owczarzy') {
    const concTerm = selfComplementary ? R_CAL * Math.log(ctM) : R_CAL * Math.log(ctM / 2);
    const tm1M = (dH * 1000) / (dS + concTerm) - ZERO_C_KELVIN;
    return (
      owczarzySaltTm(tm1M, cond.na_conc, cond.mg_conc, cond.dNTPs_conc, gcFrac, alnLen) -
      0.75 * cond.dmso_percent
    );
  }
  const saltAdj =
    cond.salt_method === 'vonAhsen'
      ? saltAdjustmentCelsius(sodiumEquivalent(cond.na_conc, cond.mg_conc, cond.dNTPs_conc))
      : 0;
  // Homo path reuses the reference two-state self-complementary formula.
  let tm = selfComplementary
    ? tmSelfComplementary(dH, dS, ctM, saltAdj)
    : (dH * 1000) / (dS + R_CAL * Math.log(ctM / 2)) - ZERO_C_KELVIN + saltAdj;
  tm -= 0.75 * cond.dmso_percent;
  return tm;
}

/** Celsius → configured unit. */
export function toUnit(tmC: number, unit: 'C' | 'F'): number {
  return unit === 'F' ? tmC * 1.8 + 32 : tmC;
}
