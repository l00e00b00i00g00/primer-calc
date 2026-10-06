import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text'],
      include: ['src/**/*.ts'],
      // Barrel, pure-type modules and entry shims carry no
      // unit-testable logic (entries covered via dist/ artifacts).
      exclude: [
        'src/index.ts',
        'src/types.ts',
        'src/multiplex/worker-entry.ts',
        'src/cli/main.tsx',
        'tests/**',
      ],
      thresholds: {
        lines: 100,
        functions: 100,
        branches: 100,
        statements: 100,
      },
    },
  },
});
