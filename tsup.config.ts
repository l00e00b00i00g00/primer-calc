import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: ['src/index.ts'],
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: true,
    clean: true,
    target: 'es2022',
  },
  {
    entry: { cli: 'src/cli/main.tsx' },
    format: ['esm'],
    dts: false,
    sourcemap: false,
    target: 'es2022',
    outDir: 'dist',
  },
]);
