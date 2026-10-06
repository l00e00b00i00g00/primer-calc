import { R_CAL, ZERO_C_KELVIN } from '../constants.js';

/** ΔG° (kcal/mol) = ΔH° − T·ΔS°, with T in Kelvin. */
export function gibbsFreeEnergy(dH_kcal: number, dS_cal: number, tempCelsius: number): number {
  const tK = tempCelsius + ZERO_C_KELVIN;
  return dH_kcal - (tK * dS_cal) / 1000;
}

/**
 * Two-state melting temperature of a non-self-complementary duplex.
 *
 * Tm = ΔH°·1000 / (ΔS° + R·ln(Ct/4)) − 273.15, plus `saltAdjustment`.
 *
 * @param dH_kcal cumulative enthalpy (kcal/mol).
 * @param dS_cal cumulative entropy (cal/(mol·K)).
 * @param ct_M total strand concentration (M).
 * @param saltAdjustment salt term in °C (e.g. 16.6·log₁₀[Na⁺]).
 */
export function tmTwoState(
  dH_kcal: number,
  dS_cal: number,
  ct_M: number,
  saltAdjustment: number,
): number {
  const denom = dS_cal + R_CAL * Math.log(ct_M / 4);
  return (dH_kcal * 1000) / denom - ZERO_C_KELVIN + saltAdjustment;
}

/**
 * Two-state melting temperature of a self-complementary duplex
 * (homodimer): concentration term R·ln(Ct) and symmetry-corrected ΔS°.
 */
export function tmSelfComplementary(
  dH_kcal: number,
  dS_cal: number,
  ct_M: number,
  saltAdjustment: number,
): number {
  const denom = dS_cal + R_CAL * Math.log(ct_M);
  return (dH_kcal * 1000) / denom - ZERO_C_KELVIN + saltAdjustment;
}
