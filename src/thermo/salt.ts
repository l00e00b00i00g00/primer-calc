/**
 * Salt corrections for melting-temperature prediction.
 *
 * Default strategy — von Ahsen et al. (2001):
 * `[Na⁺]eq (mM) = [monovalent cations] + 120·√([Mg²⁺] − [dNTPs])`,
 * all concentrations in mmol/L. When Mg²⁺ ≤ dNTPs the divalent term is
 * clamped to zero (dNTPs chelate all free Mg²⁺).
 */

/** von Ahsen sodium-equivalent concentration, in mM. */
export function sodiumEquivalent(
  naConc_mM: number,
  mgConc_mM: number,
  dntpsConc_mM: number,
): number {
  const freeMg = Math.max(0, mgConc_mM - dntpsConc_mM);
  return naConc_mM + 120 * Math.sqrt(freeMg);
}

/** Salt-dependent Tm adjustment in °C: `16.6·log₁₀([Na⁺]eq)`, [Na⁺] in M. */
export function saltAdjustmentCelsius(naEquivalent_mM: number): number {
  const naM = Math.max(naEquivalent_mM, 1e-9) / 1000;
  return 16.6 * Math.log10(naM);
}
