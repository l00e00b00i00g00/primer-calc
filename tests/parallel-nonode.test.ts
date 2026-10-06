import { describe, expect, it, vi } from 'vitest';

// Simulates a runtime without node:worker_threads (browser-like).
vi.mock('node:worker_threads', () => {
  throw new Error('no worker threads');
});

describe('parallel evaluation without worker_threads', () => {
  it('throws a clear runtime error', async () => {
    const { MultiplexPool } = await import('../src/MultiplexPool.js');
    const pool = new MultiplexPool([{ id: 'a', seq: 'ATGCATGCATGC' }]);
    await expect(pool.evaluateCrossDimerizationParallel()).rejects.toThrow(
      /needs node:worker_threads/,
    );
  });
});
