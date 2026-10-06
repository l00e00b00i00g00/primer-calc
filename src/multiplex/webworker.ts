import { bestDimer } from '../structure/dimer.js';
import type { DimerResult, PoolPrimer, ResolvedConditions } from '../types.js';
import { assembleCrossDimerization } from './pool.js';

/** One pair scored inside a worker: indices, sequences, self-pair flag. */
export type WorkerPair = [i: number, j: number, a: string, b: string, self: boolean];
/** Worker request payload (structured-cloneable, no functions). */
export interface WorkerRequest {
  pairs: WorkerPair[];
  cond: ResolvedConditions;
}
/** Worker response payload. */
export type WorkerResponse = Array<[number, number, DimerResult]>;

/** Minimal Web Worker surface used by the orchestrator (real or fake). */
export interface WebWorkerLike {
  postMessage(message: unknown): void;
  terminate(): void;
  onmessage: ((event: { data: unknown }) => void) | null;
  onerror: ((event: unknown) => void) | null;
}

/** Options for {@link crossDimerizationWebWorkers}. */
export interface WebWorkerOptions {
  /**
   * Worker count. Defaults to {@link DEFAULT_WEB_WORKERS}; browsers may
   * pass `navigator.hardwareConcurrency` explicitly.
   */
  workers?: number;
  /** Per-worker timeout in ms. @default 120000 */
  timeoutMs?: number;
}

/** Default worker count when `opts.workers` is omitted. */
export const DEFAULT_WEB_WORKERS = 4;

/**
 * Pure pair-scoring kernel shared by the browser worker bundle
 * (`src/multiplex/worker-entry.ts` → `dist/worker.js`) and hosts.
 */
export function handleWorkerMessage(data: WorkerRequest): WorkerResponse {
  return data.pairs.map(([i, j, a, b, self]) => [i, j, bestDimer(a, b, data.cond, self)]);
}

/**
 * Cross-dimerization distributed over Web Workers (browsers) or any
 * `WebWorkerLike` transport: pairs are chunked, each worker scores its
 * chunk with the bundled engine, and the main thread assembles the report
 * with the shared {@link assembleCrossDimerization} helper — identical to
 * the synchronous path.
 *
 * In browsers: `crossDimerizationWebWorkers(primers, cond, url, opts,
 * (u) => new Worker(u))` with `url` pointing at `dist/worker.js`.
 */
export async function crossDimerizationWebWorkers(
  primers: PoolPrimer[],
  cond: ResolvedConditions,
  workerUrl: string | URL,
  opts: WebWorkerOptions = {},
  spawn: (url: string | URL) => WebWorkerLike,
): Promise<import('../types.js').CrossDimerizationResult> {
  const n = primers.length;
  const pairs: WorkerPair[] = [];
  for (let i = 0; i < n; i++) {
    for (let j = i; j < n; j++) {
      pairs.push([i, j, (primers[i] as PoolPrimer).seq, (primers[j] as PoolPrimer).seq, i === j]);
    }
  }
  const workerCount = Math.max(1, Math.min(opts.workers ?? DEFAULT_WEB_WORKERS, pairs.length));
  const timeoutMs = opts.timeoutMs ?? 120000;
  const chunks: WorkerPair[][] = Array.from({ length: workerCount }, () => []);
  pairs.forEach((p, k) => {
    (chunks[k % workerCount] as WorkerPair[]).push(p);
  });

  const runChunk = (chunk: WorkerPair[]): Promise<WorkerResponse> =>
    new Promise((resolve, reject) => {
      const worker = spawn(workerUrl);
      const timer = setTimeout(() => {
        worker.terminate();
        reject(new Error('Multiplex web worker timed out.'));
      }, timeoutMs);
      worker.onerror = (err: unknown) => {
        clearTimeout(timer);
        worker.terminate();
        reject(err instanceof Error ? err : new Error(String(err)));
      };
      worker.onmessage = (event: { data: unknown }) => {
        clearTimeout(timer);
        worker.terminate();
        resolve(event.data as WorkerResponse);
      };
      worker.postMessage({ pairs: chunk, cond } satisfies WorkerRequest);
    });

  const settled = await Promise.all(chunks.map(runChunk));
  const pairResults = settled.flat().map(([i, j, dimer]) => ({ i, j, dimer }));
  return assembleCrossDimerization(
    primers.map((p) => p.id),
    pairResults,
  );
}
