# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
