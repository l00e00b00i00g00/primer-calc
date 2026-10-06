import { describe, expect, it, vi } from 'vitest';
import { resolveConditions } from '../src/PrimerAnalyzer.js';

// Simulates an explicitly installed @sfstudio_tools/primer-calc-wasm package.
vi.mock('@sfstudio_tools/primer-calc-wasm', () => ({
  dimer_report_json: () =>
    JSON.stringify({
      found: true,
      dg: -8.84407,
      tm: 21.412785,
      paired: 12,
      run3p: 12,
      anchored: true,
    }),
}));

describe('WASM loader with a published package installed', () => {
  it('prefers the published module over the local build', async () => {
    const { loadWasmBackend } = await import('../src/backend/wasm.js');
    const backend = await loadWasmBackend();
    expect(backend?.name).toBe('wasm');
    const d = backend!.homodimer('AAAAAAAAAAAA', resolveConditions({}));
    expect(d.found).toBe(true);
    expect(d.deltaG).toBeCloseTo(-8.84407, 5);
  });
});
