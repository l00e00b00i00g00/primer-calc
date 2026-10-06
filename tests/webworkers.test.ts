import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import {
  crossDimerizationWebWorkers,
  handleWorkerMessage,
  type WebWorkerLike,
  type WorkerRequest,
} from '../src/multiplex/webworker.js';
import { crossDimerizationMatrix } from '../src/multiplex/pool.js';
import { resolveConditions } from '../src/PrimerAnalyzer.js';

const cond = resolveConditions({});
const PRIMER_URL = 'https://example.com/primer-calc-worker.js';

/** In-process WebWorkerLike: real compute kernel, controllable transport. */
class FakeWorker implements WebWorkerLike {
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  terminated = false;
  constructor(
    readonly url: string | URL,
    private readonly mode: 'ok' | 'fail' | 'silent' = 'ok',
    private readonly failWith: unknown = new Error('worker boom'),
  ) {}
  postMessage(message: unknown): void {
    if (this.mode === 'fail') {
      queueMicrotask(() => this.onerror?.(this.failWith));
      return;
    }
    if (this.mode === 'silent') return; // never answers → timeout
    const out = handleWorkerMessage(message as WorkerRequest);
    queueMicrotask(() => this.onmessage?.({ data: out }));
  }
  terminate(): void {
    this.terminated = true;
  }
}

const PRIMERS = [
  { id: 'p1', seq: 'ATCGATCGATCGATCG' },
  { id: 'p2', seq: 'GCTAGCTAGCTAGCTA' },
  { id: 'p3', seq: 'CGATCGATCGATCGAT' },
];

describe('browser worker orchestration (fake transport)', () => {
  it('matches the synchronous report exactly', async () => {
    const spawned: FakeWorker[] = [];
    const r = await crossDimerizationWebWorkers(PRIMERS, cond, PRIMER_URL, { workers: 2 }, (u) => {
      const w = new FakeWorker(u);
      spawned.push(w);
      return w;
    });
    expect(r).toEqual(crossDimerizationMatrix(PRIMERS, cond));
    expect(r.hasCrossDimers).toBe(true);
    expect(spawned.length).toBe(2);
    expect(spawned[0]?.url).toBe(PRIMER_URL);
    expect(spawned.every((w) => w.terminated)).toBe(true);
  });

  it('rejects on worker faults (Error and non-Error)', async () => {
    await expect(
      crossDimerizationWebWorkers(PRIMERS, cond, PRIMER_URL, {}, (u) => new FakeWorker(u, 'fail')),
    ).rejects.toThrow('worker boom');
    await expect(
      crossDimerizationWebWorkers(
        PRIMERS,
        cond,
        PRIMER_URL,
        {},
        (u) => new FakeWorker(u, 'fail', 'plain string failure'),
      ),
    ).rejects.toThrow('plain string failure');
  });

  it('rejects on worker timeout', async () => {
    await expect(
      crossDimerizationWebWorkers(
        PRIMERS,
        cond,
        PRIMER_URL,
        { timeoutMs: 5 },
        (u) => new FakeWorker(u, 'silent'),
      ),
    ).rejects.toThrow(/timed out/);
  });

  it('handles an empty pool without workers doing work', async () => {
    const r = await crossDimerizationWebWorkers([], cond, PRIMER_URL, {}, (u) => new FakeWorker(u));
    expect(r.hasCrossDimers).toBe(false);
    expect(r.matrix).toEqual([]);
  });
});

const distWorker = new URL('../dist/worker.js', import.meta.url);
const distBuilt =
  existsSync(distWorker) && existsSync(new URL('../dist/index.cjs', import.meta.url));

describe('worker entry wiring (src)', () => {
  it('arms onmessage only when a postMessage host exists', async () => {
    const g = globalThis as unknown as {
      onmessage?: ((event: { data: unknown }) => void) | null;
      postMessage?: (message: unknown) => void;
    };
    const posted: unknown[] = [];
    g.postMessage = (message: unknown) => {
      posted.push(message);
    };
    try {
      await import('../src/multiplex/worker-entry.js');
      expect(typeof g.onmessage).toBe('function');
      (g.onmessage as (event: { data: unknown }) => void)({
        data: { pairs: [], cond },
      });
      expect(posted).toHaveLength(1);
      expect(posted[0]).toEqual([]);
    } finally {
      delete (g as Record<string, unknown>).onmessage;
      delete (g as Record<string, unknown>).postMessage;
    }
  });
});

describe.runIf(distBuilt)('shipped dist/worker.js bundle', () => {
  it('scores pairs through the real worker entry (self shim)', async () => {
    type Handler = (event: { data: unknown }) => void;
    const g = globalThis as unknown as {
      onmessage?: Handler | null;
      postMessage?: (message: unknown) => void;
    };
    const prevOnmessage: Handler | null | undefined = g.onmessage;
    const prevPostMessage: ((message: unknown) => void) | undefined = g.postMessage;
    const posted: unknown[] = [];
    g.postMessage = (message: unknown) => {
      posted.push(message);
    };
    try {
      await import(distWorker.href);
      expect(typeof g.onmessage).toBe('function');
      const cond2 = resolveConditions({});
      (g.onmessage as Handler)({
        data: {
          pairs: [[0, 0, 'AAAAAAAAAAAA', 'AAAAAAAAAAAA', true]],
          cond: cond2,
        },
      });
      expect(posted).toHaveLength(1);
      const first = (
        posted[0] as Array<[number, number, import('../src/types.js').DimerResult]>
      )[0] as unknown as [number, number, import('../src/types.js').DimerResult | undefined];
      const [i, j, dimer] = first;
      expect(i).toBe(0);
      expect(j).toBe(0);
      expect(dimer?.found).toBe(false);
    } finally {
      if (prevOnmessage === undefined) {
        delete (g as Record<string, unknown>).onmessage;
      } else {
        g.onmessage = prevOnmessage;
      }
      if (prevPostMessage === undefined) {
        delete (g as Record<string, unknown>).postMessage;
      } else {
        g.postMessage = prevPostMessage;
      }
    }
  });
});
