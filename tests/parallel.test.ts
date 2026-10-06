import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { MultiplexPool } from '../src/MultiplexPool.js';

const distBuilt = existsSync(
  new URL('../dist/index.cjs', import.meta.url),
);

describe.runIf(distBuilt)('worker-thread multiplex evaluation', () => {
  it('matches the synchronous report exactly', async () => {
    const primers = [
      { id: 'p1', seq: 'ATCGATCGATCGATCG' },
      { id: 'p2', seq: 'GCTAGCTAGCTAGCTA' },
      { id: 'p3', seq: 'CGATCGATCGATCGAT' },
      { id: 'p4', seq: 'AAAAAAAAAAAAAAAA' },
      { id: 'p5', seq: 'TTTTTTTTTTTTTTTT' },
    ];
    const pool = new MultiplexPool(primers);
    const sync = pool.evaluateCrossDimerization();
    const parallel = await pool.evaluateCrossDimerizationParallel(
      {},
      { workers: 2 },
    );
    expect(parallel).toEqual(sync);
    expect(parallel.hasCrossDimers).toBe(true);
  });

  it('rejects on worker timeout', async () => {
    const base = 'ATGC'.repeat(30); // 120 nt
    const primers = Array.from({ length: 40 }, (_, i) => {
      const rot = i % 4;
      return { id: `q${i}`, seq: base.slice(rot) + base.slice(0, rot) };
    });
    const pool = new MultiplexPool(primers);
    await expect(
      pool.evaluateCrossDimerizationParallel({}, { timeoutMs: 1 }),
    ).rejects.toThrow(/timed out/);
  }, 60000);
});
