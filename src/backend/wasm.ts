import type {
  DimerResult,
  HairpinResult,
  ResolvedConditions,
  ThreePrimeResult,
} from '../types.js';
import {
  TypeScriptBackend,
  type ComputeBackend,
} from './backend.js';
import { canonicalVariant } from '../sequence/degenerate.js';
import { sodiumEquivalent, saltAdjustmentCelsius } from '../thermo/salt.js';
import { primerConcToMolar } from '../thermo/tm.js';

/**
 * Minimal surface of the compiled `@synthflow/primer-calc-wasm` module
 * (see `wasm/` + `wasm-pkg/`). Structural typing keeps this working with the
 * published package, the in-repo build, or any compatible engine.
 */
export interface WasmDimerModule {
  dimer_report_json(
    a: string,
    b: string,
    self_complementary: boolean,
    eval_temp_c: number,
    ct_m: number,
    salt_adj_c: number,
    dmso_percent: number,
  ): string;
  cross_dimer_matrix?(seqs: string): ArrayLike<number>;
}

/**
 * Minimal surface of the web (`--target web`) glue module.
 * `default` is the async initializer (fetches the sibling `.wasm`);
 * `initSync` instantiates from bytes (handy outside browsers).
 */
export interface WasmWebModule extends WasmDimerModule {
  default?: (input?: unknown) => Promise<unknown>;
}

/**
 * Runs the web-glue initializer when present and returns the usable module.
 * Accepts the raw glue namespace (post-`import()`) or any structural
 * equivalent (stubs in tests, bundler-managed modules).
 *
 * @throws when the module lacks the dimer surface.
 */
export async function initWasmModule(
  mod: unknown,
): Promise<WasmDimerModule> {
  const candidate = mod as WasmWebModule | null;
  if (!candidate || typeof candidate.dimer_report_json !== 'function') {
    throw new Error('Not a primer-calc WASM module (missing dimer surface).');
  }
  if (typeof candidate.default === 'function') {
    await candidate.default();
  }
  return candidate;
}

/**
 * Loads a browser (`--target web`) glue module from an explicit URL and
 * instantiates it (the default initializer fetches the sibling `.wasm`
 * over http(s)). For bytes-driven or bundler-managed setups, import the
 * glue yourself, run its initializer, then `new WasmBackend(mod)`.
 */
export async function loadWasmBackendWeb(
  glueUrl: string,
): Promise<ComputeBackend> {
  return new WasmBackend(await initWasmModule(await import(glueUrl)));
}

interface WasmDimerReport {
  found: boolean;
  dg?: number;
  tm?: number;
  paired?: number;
  run3p?: number;
  anchored?: boolean;
}

/**
 * High-performance WASM compute backend (spec §1).
 *
 * Dimer thermodynamics run in the compiled Rust core; sequence handling
 * (IUPAC canonicalisation), hairpins, 3′ analysis and Tm stay on the
 * TypeScript light layer. Bit-level parity with {@link TypeScriptBackend}
 * is enforced by `tests/wasm.test.ts`.
 */
export class WasmBackend implements ComputeBackend {
  readonly name = 'wasm' as const;
  private readonly light = new TypeScriptBackend();

  constructor(private readonly wasm: WasmDimerModule) {
    if (!wasm || typeof wasm.dimer_report_json !== 'function') {
      throw new Error(
        'WasmBackend requires a module exposing dimer_report_json().',
      );
    }
  }

  hairpin(seq: string, cond: ResolvedConditions): HairpinResult {
    return this.light.hairpin(seq, cond);
  }

  threePrime(seq: string): ThreePrimeResult {
    return this.light.threePrime(seq);
  }

  tm(seq: string, cond: ResolvedConditions) {
    return this.light.tm(seq, cond);
  }

  homodimer(seq: string, cond: ResolvedConditions): DimerResult {
    const canon = canonicalVariant(seq);
    return this.dimer(canon, canon, cond, true);
  }

  heterodimer(a: string, b: string, cond: ResolvedConditions): DimerResult {
    return this.dimer(canonicalVariant(a), canonicalVariant(b), cond, false);
  }

  private dimer(
    a: string,
    b: string,
    cond: ResolvedConditions,
    selfComplementary: boolean,
  ): DimerResult {
    const none: DimerResult = {
      found: false,
      deltaG: null,
      tm: null,
      pairedBases: 0,
      threePrimeRun: 0,
      threePrimeAnchored: false,
    };
    const ctM = primerConcToMolar(cond.primer_conc);
    const saltAdj =
      cond.salt_method === 'vonAhsen'
        ? saltAdjustmentCelsius(
            sodiumEquivalent(cond.na_conc, cond.mg_conc, cond.dNTPs_conc),
          )
        : 0;
    let report: WasmDimerReport;
    try {
      report = JSON.parse(
        this.wasm.dimer_report_json(
          a,
          b,
          selfComplementary,
          cond.eval_temp_c,
          ctM,
          saltAdj,
          cond.dmso_percent,
        ),
      ) as WasmDimerReport;
    } catch {
      return none;
    }
    if (!report.found) return none;
    return {
      found: true,
      deltaG: report.dg as number,
      tm: report.tm as number,
      pairedBases: report.paired as number,
      threePrimeRun: report.run3p as number,
      threePrimeAnchored: report.anchored === true,
    };
  }
}

/**
 * Options for {@link loadWasmBackend}.
 */
export interface WasmLoadOptions {
  /**
   * Explicit module URL (bundler / browser usage), e.g.
   * `new URL('./primer_calc_wasm.js', import.meta.url).href`.
   * Tried before the automatic probes.
   */
  url?: string;
}

/**
 * Lazily loads the WASM backend, probing in order:
 * 1. `opts.url` when provided;
 * 2. the published `@synthflow/primer-calc-wasm` package (explicit install);
 * 3. the in-repo/bundled build (`wasm-pkg/`, `npm run build:wasm`).
 *
 * Resolves to `null` when nothing is available — callers fall back to
 * {@link TypeScriptBackend}. Node.js first; browsers should bundle the
 * `wasm-pkg` output and either pass `url` or construct {@link WasmBackend}
 * directly.
 */
export async function loadWasmBackend(
  opts: WasmLoadOptions = {},
): Promise<ComputeBackend | null> {
  if (opts.url) {
    try {
      const mod = (await import(opts.url)) as unknown as WasmDimerModule;
      if (mod && typeof mod.dimer_report_json === 'function') {
        return new WasmBackend(mod);
      }
    } catch {
      // Custom URL failed: continue with the automatic probes.
    }
  }
  const fromPkg = await probePublishedPackage();
  if (fromPkg && typeof fromPkg.dimer_report_json === 'function') {
    return new WasmBackend(fromPkg);
  }
  try {
    return await probeLocalBuild();
  } catch {
    // No node: runtime for the local probe (browsers use url/direct).
    return null;
  }
}

async function probeLocalBuild(): Promise<ComputeBackend | null> {
  // Node-only APIs are imported lazily so browser bundlers never see them.
  const [fs, urlMod] = await Promise.all([
    import('node:fs'),
    import('node:url'),
  ]);
  // Candidate layouts, first hit wins: flat dist bundle (dist/index.js),
  // nested modules, and sources (vitest run from src/backend/*).
  const hit = [
    '../wasm-pkg/primer_calc_wasm.js',
    '../../wasm-pkg/primer_calc_wasm.js',
  ]
    .map((rel) => new URL(rel, import.meta.url))
    .find((u) => fs.existsSync(urlMod.fileURLToPath(u)));
  if (!hit) return null;
  const mod = (await import(hit.href)) as unknown as WasmDimerModule;
  return new WasmBackend(mod);
}

async function probePublishedPackage(): Promise<WasmDimerModule | null> {
  try {
    // Non-literal specifier: the optional peer stays out of the static graph.
    const specifier: string = '@synthflow/primer-calc-wasm';
    return (await import(specifier)) as unknown as WasmDimerModule;
  } catch {
    // Optional package absent.
    return null;
  }
}
