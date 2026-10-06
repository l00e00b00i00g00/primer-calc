import { describe, expect, it, vi } from 'vitest';

// Simulates an environment without the local WASM build.
vi.mock('node:fs', async (importOriginal) => {
  const real = (await importOriginal()) as typeof import('node:fs');
  return { ...real, existsSync: () => false };
});

describe('WASM loader without a local build', () => {
  it('resolves null (TypeScript fallback contract)', async () => {
    const { loadWasmBackend } = await import('../src/backend/wasm.js');
    await expect(loadWasmBackend()).resolves.toBeNull();
  });
});
