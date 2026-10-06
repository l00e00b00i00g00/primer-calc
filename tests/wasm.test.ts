import { describe, expect, it } from 'vitest';
import { TypeScriptBackend } from '../src/backend/backend.js';
import {
  WasmBackend,
  loadWasmBackend,
  type WasmDimerModule,
} from '../src/backend/wasm.js';
import { MultiplexPool } from '../src/MultiplexPool.js';
import { resolveConditions } from '../src/PrimerAnalyzer.js';

const cond = resolveConditions({});

async function wasmBackend() {
  const backend = await loadWasmBackend();
  expect(backend).not.toBeNull();
  expect(backend?.name).toBe('wasm');
  return backend as WasmBackend;
}

const PAIRS: Array<[string, string, boolean]> = [
  ['AAAAAAAAAAAA', 'TTTTTTTTTTTT', false], // blunt heterodimer
  ['GCGCGCGC', 'GCGCGCGC', true], // blunt critical homodimer
  ['ATCGCGAT', 'ATCGCGAT', true], // blunt warning homodimer
  ['GCGCACGC', 'GCGCGCGC', false], // single-mismatch bridge
  ['ATCGATCGATCGATCG', 'ATCGATCGATCGATCG', true], // shifted block + dangling ends
  ['ATCGATCGATCGATCG', 'CGATCGATCGATCGAT', false], // perfect hetero duplex
  ['AAAA', 'CCCC', false], // no dimer
  ['ATATATATATATATATATAT', 'ATATATATATATATATATAT', true], // weak AT homodimer
];

describe('WASM backend loader', () => {
  it('loads the compiled Rust core', async () => {
    await wasmBackend();
  });

  it('accepts an explicit module URL', async () => {
    const url = new URL('../wasm-pkg/primer_calc_wasm.js', import.meta.url)
      .href;
    const backend = await loadWasmBackend({ url });
    expect(backend?.name).toBe('wasm');
  });

  it('skips custom URLs without the dimer surface and keeps probing', async () => {
    const empty = new URL('./fixtures/empty.mjs', import.meta.url).href;
    const backend = await loadWasmBackend({ url: empty });
    expect(backend?.name).toBe('wasm'); // local build still wins
  });

  it('survives an unloadable custom URL and keeps probing', async () => {
    const backend = await loadWasmBackend({
      url: 'file:///definitely/not/here.mjs',
    });
    expect(backend?.name).toBe('wasm'); // local build still wins
  });

  it('reports no dimer when the module throws', () => {
    const broken = new WasmBackend({
      dimer_report_json: () => {
        throw new Error('boom');
      },
    } as unknown as WasmDimerModule);
    expect(broken.homodimer('GCGCGCGC', cond)).toEqual({
      found: false,
      deltaG: null,
      tm: null,
      pairedBases: 0,
      threePrimeRun: 0,
      threePrimeAnchored: false,
    });
  });

  it('rejects invalid modules', () => {
    expect(() => new WasmBackend({} as never)).toThrow(/dimer_report_json/);
  });
});

describe('TS ↔ WASM parity (dimer engine)', () => {
  it('delegates hairpin, 3′ and Tm analysis to the light layer', async () => {
    const ts = new TypeScriptBackend();
    const wasm = await wasmBackend();
    const seq = 'ATGCGTAGCTAGCTAGCTA';
    expect(wasm.hairpin(seq, cond)).toEqual(ts.hairpin(seq, cond));
    expect(wasm.threePrime(seq)).toEqual(ts.threePrime(seq));
    expect(wasm.tm(seq, cond)).toEqual(ts.tm(seq, cond));
  });

  it('honours the salt_method:none convention through WASM', async () => {
    const ts = new TypeScriptBackend();
    const wasm = await wasmBackend();
    const nosalt = resolveConditions({ salt_method: 'none' });
    const expected = ts.homodimer('GCGCGCGC', nosalt);
    const actual = wasm.homodimer('GCGCGCGC', nosalt);
    expect(actual.deltaG).toBeCloseTo(expected.deltaG as number, 4);
    expect(actual.tm as number).toBeCloseTo(expected.tm as number, 4);
  });
  it('returns identical DimerResults on every pair class', async () => {
    const ts = new TypeScriptBackend();
    const wasm = await wasmBackend();
    for (const [a, b, self] of PAIRS) {
      const expected = self ? ts.homodimer(a, cond) : ts.heterodimer(a, b, cond);
      const actual = self ? wasm.homodimer(a, cond) : wasm.heterodimer(a, b, cond);
      expect(actual.found).toBe(expected.found);
      if (expected.deltaG === null || actual.deltaG === null) {
        expect(actual.deltaG).toBeNull();
        continue;
      }
      expect(actual.deltaG).toBeCloseTo(expected.deltaG, 4);
      expect(actual.tm as number).toBeCloseTo(expected.tm as number, 4);
      expect(actual.pairedBases).toBe(expected.pairedBases);
      expect(actual.threePrimeRun).toBe(expected.threePrimeRun);
      expect(actual.threePrimeAnchored).toBe(expected.threePrimeAnchored);
    }
  });

  it('yields identical multiplex reports through MultiplexPool', async () => {
    const primers = [
      { id: 'p1', seq: 'ATCGATCGATCGATCG' },
      { id: 'p2', seq: 'GCTAGCTAGCTAGCTA' },
      { id: 'p3', seq: 'CGATCGATCGATCGAT' },
      { id: 'p4', seq: 'AAAAAAAAAAAAAAAA' },
    ];
    const wasm = await wasmBackend();
    const fromTs = new MultiplexPool(primers).evaluateCrossDimerization();
    const fromWasm = new MultiplexPool(primers, wasm).evaluateCrossDimerization();
    expect(fromWasm).toEqual(fromTs);
    expect(fromWasm.hasCrossDimers).toBe(true);
  });
});
