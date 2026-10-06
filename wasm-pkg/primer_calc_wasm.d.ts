/* tslint:disable */
/* eslint-disable */

/**
 * N×N cross-dimerization ΔG°37 matrix (row-major, `NaN` = no dimer).
 * `seqs` are `|`-separated unambiguous primer sequences.
 */
export function cross_dimer_matrix(seqs: string): Float64Array;

/**
 * Full dimer report as JSON:
 * `{"found":bool,"dg":…,"tm":…,"paired":…,"run3p":…,"anchored":bool}`.
 * Temperatures in °C; `ct_m` = total strand concentration (M);
 * `salt_adj_c` = precomputed salt term (°C).
 */
export function dimer_report_json(a: string, b: string, self_complementary: boolean, eval_temp_c: number, ct_m: number, salt_adj_c: number, dmso_percent: number): string;
