import { describe, expect, it, vi } from 'vitest';

// Simulates a runtime without node: builtins (browser-like).
vi.mock('node:fs', () => {
  throw new Error('no node runtime');
});

describe('WASM loader without node: builtins', () => {
  it('resolves null instead of rejecting', async () => {
    const { loadWasmBackend } = await import('../src/backend/wasm.js');
    await expect(loadWasmBackend()).resolves.toBeNull();
  });
});
