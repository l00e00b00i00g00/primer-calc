/**
 * Browser Web Worker entry (`dist/worker.js` via `npm run build:worker`).
 *
 * Environment-agnostic: importing this module only arms `onmessage` when a
 * `postMessage` host exists, so it stays inert under Node.js. Pairs are
 * scored with the same bundled engine as the main thread.
 */
import {
  handleWorkerMessage,
  type WorkerRequest,
} from './webworker.js';

const scope = globalThis as unknown as {
  onmessage?: ((event: { data: WorkerRequest }) => void) | null;
  postMessage?: (message: unknown) => void;
};

if (typeof scope.postMessage === 'function') {
  scope.onmessage = (event: { data: WorkerRequest }) => {
    scope.postMessage?.(handleWorkerMessage(event.data));
  };
}
