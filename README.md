# 🧬 `@sfstudio_tools/primer-calc`

[![npm version](https://badge.fury.io/js/@sfstudio_tools%2Fprimer-calc.svg)](https://www.npmjs.com/package/@sfstudio_tools/primer-calc)
[![CI](https://github.com/l00e00b00i00g00/primer-calc/actions/workflows/ci.yml/badge.svg)](https://github.com/l00e00b00i00g00/primer-calc/actions/workflows/ci.yml)
[![license](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![node](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](package.json)

> **Documentation languages:** [English](README.md) · [Français](README.fr.md) · [Español](README.es.md) · [中文](README.zh.md) · [العربية](README.ar.md) · [Русский](README.ru.md) · [Português](README.pt.md) · [Deutsch](README.de.md)

The reference open-source library (licensed **Apache 2.0**) for the analysis,
optimization and thermodynamics of primer and oligonucleotide probes.

## 📥 Installation

```bash
npm install @sfstudio_tools/primer-calc
# or: yarn add @sfstudio_tools/primer-calc
#     pnpm add @sfstudio_tools/primer-calc
#     bun add @sfstudio_tools/primer-calc
```

Success check: the package appears in your `package.json` `dependencies`.

## 🖥️ Terminal UI

```bash
npx @sfstudio_tools/primer-calc                  # interactive TUI
npx @sfstudio_tools/primer-calc ATGCGTAGCTAGCTA  # quick analysis
npx @sfstudio_tools/primer-calc ATGC... --json   # JSON output
LANG=fr_FR.UTF-8 npx @sfstudio_tools/primer-calc # forced locale
primer-calc --lang es --help
```

The terminal UI (Ink) offers **Analyze / Multiplex / Help** tabs powered by
the full engine — no biochemistry background needed: type a sequence, press
Enter. Keys: `tab` switch tabs, `↑↓←→` navigate, `Enter` confirm,
`Ctrl+Q` quit, `Ctrl+L` cycle language.

## 🚀 Quick use in TypeScript

```typescript
import { analyzePrimer, calculateTm } from '@sfstudio_tools/primer-calc';

// 1. Melting temperature (Tm)
const tm = calculateTm('ATGCGTAGCTAGCTAGCTA');
console.log(`Melting temperature: ${tm} °C`);

// 2. Full analysis (secondary structures, GC%, etc.)
const analysis = analyzePrimer('ATGCGTAGCTAGCTAGCTA');
console.log('Analysis report:', analysis);
```

Run with `tsx` / `ts-node`: the terminal prints the melting temperature and
the full analysis object with no TypeScript compilation error.
See `examples/quickstart.ts` (`npm run example`).

## 💻 Advanced TypeScript API

```typescript
import { PrimerAnalyzer, MultiplexPool } from '@sfstudio_tools/primer-calc';

const analyzer = new PrimerAnalyzer({
  na_conc: 50, // mM
  mg_conc: 2.5, // mM (von Ahsen correction)
  dNTPs_conc: 0.8, // mM (total of the 4 dNTPs)
  primer_conc: 200, // nM
  temp_unit: 'C',
});

const result = analyzer.evaluate('ATGCGTAGCTAGCTAGCTA');
console.log(`Tm (SantaLucia): ${result.tm.toFixed(2)} °C`);
console.log(`GC Content: ${result.gcContent.toFixed(1)}%`);
console.log(`Free Energy Hairpin: ${result.hairpin.deltaG?.toFixed(2) ?? 'n/a'} kcal/mol`);
if (result.hasRisks) console.warn('Warnings detected:', result.warnings);

const pool = new MultiplexPool([
  { id: 'primer_fwd_1', seq: 'ATCGATCGATCGATCG' },
  { id: 'primer_rev_1', seq: 'GCTAGCTAGCTAGCTA' },
]);
const crossCheck = pool.evaluateCrossDimerization();
if (crossCheck.hasCrossDimers) {
  console.error('Cross-dimerization risk:', crossCheck.conflicts);
}

// Big pool: distributed over worker threads (identical results)
const parallel = await pool.evaluateCrossDimerizationParallel({}, { workers: 4 });

// Primer pair, target, batch, degeneracy
const pair = analyzePrimerPair('ATGCGTAGCTAGCTAGCTA', 'GCTAGCTAGCTAGCTA');
const target = analyzer.evaluateAgainstTarget('ATGCGTAGCTAG', 'CTAGCTACGCAT');
const batch = analyzeBatch(['ATGCGTAGCTAGCTAGCTA', { id: 'gc8', seq: 'GCGCGCGC' }]);
const tmMin = calculateTm('ATGCATGCATRY', {}, 'min'); // mean|min|consensus
```

## 🌍 Internationalization

The TUI and CLI detect your language invisibly, in three steps:

1. **System language detection** — at startup the program queries the OS:
   `LC_ALL`, then `LC_MESSAGES`, then `LANG` (e.g. `fr_FR.UTF-8`), falling
   back to the `Intl` regional settings (covers Windows), then English.
2. **Translation dictionaries** — one typed table per locale
   (`src/i18n/locales/`); missing keys fail compilation, never silently.
3. **Framework wiring** — Ink screens render through `translate()`; every
   analysis warning code maps to a localized template with its values.

Supported: English, Français, Español, 中文, العربية, Русский, Português,
Deutsch. Override anytime: `--lang <code>` flag or `Ctrl+L` in the TUI.
Programmatic use: `detectLocale()`, `resolveLocale()`, `translate()`,
`translateWarning()` — all exported. Note: Arabic is translated but most
terminals render it left-to-right (no bidi shaping).

## 🧮 Scientific model

- **SantaLucia 1998 unified nearest-neighbor** (verified against the `CGTTGA`
  reference: ΔH = −40.9 kcal/mol, ΔS = −114.6 cal/(mol·K), ΔG°37 = −5.36 kcal/mol),
  initiation, terminal A·T penalty, symmetry correction.
- **Dangling ends** (Bommarito, Peyret & SantaLucia 2000, via SantaLucia & Hicks
  2004 Table 3): every unpaired base next to a duplex end contributes its
  measured increment — no free end is ignored.
- **Tm**: `ΔH/(ΔS + R·ln(Ct/4)) − 273.15 + 16.6·log₁₀[Na⁺]eq − 0.75·DMSO%`
  for the primer–template duplex; dimers: `R·ln(Ct)` + symmetry (homodimers),
  `R·ln(Ct/2)` (heterodimers).
- **Salts**: von Ahsen 2001 sodium equivalent,
  `[Na⁺]eq = [mono] + 120·√([Mg²⁺] − [dNTP])` (mM), Mg²⁺ clamped at zero —
  or the mixed monovalent/divalent **Owczarzy 2004/2008** correction
  (`salt_method: 'owczarzy'`, Mg:dNTP Ka equilibrium, R-based decision tree),
  closer to Primer3 on every reference probe.
- **Mismatches**: isolated internal ones (Allawi/SantaLucia/Peyret/Watkins, IMM)
  and terminal ones (SantaLucia & Peyret 2001, TMM); tandems and bulges break
  stacking (bulge +3.0 kcal/mol).
- **Structures**: hairpins (perfect stems + Turner loop penalties,
  Jacobson–Stockmayer extrapolation beyond 9 nt), homo/hetero-dimers
  (blocks + single-mismatch bridges + Smith–Waterman thermodynamic DP,
  global minimum).
- **Thresholds**: ΔG < −9 kcal/mol → **critical** alert (hairpins, dimers);
  ΔG ≤ −6 → warning; also critical for 3′-anchored dimers with ΔG < −7.
  3′ end (5-nt window): warning if ΔG°37 < −5, critical if ≤ −6 (scale
  calibrated on a pentamer's physical range, max ≈ −6.7).
- **Full IUPAC**: degeneracy factor D = ∏nᵢ, abundance-weighted Tm
  (O'Donnell–Maloney approximation, `mean|min|consensus` modes), structures
  evaluated on the canonical variant. Low-level structure functions require
  unambiguous ACGT (`AMBIGUOUS_SEQUENCE` otherwise); high-level APIs
  canonicalize for you.
- **3′ bias**: 3′-terminal pentamer ΔG°37 stability + GC-clamp report.

## ⚡ Hybrid architecture (TypeScript + WASM + workers)

- **Pure TypeScript by default** (`TypeScriptBackend`): Node ≥ 18, Bun,
  browsers, zero native dependencies. `node:` imports (workers, WASM loader)
  are lazy: the analysis core stays bundlable for browsers.
- **Compiled Rust/WASM core** (`wasm/` → `wasm-pkg/`, `WasmBackend`): dimer
  engine in strict parity with TS (bit-exact parity tests:
  `tests/wasm.test.ts`, `tests/wasm-web.test.ts`).
  - Node.js: `loadWasmBackend()` (explicit URL, `@sfstudio_tools/primer-calc-wasm`
    package, then local `wasm-pkg/` build) with automatic TS fallback.
  - Browsers: `wasm-pkg/web/` build (`--target web`, fetch-based) +
    `loadWasmBackendWeb(glueUrl)`; with a bundler (Vite/webpack), import the
    glue and construct `new WasmBackend(mod)` after initialization.
  - Regenerate: `npm run build:wasm` (Rust toolchain +
    `wasm32-unknown-unknown` target + `wasm-bindgen` CLI).
- **Multi-threading**:
  - Node: `MultiplexPool.evaluateCrossDimerizationParallel()` over
    `node:worker_threads` (`tests/parallel.test.ts`).
  - Browsers: `crossDimerizationWebWorkers(primers, cond, workerUrl, opts, spawn)`
    with `new Worker(url)` on `dist/worker.js` (self-contained IIFE bundle,
    `npm run build:worker`), same result assembly (`tests/webworkers.test.ts`).

## 🧪 Tests & CI

```bash
npm test             # Vitest: 225 tests (gold standards, edge cases, spec conformance)
npm run test:coverage  # build + V8 coverage: 100% lines/functions/branches
npm run build        # tsup + browser worker: ESM + CJS + .d.ts + dist/worker.js + dist/cli.js
npm run build:wasm   # Rust → wasm-pkg/ (Node.js + browser targets)
```

Validation datasets:

- SantaLucia 1998 duplex example (`CGTTGA`: ΔH −40.9, ΔS −114.6) and
  SantaLucia & Hicks 2004 ΔG°37 values;
- Bommarito et al. 2000 dangling-end table;
- **Primer3 cross-benchmark** (`tests/primer3.test.ts` + `tests/primer3-goldens.json`,
  frozen via primer3-py 2.3.1): identical NN differential structure (≤ 0.05 °C),
  absolute Tm ≤ 2.5 °C (documented residue of the 1998→2004 table revisions
  on mixed stacks), homodimer ΔG ≤ 1.5 kcal/mol, identical Tm ranking under
  PCR conditions. Regenerate: `python3 scripts/primer3-regen.py` (check with
  `--check`, weekly CI job); the npm package never depends on Python.
- bit-exact TS ≡ Node-WASM ≡ web-WASM parity (`tests/wasm*.test.ts`),
  Node and browser workers (`tests/parallel*.test.ts`, `tests/webworkers.test.ts`);
- 0%/100% GC, very short/long sequences, complex IUPAC, astronomical
  degeneracy (`N×100`), invalid conditions.

Continuous integration (`.github/workflows/ci.yml`, Node 18/20/22 × Ubuntu/macOS)
reproduces typecheck, build, WASM rebuild + **functional equivalence check of
committed `wasm-pkg/`**, tests + coverage, and re-validates the Primer3
goldens weekly.

## 📄 License

Apache 2.0 — see `LICENSE`.

## 📦 Publication

```bash
npm login
# First publish under the scope: public access required.
npm publish --access public            # @sfstudio_tools/primer-calc
npm publish ./wasm-pkg --access public # @sfstudio_tools/primer-calc-wasm (optional)
# With GitHub Actions OIDC: add --provenance to both commands.
```

Verified without credentials: `npm publish --dry-run` (23 files, 163.6 kB,
`wasm/target/` excluded, `dist/` + `wasm-pkg/` included).
