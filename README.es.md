# 🧬 `@sfstudio_tools/primer-calc`

[![npm version](https://badge.fury.io/js/@sfstudio_tools%2Fprimer-calc.svg)](https://www.npmjs.com/package/@sfstudio_tools/primer-calc)
[![CI](https://github.com/l00e00b00i00g00/primer-calc/actions/workflows/ci.yml/badge.svg)](https://github.com/l00e00b00i00g00/primer-calc/actions/workflows/ci.yml)
[![license](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![node](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](package.json)

> **Idiomas de la documentación:** [English](README.md) · [Français](README.fr.md) · [Español](README.es.md) · [中文](README.zh.md) · [العربية](README.ar.md) · [Русский](README.ru.md) · [Português](README.pt.md) · [Deutsch](README.de.md)

La biblioteca open source de referencia (licencia **Apache 2.0**) para el análisis,
la optimización y la termodinámica de cebadores (_primers_) y sondas oligonucleotídicas.

## 📥 Instalación

```bash
npm install @sfstudio_tools/primer-calc
# o: yarn add @sfstudio_tools/primer-calc
#    pnpm add @sfstudio_tools/primer-calc
#    bun add @sfstudio_tools/primer-calc
```

Verificación: el paquete aparece en `dependencies` de su `package.json`.

## 🖥️ Interfaz de terminal

```bash
npx @sfstudio_tools/primer-calc                  # TUI interactivo
npx @sfstudio_tools/primer-calc ATGCGTAGCTAGCTA  # análisis rápido
npx @sfstudio_tools/primer-calc ATGC... --json   # salida JSON
LANG=es_ES.UTF-8 npx @sfstudio_tools/primer-calc # idioma forzado
primer-calc --lang es --help
```

El TUI (Ink) ofrece las pestañas **Analizar / Multiplex / Ayuda** con el motor
completo — sin bioquímica previa: escriba una secuencia, Enter. Teclas: `tab`
pestañas, `↑↓←→` navegar, `Enter` confirmar, `Ctrl+Q` salir, `Ctrl+L` idioma.

## 🚀 Uso rápido en TypeScript

```typescript
import { analyzePrimer, calculateTm } from '@sfstudio_tools/primer-calc';

// 1. Temperatura de fusión (Tm)
const tm = calculateTm('ATGCGTAGCTAGCTAGCTA');
console.log(`Temperatura de fusión : ${tm} °C`);

// 2. Análisis completo (estructuras secundarias, GC%, etc.)
const analysis = analyzePrimer('ATGCGTAGCTAGCTAGCTA');
console.log('Informe de análisis :', analysis);
```

Ejecute con `tsx` / `ts-node`: el terminal muestra la Tm y el objeto de análisis
sin errores de compilación TypeScript. Ver `examples/quickstart.ts`
(`npm run example`).

## 💻 API avanzada

```typescript
import { PrimerAnalyzer, MultiplexPool } from '@sfstudio_tools/primer-calc';

const analyzer = new PrimerAnalyzer({
  na_conc: 50, // mM
  mg_conc: 2.5, // mM (corrección de von Ahsen)
  dNTPs_conc: 0.8, // mM (total de los 4 dNTP)
  primer_conc: 200, // nM
  temp_unit: 'C',
});

const result = analyzer.evaluate('ATGCGTAGCTAGCTAGCTA');
console.log(`Tm (SantaLucia): ${result.tm.toFixed(2)} °C`);
console.log(`GC Content: ${result.gcContent.toFixed(1)}%`);
console.log(`Free Energy Hairpin: ${result.hairpin.deltaG?.toFixed(2) ?? 'n/a'} kcal/mol`);
if (result.hasRisks) console.warn('Avisos detectados:', result.warnings);

const pool = new MultiplexPool([
  { id: 'primer_fwd_1', seq: 'ATCGATCGATCGATCG' },
  { id: 'primer_rev_1', seq: 'GCTAGCTAGCTAGCTA' },
]);
const crossCheck = pool.evaluateCrossDimerization();
if (crossCheck.hasCrossDimers) {
  console.error('Riesgo de dimerización cruzada:', crossCheck.conflicts);
}

// Pool grande: distribución en worker threads (idénticos resultados)
const parallel = await pool.evaluateCrossDimerizationParallel({}, { workers: 4 });

// Pareja de cebadores, diana, batch, degeneración
const pair = analyzePrimerPair('ATGCGTAGCTAGCTAGCTA', 'GCTAGCTAGCTAGCTA');
const target = analyzer.evaluateAgainstTarget('ATGCGTAGCTAG', 'CTAGCTACGCAT');
const batch = analyzeBatch(['ATGCGTAGCTAGCTAGCTA', { id: 'gc8', seq: 'GCGCGCGC' }]);
const tmMin = calculateTm('ATGCATGCATRY', {}, 'min'); // mean|min|consensus
```

## 🌍 Internacionalización

El TUI y el CLI detectan su idioma de forma invisible, en tres pasos:

1. **Detección del idioma del sistema** — al arrancar, el programa consulta el
   SO: `LC_ALL`, luego `LC_MESSAGES`, luego `LANG` (ej. `es_ES.UTF-8`), con
   repliegue a la configuración regional `Intl` (cubre Windows) y al inglés.
2. **Diccionarios de traducción** — una tabla tipada por idioma
   (`src/i18n/locales/`); cualquier clave faltante falla en compilación,
   nunca en silencio.
3. **Cableado del framework** — las pantallas Ink renderizan con `translate()`;
   cada código de aviso se proyecta a una plantilla localizada con sus valores.

Soportados: English, Français, Español, 中文, العربية, Русский, Português,
Deutsch. Forzado: flag `--lang <code>` o `Ctrl+L` en el TUI.
Uso programático: `detectLocale()`, `resolveLocale()`, `translate()`,
`translateWarning()` — todos exportados. Nota: el árabe está traducido pero la
mayoría de terminales lo muestran de izquierda a derecha (sin bidireccional).

## 🧮 Modelo científico

- **Nearest-neighbor SantaLucia 1998** (parámetros unificados verificados con el
  ejemplo `CGTTGA`: ΔH = −40.9 kcal/mol, ΔS = −114.6 cal/(mol·K),
  ΔG°37 = −5.36 kcal/mol), iniciación, penalización terminal A·T, corrección de simetría.
- **Dangling ends** (Bommarito, Peyret y SantaLucia 2000, vía SantaLucia & Hicks
  2004 Tabla 3): cada base desapareada junto a un extremo dúplex aporta su
  incremento medido — ningún extremo libre se ignora.
- **Tm**: `ΔH/(ΔS + R·ln(Ct/4)) − 273.15 + 16.6·log₁₀[Na⁺]eq − 0.75·DMSO%`
  para el dúplex cebador–molde; dímeros: `R·ln(Ct)` + simetría (homodímeros),
  `R·ln(Ct/2)` (heterodímeros).
- **Sales**: equivalente sodio de **von Ahsen 2001**,
  `[Na⁺]eq = [mono] + 120·√([Mg²⁺] − [dNTP])` (mM), Mg²⁺ limitado a cero —
  o corrección mixta mono/divalente **Owczarzy 2004/2008** (`salt_method:
  'owczarzy', equilibrio Ka Mg:dNTP, árbol de decisión en R), más cercana
  a Primer3 en todas las sondas de referencia.
- **Mismatches**: internos aislados (Allawi/SantaLucia/Peyret/Watkins, IMM) y
  terminales (SantaLucia y Peyret 2001, TMM); tándems y bulges rompen
  el apilamiento (bulge +3.0 kcal/mol).
- **Estructuras**: horquillas (tallos perfectos + penalizaciones de bucle de Turner,
  extrapolación Jacobson–Stockmayer más allá de 9 nt), homo/heterodímeros
  (bloques + puentes + alineamiento DP termodinámico Smith–Waterman,
  mínimo global).
- **Umbrales**: ΔG < −9 kcal/mol → alerta **crítica** (horquillas, dímeros);
  ΔG ≤ −6 → aviso; también crítico en dímeros anclados 3′ con ΔG < −7.
  Extremo 3′ (ventana de 5 nt): aviso si ΔG°37 < −5, crítico si ≤ −6 (escala
  calibrada al rango físico de un pentámero, máx ≈ −6.7).
- **IUPAC completo**: factor de degeneración D = ∏nᵢ, Tm ponderada por abundancia
  (aproximación de O'Donnell–Maloney, modos `mean|min|consensus`),
  estructuras evaluadas en la variante canónica. Las funciones de bajo nivel
  (`bestDimer`, `bestHairpin`, `tracebackBestAlignment`) exigen ACGT sin
  ambigüedad (`AMBIGUOUS_SEQUENCE` si no); las APIs de alto nivel
  canonicalizan por usted.
- **Sesgo 3′**: estabilidad ΔG°37 del pentámero 3′-terminal + informe GC-clamp.

## ⚡ Arquitectura híbrida (TypeScript + WASM + workers)

- **TypeScript puro por defecto** (`TypeScriptBackend`): Node ≥ 18, Bun,
  navegadores, cero dependencias nativas. Los imports `node:` (workers, cargador
  WASM) son perezosos: el núcleo de análisis sigue empaquetable para navegador.
- **Núcleo Rust compilado a WASM** (`wasm/` → `wasm-pkg/`, `WasmBackend`): motor
  de dímeros en paridad estricta con TS (tests de paridad bit a bit:
  `tests/wasm.test.ts`, `tests/wasm-web.test.ts`).
  - Node.js: `loadWasmBackend()` (URL explícita, paquete
    `@sfstudio_tools/primer-calc-wasm`, luego build local `wasm-pkg/`) con
    repliegue automático al motor TS.
  - Navegadores: build `wasm-pkg/web/` (`--target web`, basado en fetch) +
    `loadWasmBackendWeb(urlGlue)`; con bundler (Vite/webpack), importe el
    glue y construya `new WasmBackend(mod)` tras inicializarlo.
  - Regeneración: `npm run build:wasm` (toolchain Rust +
    target `wasm32-unknown-unknown` + CLI `wasm-bindgen`).
- **Multi-threading**:
  - Node: `MultiplexPool.evaluateCrossDimerizationParallel()` sobre
    `node:worker_threads` (`tests/parallel.test.ts`).
  - Navegadores: `crossDimerizationWebWorkers(primers, cond, workerUrl, opts, spawn)`
    con `new Worker(url)` sobre `dist/worker.js` (bundle IIFE autocontenido,
    `npm run build:worker`), mismo ensamblaje (`tests/webworkers.test.ts`).

## 🧪 Tests y CI

```bash
npm test             # Vitest: 225 tests (gold standards, edge cases, conformidad spec)
npm run test:coverage  # build + cobertura V8: 100 % líneas/funciones/ramas
npm run build        # tsup + worker navegador: ESM + CJS + .d.ts + dist/worker.js + dist/cli.js
npm run build:wasm   # Rust → wasm-pkg/ (targets Node.js + navegadores)
```

Juegos de validación:

- ejemplo dúplex SantaLucia 1998 (`CGTTGA`: ΔH −40.9, ΔS −114.6) y
  valores ΔG°37 SantaLucia y Hicks 2004;
- tabla dangling ends Bommarito et al. 2000;
- **Benchmark cruzado Primer3** (`tests/primer3.test.ts` + `tests/primer3-goldens.json`,
  congelados vía primer3-py 2.3.1): estructura diferencial NN idéntica (≤ 0.05 °C),
  Tm absolutos ≤ 2.5 °C (residuo documentado de las revisiones 1998→2004
  en stacks mixtos), homodímeros ΔG ≤ 1.5 kcal/mol, idéntico orden Tm en
  condiciones PCR. Regeneración: `python3 scripts/primer3-regen.py`
  (verificación: `--check`, job CI semanal); el paquete npm nunca depende de Python.
- paridad bit a bit TS ≡ WASM Node ≡ WASM web (`tests/wasm*.test.ts`),
  workers Node y navegadores (`tests/parallel*.test.ts`, `tests/webworkers.test.ts`);
- GC 0 %/100 %, secuencias muy cortas/largas, IUPAC complejos,
  degeneración astronómica (`N×100`), condiciones inválidas.

La integración continua (`.github/workflows/ci.yml`, Node 18/20/22 × Ubuntu/macOS)
reproduce typecheck, build TS, build WASM + **verificación de equivalencia
funcional de `wasm-pkg/`**, tests + cobertura, y revalida los goldens Primer3
cada semana.

## 📄 Licencia

Apache 2.0 — ver `LICENSE`.

## 📦 Publicación

```bash
npm login
# Primera publicación del scope: acceso público requerido.
npm publish --access public            # @sfstudio_tools/primer-calc
npm publish ./wasm-pkg --access public # @sfstudio_tools/primer-calc-wasm (opcional)
# Con GitHub Actions OIDC: añadir --provenance a ambos comandos.
```

Verificado sin credenciales: `npm publish --dry-run` (23 archivos, 163.6 kB,
`wasm/target/` excluido, `dist/` + `wasm-pkg/` incluidos).
