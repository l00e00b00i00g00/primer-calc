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

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly cross_dimer_matrix: (a: number, b: number) => [number, number];
    readonly dimer_report_json: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number) => [number, number];
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
