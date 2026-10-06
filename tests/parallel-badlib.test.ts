import { describe, expect, it, vi } from 'vitest';

// Simulates a filesystem where every bundle path "exists": workers then
// fail requiring a non-module, exercising the worker fault handler.
vi.mock('node:fs', async (importOriginal) => {
  const real = (await importOriginal()) as typeof import('node:fs');
  return { ...real, existsSync: () => true };
});

describe('parallel evaluation with an unloadable bundle', () => {
  it('rejects with the worker error', async () => {
    const { MultiplexPool } = await import('../src/MultiplexPool.js');
    const pool = new MultiplexPool([{ id: 'a', seq: 'ATGCATGCATGC' }]);
    await expect(
      pool.evaluateCrossDimerizationParallel({}, { workers: 1 }),
    ).rejects.toThrow();
  }, 60000);
});
