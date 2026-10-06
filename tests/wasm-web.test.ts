import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  WasmBackend,
  initWasmModule,
  loadWasmBackendWeb,
} from '../src/backend/wasm.js';
import { TypeScriptBackend } from '../src/backend/backend.js';
import { resolveConditions } from '../src/PrimerAnalyzer.js';
import type { WasmDimerModule } from '../src/backend/wasm.js';

const cond = resolveConditions({});
const wasmUrl = new URL('../wasm-pkg/web/primer_calc_wasm.js', import.meta.url);
const wasmBin = new URL(
  '../wasm-pkg/web/primer_calc_wasm_bg.wasm',
  import.meta.url,
);

async function webBackend(): Promise<WasmBackend> {
  const glue = (await import(wasmUrl.href)) as unknown as {
    initSync: (bytes: Uint8Array) => unknown;
  } & WasmDimerModule;
  glue.initSync(readFileSync(wasmBin));
  return new WasmBackend(glue);
}

describe('web-target WASM binary (real module, bytes init)', () => {
  it('matches the TypeScript engine on representative pairs', async () => {
    const ts = new TypeScriptBackend();
    const wasm = await webBackend();
    const pairs: Array<[string, string, boolean]> = [
      ['AAAAAAAAAAAA', 'TTTTTTTTTTTT', false],
      ['GCGCGCGC', 'GCGCGCGC', true],
      ['GCGCACGC', 'GCGCGCGC', false], // mismatch bridge
      ['ATCGATCGATCGATCG', 'ATCGATCGATCGATCG', true], // dangling ends
      ['AAAA', 'CCCC', false], // no dimer
    ];
    for (const [a, b, self] of pairs) {
      const expected = self
        ? ts.homodimer(a, cond)
        : ts.heterodimer(a, b, cond);
      const actual = self
        ? wasm.homodimer(a, cond)
        : wasm.heterodimer(a, b, cond);
      expect(actual).toEqual(expected);
    }
  });
});

describe('initWasmModule', () => {  it('initializes modules exposing the async default initializer', async () => {
    let initialized = false;
    const stub = {
      dimer_report_json: () => '{"found":false}',
      default: async () => {
        initialized = true;
      },
    };
    const mod = await initWasmModule(stub);
    expect(initialized).toBe(true);
    expect(mod).toBe(stub);
  });

  it('accepts modules without an initializer', async () => {
    const stub = { dimer_report_json: () => '{"found":false}' };
    await expect(initWasmModule(stub)).resolves.toBe(stub);
  });

  it('rejects modules without the dimer surface', async () => {
    await expect(initWasmModule({})).rejects.toThrow(/dimer surface/);
    await expect(initWasmModule(null)).rejects.toThrow(/dimer surface/);
  });
});

describe('loadWasmBackendWeb', () => {
  it('loads and instantiates the web glue end to end', async () => {
    const glue = new URL('../wasm-pkg/web/primer_calc_wasm.js', import.meta.url)
      .href;
    const backend = await loadWasmBackendWeb(glue);
    expect(backend.name).toBe('wasm');
    const d = backend.homodimer('GCGCGCGC', cond);
    expect(d.found).toBe(true);
    expect(d.deltaG as number).toBeLessThan(-9);
  });
});
