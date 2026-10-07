# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## 0.3.1

### Patch Changes

- Post-0.3.0 audit fixes: POSIX gettext locale detection, warning placeholder fallback, localized display numbers, CLI end-to-end tests, Fahrenheit pair tolerance, unambiguous-input contract, completed exports.

### Fixed

- Dimer terminal extensions and flank lookup use strand-consumed spans
  instead of string lengths, fixing wrong-base selection on bulged
  alignments (TypeScript + Rust).
- Structure engines (`bestDimer`, `bestHairpin`, `tracebackBestAlignment`)
  reject degenerate IUPAC input with `AMBIGUOUS_SEQUENCE` instead of
  crashing on NN lookups; pool/worker paths canonicalize first.
- `evaluateAgainstTarget` converts dimer Tm to the configured unit.
- Rust core clippy-clean (type aliases, no dead fields).
- `analyzePrimerPair` scales the Tm-gap tolerance to Fahrenheit output.
- Completed the public export surface (threshold constants, `DuplexThermo`,
  `assertUnambiguous`, `toUnit`, `assembleCrossDimerization`, …).
- Locale detection treats empty variables as unset (POSIX gettext) and lets
  an explicit terminal setting win; warning templates never leak raw
  `{placeholders}` (fallback to English); all user-facing numbers render
  with locale decimal separators (Latin digits forced).

## 0.3.0

### Minor Changes

- Terminal UI (`primer-calc` bin, Ink): Analyze/Multiplex/Help tabs on the
  full engine, quick `primer-calc [seq] [--json]` analysis mode, `--lang`
  override. `dist/cli.js` shipped, `bin/primer-calc.js` entry point.
- Internationalization: system locale detection (`LC_ALL`→`LC_MESSAGES`→
  `LANG`, `Intl` fallback for Windows), 8 typed dictionaries
  (en/fr/es/zh/ar/ru/pt/de, missing keys fail compilation), `Ctrl+L`
  cycling, localized warning templates. New exports: `detectLocale`,
  `resolveLocale`, `translate`, `translateWarning`, `translateSeverity`,
  `LOCALES`, `LOCALE_CODES` (+ `Locale`, `Messages` types).
- Documentation in 8 languages (`README.md` English primary + `.fr/.es/.zh/
.ar/.ru/.pt/.de.md`) with a language switcher.

## 0.2.2 - 2026-10-06

### Fixed

- Dimer terminal extensions and flank lookup use strand-consumed spans
  instead of string lengths, fixing wrong-base selection on bulged
  alignments (TypeScript + Rust).
- Structure engines (`bestDimer`, `bestHairpin`, `tracebackBestAlignment`)
  reject degenerate IUPAC input with `AMBIGUOUS_SEQUENCE` instead of
  crashing on NN lookups; pool/worker paths canonicalize first.
- `evaluateAgainstTarget` converts dimer Tm to the configured unit.
- Rust core clippy-clean (type aliases, no dead fields).
- `analyzePrimerPair` scales the Tm-gap tolerance to Fahrenheit output.
- Completed the public export surface (threshold constants, `DuplexThermo`,
  `assertUnambiguous`, `toUnit`, `assembleCrossDimerization`, …).
- Removed the bench `--check` CI gate: absolute timings are
  hardware-dependent (CI runners ~7× slower); kept as a local tool.

## 0.2.1

### Fixed

- Republished with a fresh `dist/` build: 0.2.0 accidentally shipped stale
  bundles missing `analyzePrimerPair`, `evaluateAgainstTarget`,
  `analyzeBatch` and degeneracy modes (caught by registry install check).
  Added a `prepublishOnly` guard (`npm run build && npm run build:wasm`)
  so manual publishes always rebuild first.

## 0.2.0

### Minor Changes

- [`71202ae`](https://github.com/l00e00b00i00g00/primer-calc/commit/71202aec3f5bb490695724f0b581d952092f8f3f) - Thermodynamics: Owczarzy salt correction, internal/terminal mismatch parameters (IMM/TMM), DP local alignment, primer-vs-target analysis. APIs: primer pairs, degeneracy weighting modes, batch analysis. WASM reports carry dh/ds/gc/n.

## [0.1.0] - 2026-10-06

### Added

- SantaLucia (1998) unified nearest-neighbor engine: duplex thermodynamics,
  initiation, terminal A·T penalties, symmetry correction, validated against
  the `CGTTGA` worked example (ΔH −40.9, ΔS −114.6) and SantaLucia & Hicks
  (2004) ΔG°37 values.
- Single-nucleotide dangling ends (Bommarito, Peyret & SantaLucia 2000) for
  dimer alignments and hairpin open ends.
- Turner hairpin loops with Jacobson–Stockmayer extrapolation beyond 9 nt.
- Von Ahsen (2001) salt correction (`[Na⁺]eq`, Mg²⁺/dNTP chelation clamp)
  plus DMSO term; validated `Tm` formula with `Ct/4` convention.
- Secondary structures: stem–loop scan, ungapped + single-mismatch-bridged
  dimer scan, polymerase-extendable 3′ anchoring (overhang-aware runs).
- Full IUPAC support: degeneracy factor, O'Donnell–Maloney weighted Tm,
  canonical-variant structure scans.
- 3′-pentamer stability report with GC clamp and two-tier scale.
- `PrimerAnalyzer`, `MultiplexPool` (N×N matrix, severity-graded conflicts),
  `analyzePrimer`, `calculateTm`.
- Hybrid compute: pure-TypeScript backend by default; compiled Rust/WASM
  core (`wasm/`, `WasmBackend`, bit-exact parity) for Node.js and browsers;
  `node:worker_threads` and Web Worker multiplex paths.
- Frozen Primer3 cross-validation goldens (`tests/primer3-goldens.json`,
  regenerable via `scripts/primer3-regen.py`).
- 138 Vitest tests, 100% line/function/branch coverage gate, ESLint,
  Prettier, `publint` + `attw` package checks, GitHub CI.

[0.1.0]: https://github.com/l00e00b00i00g00/primer-calc/releases/tag/v0.1.0
