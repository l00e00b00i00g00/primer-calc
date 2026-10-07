# Contributing

## Setup

Requirements: Node.js ≥ 18. Rust toolchain optional (WASM core only).

```bash
npm ci
npm run build        # TypeScript → dist/ (+ dist/worker.js)
npm test             # 225 Vitest tests
npm run test:coverage  # build + 100% coverage gate (lines/functions/branches)
```

## Scripts

| Script                  | Purpose                                       |
| ----------------------- | --------------------------------------------- |
| `npm run build`         | `tsup` (ESM+CJS+d.ts) + browser worker bundle |
| `npm run build:wasm`    | Rust → `wasm-pkg/` (Node.js + web targets)    |
| `npm run typecheck`     | `tsc --noEmit` (strict)                       |
| `npm run lint`          | ESLint                                        |
| `npm run format`        | Prettier write; CI enforces `format:check`    |
| `npm test`              | Vitest                                        |
| `npm run test:coverage` | Build + coverage with 100% thresholds         |
| `npm run example`       | `examples/quickstart.ts` via `tsx`            |

Every PR must keep `lint`, `format:check`, `typecheck`, tests and the
coverage gate green. PRs changing the package should include a changeset
(`npx changeset add`); CI reports changeset status advisory-only.

## Conventions

- Thermodynamic constants cite their source (paper + table); new parameters
  require a literature reference and a golden test.
- `src/` stays free of `node:` imports except lazy dynamic imports in
  `src/multiplex/parallel.ts` and `src/backend/wasm.ts` (browser bundling).
- `wasm/`: any scoring change must preserve bit-exact TS≡WASM parity
  (`tests/wasm.test.ts`, `tests/wasm-web.test.ts`); rebuild + commit
  `wasm-pkg/` (`npm run build:wasm`). CI verifies functional equivalence
  between the committed build and a fresh build
  (`scripts/check-wasm-equivalence.mjs`) rather than byte equality, which
  varies across wasm-bindgen distributions.
- Primer3 goldens: regenerate with `python3 scripts/primer3-regen.py`
  (needs `primer3-py`); `--check` must pass.

## Releases

1. `npx changeset version` consumes pending changesets (bumps versions,
   prepends `CHANGELOG.md` entries); review and finalize `CHANGELOG.md`.
2. `git tag vX.Y.Z && git push origin vX.Y.Z`.
3. `gh release create vX.Y.Z --notes-file <notes>`.
4. Publish via the `publish` CI workflow (trusted publishing + provenance);
   manual fallback: `npm login` then `npm publish` (+ `./wasm-pkg` first
   for `@sfstudio_tools/primer-calc-wasm`).
