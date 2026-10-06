import type { Worker } from 'node:worker_threads';
import type {
  CrossDimerizationResult,
  DimerResult,
  PoolPrimer,
  ResolvedConditions,
} from '../types.js';
import { assembleCrossDimerization } from './pool.js';

/** Options for {@link crossDimerizationParallel}. */
export interface ParallelOptions {
  /** Worker count (defaults to CPU count, capped by pair count). */
  workers?: number;
  /** Per-worker timeout in ms. @default 120000 */
  timeoutMs?: number;
}

/**
 * Cross-dimerization evaluated on `node:worker_threads` (spec §1).
 *
 * Pairs are chunked across workers running the compiled `dist` bundle
 * (TypeScript engine); the main thread assembles the report with the shared
 * {@link assembleCrossDimerization} helper, so results are identical to the
 * synchronous path. Requires `npm run build` first — throws otherwise.
 */
export async function crossDimerizationParallel(
  primers: PoolPrimer[],
  cond: ResolvedConditions,
  opts: ParallelOptions = {},
): Promise<CrossDimerizationResult> {
  // Node-only APIs are imported lazily so browser bundlers never see them;
  // the pure-TS core stays dependency-free and universal.
  let node: {
    Worker: typeof Worker;
    cpus: () => Array<{ model: string }>;
    existsSync: (p: string | URL) => boolean;
  };
  try {
    const [wt, os, fs] = await Promise.all([
      import('node:worker_threads'),
      import('node:os'),
      import('node:fs'),
    ]);
    node = { Worker: wt.Worker, cpus: os.cpus, existsSync: fs.existsSync };
  } catch {
    throw new Error(
      'Parallel evaluation needs node:worker_threads — ' +
        'use evaluateCrossDimerization() on runtimes without it.',
    );
  }
  // Bundle resolution across layouts (checked in order):
  // - production bundle: dist/index.js → ./index.cjs
  // - repo tests: src/multiplex/parallel.ts → <repo>/dist/index.cjs
  const candidates = ['./index.cjs', '../index.cjs', '../../dist/index.cjs'];
  let libPath: string | null = null;
  for (const rel of candidates) {
    const url = new URL(rel, import.meta.url);
    if (url.protocol === 'file:' && node.existsSync(url)) {
      libPath = url.pathname;
      break;
    }
  }
  if (libPath === null) {
    throw new Error('Parallel evaluation requires the built bundle (run `npm run build`).');
  }
  const n = primers.length;
  const pairs: Array<[number, number, string, string, boolean]> = [];
  for (let i = 0; i < n; i++) {
    for (let j = i; j < n; j++) {
      pairs.push([i, j, (primers[i] as PoolPrimer).seq, (primers[j] as PoolPrimer).seq, i === j]);
    }
  }
  const workerCount = Math.max(1, Math.min(opts.workers ?? node.cpus().length, pairs.length));
  const timeoutMs = opts.timeoutMs ?? 120000;
  const chunks: (typeof pairs)[] = Array.from({ length: workerCount }, () => []);
  pairs.forEach((p, k) => {
    (chunks[k % workerCount] as typeof pairs).push(p);
  });

  const code = `
    const { parentPort, workerData } = require('node:worker_threads');
    const lib = require(workerData.lib);
    const out = workerData.chunk.map(([i, j, a, b, self]) =>
      [i, j, lib.bestDimer(lib.canonicalVariant(a), lib.canonicalVariant(b), workerData.cond, self)],
    );
    parentPort.postMessage(out);
  `;
  const runChunk = (chunk: typeof pairs): Promise<Array<[number, number, DimerResult]>> =>
    new Promise((resolve, reject) => {
      // A synchronous throw in the executor rejects the promise.
      const worker: Worker = new node.Worker(code, {
        eval: true,
        workerData: { lib: libPath, cond, chunk },
      });
      const timer = setTimeout(() => {
        void worker.terminate();
        reject(new Error('Multiplex worker timed out.'));
      }, timeoutMs);
      worker.once('message', (out: Array<[number, number, DimerResult]>) => {
        clearTimeout(timer);
        void worker.terminate();
        resolve(out);
      });
      worker.once('error', (err: unknown) => {
        clearTimeout(timer);
        void worker.terminate();
        reject(err);
      });
    });

  const settled = await Promise.all(chunks.map(runChunk));
  const pairResults = settled.flat().map(([i, j, dimer]) => ({ i, j, dimer }));
  return assembleCrossDimerization(
    primers.map((p) => p.id),
    pairResults,
  );
}
