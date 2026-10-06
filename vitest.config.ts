import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text'],
      include: ['src/**/*.ts'],
      // Barrel, pure-type modules and the worker entry shim carry no
      // unit-testable logic (entry behavior is covered via dist/worker.js).
      exclude: [
        'src/index.ts',
        'src/types.ts',
        'src/multiplex/worker-entry.ts',
        'tests/**',
      ],
    },
  },
});
