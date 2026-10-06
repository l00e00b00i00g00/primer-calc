import { OWCZARZY_2008, ZERO_C_KELVIN } from '../constants.js';

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

/**
 * Free Mg²⁺ (M) after dNTP chelation, via the Mg:dNTP dissociation
 * equilibrium (Owczarzy et al. 2008, Ka = 3·10⁴ M⁻¹). Without dNTPs the
 * total is returned unchanged.
 */
export function freeMagnesium(mgConc_mM: number, dntpsConc_mM: number): number {
  const mg = Math.max(0, mgConc_mM) * 1e-3;
  if (!(dntpsConc_mM > 0)) return mg;
  const dntps = dntpsConc_mM * 1e-3;
  const ka = OWCZARZY_2008.KA;
  return (
    (-(ka * dntps - ka * mg + 1) +
      Math.sqrt((ka * dntps - ka * mg + 1) ** 2 + 4 * ka * mg)) /
    (2 * ka)
  );
}

/** Owczarzy et al. (2004) monovalent 1/Tm correction (1/K). */
function owczarzyMonoCorr(monM: number, gcFrac: number): number {
  return (
    (4.29 * gcFrac - 3.95) * 1e-5 * Math.log(monM) +
    9.4e-6 * Math.log(monM) ** 2
  );
}

/**
 * Salt-corrected melting temperature (°C) after Owczarzy et al. (2008).
 *
 * Decision tree on R = √[Mg²⁺]/[Na⁺] (molar): R < 0.22 falls back to the
 * 2004 monovalent formula; R < 6 recalibrates (a, d, g); concentrated
 * divalent uses the base constants. Applied as Tm = 1/(1/Tm(1M) + corr)
 * with Tm in Kelvin. `gcFrac` is the duplex GC fraction (0–1).
 */
export function owczarzySaltTm(
  tm1M_C: number,
  naConc_mM: number,
  mgConc_mM: number,
  dntpsConc_mM: number,
  gcFrac: number,
  length: number,
): number {
  if (!(length >= 2)) {
    throw new RangeError('Owczarzy correction needs length ≥ 2.');
  }
  const tmK = tm1M_C + ZERO_C_KELVIN;
  const mon_mM = Math.max(0, naConc_mM);
  const mg = freeMagnesium(mgConc_mM, dntpsConc_mM);
  const mon = mon_mM * 1e-3;
  if (mon > 0) {
    const r = Math.sqrt(mg) / mon;
    if (r < 0.22) {
      return 1 / (1 / tmK + owczarzyMonoCorr(mon, gcFrac)) - ZERO_C_KELVIN;
    }
    let { a, b, c, d, e, f, g } = OWCZARZY_2008;
    if (r < 6.0) {
      a = 3.92 * (0.843 - 0.352 * Math.sqrt(mon) * Math.log(mon));
      d =
        1.42 *
        (1.279 - 4.03e-3 * Math.log(mon) - 8.03e-3 * Math.log(mon) ** 2);
      g =
        8.31 *
        (0.486 - 0.258 * Math.log(mon) + 5.25e-3 * Math.log(mon) ** 3);
    }
    const corr =
      (a +
        b * Math.log(mg) +
        gcFrac * (c + d * Math.log(mg)) +
        (1 / (2 * (length - 1))) *
          (e + f * Math.log(mg) + g * Math.log(mg) ** 2)) *
      1e-5;
    return 1 / (1 / tmK + corr) - ZERO_C_KELVIN;
  }
  if (!(mg > 0)) {
    throw new RangeError(
      'Owczarzy salt correction requires some salt (Na⁺ and Mg²⁺ are both zero).',
    );
  }
  const { a, b, c, d, e, f, g } = OWCZARZY_2008;
  const corr =
    (a +
      b * Math.log(mg) +
      gcFrac * (c + d * Math.log(mg)) +
      (1 / (2 * (length - 1))) *
        (e + f * Math.log(mg) + g * Math.log(mg) ** 2)) *
    1e-5;
  return 1 / (1 / tmK + corr) - ZERO_C_KELVIN;
}
