import { describe, expect, it, vi } from 'vitest';

// Simulates an environment without the dist bundle.
vi.mock('node:fs', async (importOriginal) => {
  const real = (await importOriginal()) as typeof import('node:fs');
  return { ...real, existsSync: () => false };
});

describe('parallel evaluation without a bundle', () => {
  it('throws a clear build-first error', async () => {
    const { MultiplexPool } = await import('../src/MultiplexPool.js');
    const pool = new MultiplexPool([{ id: 'a', seq: 'ATGCATGCATGC' }]);
    await expect(pool.evaluateCrossDimerizationParallel()).rejects.toThrow(
      /built bundle/,
    );
  });
});
