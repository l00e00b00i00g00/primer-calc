# 🧬 `@sfstudio_tools/primer-calc`

[![npm version](https://badge.fury.io/js/@sfstudio_tools%2Fprimer-calc.svg)](https://www.npmjs.com/package/@sfstudio_tools/primer-calc)
[![CI](https://github.com/l00e00b00i00g00/primer-calc/actions/workflows/ci.yml/badge.svg)](https://github.com/l00e00b00i00g00/primer-calc/actions/workflows/ci.yml)
[![license](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![node](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](package.json)

> **Dokumentationssprachen:** [English](README.md) · [Français](README.fr.md) · [Español](README.es.md) · [中文](README.zh.md) · [العربية](README.ar.md) · [Русский](README.ru.md) · [Português](README.pt.md) · [Deutsch](README.de.md)

Die referenzielle Open-Source-Bibliothek (Lizenz **Apache 2.0**) für Analyse,
Optimierung und Thermodynamik von Primern und Oligonukleotid-Sonden.

## 📥 Installation

```bash
npm install @sfstudio_tools/primer-calc
# oder: yarn add @sfstudio_tools/primer-calc
#       pnpm add @sfstudio_tools/primer-calc
#       bun add @sfstudio_tools/primer-calc
```

Erfolgsprüfung: Das Paket erscheint in den `dependencies` Ihrer `package.json`.

## 🖥️ Terminal-UI

```bash
npx @sfstudio_tools/primer-calc                  # interaktives TUI
npx @sfstudio_tools/primer-calc ATGCGTAGCTAGCTA  # Schnellanalyse
npx @sfstudio_tools/primer-calc ATGC... --json   # JSON-Ausgabe
LANG=de_DE.UTF-8 npx @sfstudio_tools/primer-calc # erzwungene Sprache
primer-calc --lang es --help
```

Das TUI (Ink) bietet die Tabs **Analysieren / Multiplex / Hilfe** mit der
vollen Engine — ganz ohne Biochemie: Sequenz tippen, Enter. Tasten: `Tab`
Reiter, `↑↓←→` navigieren, `Enter` bestätigen, `Strg+Q` beenden, `Strg+L` Sprache.

## 🚀 Schnelleinstieg in TypeScript

```typescript
import { analyzePrimer, calculateTm } from '@sfstudio_tools/primer-calc';

// 1. Schmelztemperatur (Tm)
const tm = calculateTm('ATGCGTAGCTAGCTAGCTA');
console.log(`Schmelztemperatur: ${tm} °C`);

// 2. Vollanalyse (Sekundärstrukturen, GC% usw.)
const analysis = analyzePrimer('ATGCGTAGCTAGCTAGCTA');
console.log('Analysebericht:', analysis);
```

Ausführen mit `tsx` / `ts-node`: Das Terminal zeigt Schmelztemperatur und
Analyseobjekt ohne TypeScript-Fehler. Siehe `examples/quickstart.ts`
(`npm run example`).

## 💻 Erweiterte TypeScript-API

```typescript
import { PrimerAnalyzer, MultiplexPool } from '@sfstudio_tools/primer-calc';

const analyzer = new PrimerAnalyzer({
  na_conc: 50, // mM
  mg_conc: 2.5, // mM (von-Ahsen-Korrektur)
  dNTPs_conc: 0.8, // mM (Summe der 4 dNTPs)
  primer_conc: 200, // nM
  temp_unit: 'C',
});

const result = analyzer.evaluate('ATGCGTAGCTAGCTAGCTA');
console.log(`Tm (SantaLucia): ${result.tm.toFixed(2)} °C`);
console.log(`GC Content: ${result.gcContent.toFixed(1)}%`);
console.log(`Free Energy Hairpin: ${result.hairpin.deltaG?.toFixed(2) ?? 'n/a'} kcal/mol`);
if (result.hasRisks) console.warn('Warnungen:', result.warnings);

const pool = new MultiplexPool([
  { id: 'primer_fwd_1', seq: 'ATCGATCGATCGATCG' },
  { id: 'primer_rev_1', seq: 'GCTAGCTAGCTAGCTA' },
]);
const crossCheck = pool.evaluateCrossDimerization();
if (crossCheck.hasCrossDimers) {
  console.error('Kreuzdimerisierungsrisiko:', crossCheck.conflicts);
}

// Großer Pool: Verteilung auf Worker-Threads (identische Ergebnisse)
const parallel = await pool.evaluateCrossDimerizationParallel({}, { workers: 4 });

// Primerpaar, Target, Batch, Degeneriertheit
const pair = analyzePrimerPair('ATGCGTAGCTAGCTAGCTA', 'GCTAGCTAGCTAGCTA');
const target = analyzer.evaluateAgainstTarget('ATGCGTAGCTAG', 'CTAGCTACGCAT');
const batch = analyzeBatch(['ATGCGTAGCTAGCTAGCTA', { id: 'gc8', seq: 'GCGCGCGC' }]);
const tmMin = calculateTm('ATGCATGCATRY', {}, 'min'); // mean|min|consensus
```

## 🌍 Internationalisierung

TUI und CLI erkennen Ihre Sprache unsichtbar, in drei Schritten:

1. **Systemspracherkennung** — beim Start fragt das Programm das OS:
   `LC_ALL`, dann `LC_MESSAGES`, dann `LANG` (z. B. `de_DE.UTF-8`), mit
   Rückfall auf `Intl`-Regionaleinstellungen (deckt Windows ab), dann Englisch.
2. **Übersetzungswörterbücher** — eine typisierte Tabelle pro Sprache
   (`src/i18n/locales/`); fehlende Schlüssel scheitern zur Compilezeit,
   niemals still.
3. **Framework-Anbindung** — Ink-Screens rendern via `translate()`; jeder
   Analyse-Warncode wird auf ein lokalisiertes Template mit Werten abgebildet.

Unterstützt: English, Français, Español, 中文, العربية, Русский, Português,
Deutsch. Override: Flag `--lang <code>` oder `Strg+L` im TUI.
Programmatisch: `detectLocale()`, `resolveLocale()`, `translate()`,
`translateWarning()` — alle exportiert. Hinweis: Arabisch ist übersetzt, aber
die meisten Terminals zeigen es links-nach-rechts (kein Bidi).

## 🧮 Wissenschaftliches Modell

- **Vereinheitlichtes SantaLucia-1998-Nearest-Neighbor** (verifiziert am
  `CGTTGA`-Referenzbeispiel: ΔH = −40.9 kcal/mol, ΔS = −114.6 cal/(mol·K),
  ΔG°37 = −5.36 kcal/mol), Initiierung, terminale A·T-Strafe, Symmetriekorrektur.
- **Dangling Ends** (Bommarito, Peyret & SantaLucia 2000, via SantaLucia
  & Hicks 2004 Tabelle 3): Jede ungepaarte Base am Duplexende trägt ihr
  gemessenes Inkrement bei — kein freies Ende wird ignoriert.
- **Tm**: `ΔH/(ΔS + R·ln(Ct/4)) − 273.15 + 16.6·log₁₀[Na⁺]eq − 0.75·DMSO%`
  für das Primer–Template-Duplex; Dimere: `R·ln(Ct)` + Symmetrie (Homodimere),
  `R·ln(Ct/2)` (Heterodimere).
- **Salze**: von-Ahsen-2001-Natriumäquivalent,
  `[Na⁺]eq = [mono] + 120·√([Mg²⁺] − [dNTP])` (mM), Mg²⁺ ≥ 0 —
  oder gemischte mono/divalente **Owczarzy-2004/2008**-Korrektur
  (`salt_method: 'owczarzy'`, Mg:dNTP-Ka-Gleichgewicht, R-Entscheidungsbaum),
  auf allen Referenzsonden näher an Primer3.
- **Mismatches**: isolierte interne (Allawi/SantaLucia/Peyret/Watkins, IMM) und
  terminale (SantaLucia & Peyret 2001, TMM); Tandems und Bulges brechen
  das Stacking (Bulge +3.0 kcal/mol).
- **Strukturen**: Hairpins (perfekte Stems + Turner-Loop-Strafen,
  Jacobson–Stockmayer-Extrapolation jenseits 9 nt), Homo/Heterodimere
  (Blöcke + Brücken + thermodynamisches Smith–Waterman-DP, globales Minimum).
- **Schwellen**: ΔG < −9 kcal/mol → **kritische** Warnung (Hairpins, Dimere);
  ΔG ≤ −6 → Warnung; auch kritisch bei 3′-verankerten Dimeren mit ΔG < −7.
  3′-Ende (5-nt-Fenster): Warnung bei ΔG°37 < −5, kritisch bei ≤ −6 (Skala
  kalibriert am physikalischen Pentamer-Bereich, max ≈ −6.7).
- **Vollständiges IUPAC**: Degeneriertheitsfaktor D = ∏nᵢ, abundanzgewichtete Tm
  (O'Donnell–Maloney-Näherung, Modi `mean|min|consensus`),
  Strukturen auf kanonischer Variante evaluiert. Low-Level-Funktionen
  (`bestDimer`, `bestHairpin`, `tracebackBestAlignment`) verlangen eindeutiges
  ACGT (`AMBIGUOUS_SEQUENCE` sonst); High-Level-APIs kanonisieren automatisch.
- **3′-Bias**: Stabilität des 3′-terminalen Pentamers ΔG°37 + GC-Clamp-Report.

## ⚡ Hybride Architektur (TypeScript + WASM + Workers)

- **Standardmäßig reines TypeScript** (`TypeScriptBackend`): Node ≥ 18, Bun,
  Browser, null native Abhängigkeiten. `node:`-Imports (Worker, WASM-Loader)
  sind lazy: der Analysekern bleibt browser-bündelbar.
- **Kompilierter Rust/WASM-Kern** (`wasm/` → `wasm-pkg/`, `WasmBackend`):
  Dimer-Engine in strikter Parität mit TS (bit-exakte Paritätstests:
  `tests/wasm.test.ts`, `tests/wasm-web.test.ts`).
  - Node.js: `loadWasmBackend()` (explizite URL,
    `@sfstudio_tools/primer-calc-wasm`-Paket, dann lokaler `wasm-pkg/`-Build)
    mit automatischem TS-Fallback.
  - Browser: `wasm-pkg/web/`-Build (`--target web`, fetch-basiert) +
    `loadWasmBackendWeb(glueUrl)`; im Bundler (Vite/webpack) Glue importieren
    und nach Initialisierung `new WasmBackend(mod)` bauen.
  - Regenerierung: `npm run build:wasm` (Rust-Toolchain +
    `wasm32-unknown-unknown`-Target + `wasm-bindgen`-CLI).
- **Multi-Threading**:
  - Node: `MultiplexPool.evaluateCrossDimerizationParallel()` über
    `node:worker_threads` (`tests/parallel.test.ts`).
  - Browser: `crossDimerizationWebWorkers(primers, cond, workerUrl, opts, spawn)`
    mit `new Worker(url)` auf `dist/worker.js` (eigenständiges IIFE-Bundle,
    `npm run build:worker`), gleiche Ergebnisassembly (`tests/webworkers.test.ts`).

## 🧪 Tests & CI

```bash
npm test             # Vitest: 225 Tests (Goldstandards, Edge Cases, Spec-Konformität)
npm run test:coverage  # Build + V8-Coverage: 100 % Zeilen/Funktionen/Branches
npm run build        # tsup + Browser-Worker: ESM + CJS + .d.ts + dist/worker.js + dist/cli.js
npm run build:wasm   # Rust → wasm-pkg/ (Node.js- + Browser-Targets)
```

Validierungsdatensätze:

- SantaLucia-1998-Duplexbeispiel (`CGTTGA`: ΔH −40.9, ΔS −114.6) und
  SantaLucia-&-Hicks-2004-ΔG°37-Werte;
- Bommarito-et-al.-2000-Dangling-Ends-Tabelle;
- **Primer3-Cross-Benchmark** (`tests/primer3.test.ts` + `tests/primer3-goldens.json`,
  eingefroren via primer3-py 2.3.1): identische differentielle NN-Struktur
  (≤ 0.05 °C), absolute Tm ≤ 2.5 °C (dokumentiertes Residuum der
  1998→2004-Tabellenrevisionen bei gemischten Stacks), Homodimere
  ΔG ≤ 1.5 kcal/mol, identische Tm-Reihung unter PCR-Bedingungen.
  Regenerierung: `python3 scripts/primer3-regen.py` (Prüfung: `--check`,
  wöchentlicher CI-Job); das npm-Paket hängt nie von Python ab.
- Bit-exakte TS ≡ Node-WASM ≡ Web-WASM-Parität (`tests/wasm*.test.ts`),
  Node- und Browser-Worker (`tests/parallel*.test.ts`, `tests/webworkers.test.ts`);
- GC 0 %/100 %, sehr kurze/lange Sequenzen, komplexe IUPAC,
  astronomische Degeneriertheit (`N×100`), ungültige Bedingungen.

Continuous Integration (`.github/workflows/ci.yml`, Node 18/20/22 × Ubuntu/macOS)
reproduziert Typecheck, TS-Build, WASM-Build + **funktionale Äquivalenzprüfung
des committeten `wasm-pkg/`**, Tests + Coverage, und revalidiert die
Primer3-Goldens wöchentlich.

## 📄 Lizenz

Apache 2.0 — siehe `LICENSE`.

## 📦 Publizieren

```bash
npm login
# Erstveröffentlichung des Scopes: öffentlicher Zugriff erforderlich.
npm publish --access public            # @sfstudio_tools/primer-calc
npm publish ./wasm-pkg --access public # @sfstudio_tools/primer-calc-wasm (optional)
# Mit GitHub Actions OIDC: --provenance an beide Befehle anhängen.
```

Ohne Credentials verifiziert: `npm publish --dry-run` (23 Dateien, 163.6 kB,
`wasm/target/` ausgeschlossen, `dist/` + `wasm-pkg/` enthalten).
