# 🧬 `@sfstudio_tools/primer-calc`

[![npm version](https://badge.fury.io/js/@sfstudio_tools%2Fprimer-calc.svg)](https://www.npmjs.com/package/@sfstudio_tools/primer-calc)
[![CI](https://github.com/l00e00b00i00g00/primer-calc/actions/workflows/ci.yml/badge.svg)](https://github.com/l00e00b00i00g00/primer-calc/actions/workflows/ci.yml)
[![license](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![node](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](package.json)

> **Языки документации:** [English](README.md) · [Français](README.fr.md) · [Español](README.es.md) · [中文](README.zh.md) · [العربية](README.ar.md) · [Русский](README.ru.md) · [Português](README.pt.md) · [Deutsch](README.de.md)

Эталонная библиотека с открытым кодом (лицензия **Apache 2.0**) для анализа,
оптимизации и термодинамики праймеров (_primers_) и олигонуклеотидных зондов.

## 📥 Установка

```bash
npm install @sfstudio_tools/primer-calc
# или: yarn add @sfstudio_tools/primer-calc
#      pnpm add @sfstudio_tools/primer-calc
#      bun add @sfstudio_tools/primer-calc
```

Проверка успеха: пакет появляется в `dependencies` вашего `package.json`.

## 🖥️ Терминальный интерфейс

```bash
npx @sfstudio_tools/primer-calc                  # интерактивный TUI
npx @sfstudio_tools/primer-calc ATGCGTAGCTAGCTA  # быстрый анализ
npx @sfstudio_tools/primer-calc ATGC... --json   # вывод JSON
LANG=ru_RU.UTF-8 npx @sfstudio_tools/primer-calc # принудительная локаль
primer-calc --lang es --help
```

TUI (Ink) предлагает вкладки **Анализ / Мультиплекс / Помощь** на полном движке —
без биохимической подготовки: введите последовательность, Enter. Клавиши: `tab`
вкладки, `↑↓←→` навигация, `Enter` подтвердить, `Ctrl+Q` выход, `Ctrl+L` язык.

## 🚀 Быстрое использование в TypeScript

```typescript
import { analyzePrimer, calculateTm } from '@sfstudio_tools/primer-calc';

// 1. Температура плавления (Tm)
const tm = calculateTm('ATGCGTAGCTAGCTAGCTA');
console.log(`Температура плавления: ${tm} °C`);

// 2. Полный анализ (вторичные структуры, GC% и т.д.)
const analysis = analyzePrimer('ATGCGTAGCTAGCTAGCTA');
console.log('Отчёт анализа:', analysis);
```

Запуск через `tsx` / `ts-node`: терминал показывает Tm и полный объект анализа
без ошибок компиляции TypeScript. См. `examples/quickstart.ts`
(`npm run example`).

## 💻 Продвинутый TypeScript API

```typescript
import { PrimerAnalyzer, MultiplexPool } from '@sfstudio_tools/primer-calc';

const analyzer = new PrimerAnalyzer({
  na_conc: 50, // мМ
  mg_conc: 2.5, // мМ (поправка фон Азена)
  dNTPs_conc: 0.8, // мМ (сумма 4 dNTP)
  primer_conc: 200, // нМ
  temp_unit: 'C',
});

const result = analyzer.evaluate('ATGCGTAGCTAGCTAGCTA');
console.log(`Tm (SantaLucia): ${result.tm.toFixed(2)} °C`);
console.log(`GC Content: ${result.gcContent.toFixed(1)}%`);
console.log(`Free Energy Hairpin: ${result.hairpin.deltaG?.toFixed(2) ?? 'n/a'} kcal/mol`);
if (result.hasRisks) console.warn('Обнаружены предупреждения:', result.warnings);

const pool = new MultiplexPool([
  { id: 'primer_fwd_1', seq: 'ATCGATCGATCGATCG' },
  { id: 'primer_rev_1', seq: 'GCTAGCTAGCTAGCTA' },
]);
const crossCheck = pool.evaluateCrossDimerization();
if (crossCheck.hasCrossDimers) {
  console.error('Риск кросс-димеризации:', crossCheck.conflicts);
}

// Большой пул: распределение по worker threads (те же результаты)
const parallel = await pool.evaluateCrossDimerizationParallel({}, { workers: 4 });

// Пара праймеров, мишень, батч, вырожденность
const pair = analyzePrimerPair('ATGCGTAGCTAGCTAGCTA', 'GCTAGCTAGCTAGCTA');
const target = analyzer.evaluateAgainstTarget('ATGCGTAGCTAG', 'CTAGCTACGCAT');
const batch = analyzeBatch(['ATGCGTAGCTAGCTAGCTA', { id: 'gc8', seq: 'GCGCGCGC' }]);
const tmMin = calculateTm('ATGCATGCATRY', {}, 'min'); // mean|min|consensus
```

## 🌍 Интернационализация

TUI и CLI определяют ваш язык незаметно, в три шага:

1. **Определение языка системы** — при запуске программа опрашивает ОС:
   `LC_ALL`, затем `LC_MESSAGES`, затем `LANG` (например `ru_RU.UTF-8`), с
   откатом на региональные настройки `Intl` (покрывает Windows), затем английский.
2. **Словари переводов** — типизированная таблица на локаль
   (`src/i18n/locales/`); отсутствующий ключ ломает компиляцию,
   никогда не молчит.
3. **Привязка к фреймворку** — экраны Ink рендерятся через `translate()`;
   каждый код предупреждения проецируется на локализованный шаблон со значениями.

Поддерживаются: English, Français, Español, 中文, العربية, Русский,
Português, Deutsch. Переопределение: флаг `--lang <code>` или `Ctrl+L` в TUI.
Программное использование: `detectLocale()`, `resolveLocale()`, `translate()`,
`translateWarning()` — всё экспортировано. Примечание: арабский переведён, но
большинство терминалов показывают его слева направо (без двунаправленности).

## 🧮 Научная модель

- **Унифицированный nearest-neighbor SantaLucia 1998** (проверен на эталоне
  `CGTTGA`: ΔH = −40.9 ккал/моль, ΔS = −114.6 кал/(моль·K),
  ΔG°37 = −5.36 ккал/моль), инициация, концевой A·T штраф, поправка симметрии.
- **Висячие концы** (Bommarito, Peyret и SantaLucia 2000, через SantaLucia
  и Hicks 2004, таблица 3): каждое неспаренное основание у конца дуплекса
  вносит измеренный вклад — ни один свободный конец не игнорируется.
- **Tm**: `ΔH/(ΔS + R·ln(Ct/4)) − 273.15 + 16.6·log₁₀[Na⁺]eq − 0.75·DMSO%`
  для дуплекса праймер–матрица; димеры: `R·ln(Ct)` + симметрия (гомодимеры),
  `R·ln(Ct/2)` (гетеродимеры).
- **Соли**: натриевый эквивалент **фон Азена 2001**,
  `[Na⁺]eq = [mono] + 120·√([Mg²⁺] − [dNTP])` (мМ), Mg²⁺ ≥ 0 —
  или смешанная моно/дивалентная поправка **Owczarzy 2004/2008**
  (`salt_method: 'owczarzy'`, равновесие Ka Mg:dNTP, дерево решений по R),
  ближе к Primer3 на всех эталонных пробах.
- **Мисматчи**: изолированные внутренние (Allawi/SantaLucia/Peyret/Watkins, IMM)
  и концевые (SantaLucia и Peyret 2001, TMM); тандемы и балджи разрывают
  стекинг (балдж +3.0 ккал/моль).
- **Структуры**: шпильки (идеальные стебли + штрафы петель Тернера,
  экстраполяция Jacobson–Stockmayer за 9 нт), гомо/гетеродимеры
  (блоки + мостики + термодинамический DP Смита–Уотермана, глобальный минимум).
- **Пороги**: ΔG < −9 ккал/моль → **критическое** предупреждение (шпильки, димеры);
  ΔG ≤ −6 → предупреждение; также критично для 3′-заякоренных димеров с ΔG < −7.
  3′-конец (окно 5 нт): предупреждение при ΔG°37 < −5, критично при ≤ −6 (шкала
  откалибрована на физический диапазон пентамера, макс ≈ −6.7).
- **Полный IUPAC**: фактор вырожденности D = ∏nᵢ, взвешенная по содержанию Tm
  (приближение О'Доннелла–Малони, режимы `mean|min|consensus`),
  структуры считаются на каноническом варианте. Низкоуровневые функции
  (`bestDimer`, `bestHairpin`, `tracebackBestAlignment`) требуют однозначный
  ACGT (`AMBIGUOUS_SEQUENCE` иначе); высокоуровневые API канонизируют за вас.
- **3′-смещение**: стабильность 3′-концевого пентамера ΔG°37 + отчёт GC-клампа.

## ⚡ Гибридная архитектура (TypeScript + WASM + workers)

- **Чистый TypeScript по умолчанию** (`TypeScriptBackend`): Node ≥ 18, Bun,
  браузеры, ноль нативных зависимостей. Импорты `node:` (workers, загрузчик
  WASM) ленивые: ядро анализа остаётся собираемым для браузера.
- **Скомпилированное Rust/WASM ядро** (`wasm/` → `wasm-pkg/`, `WasmBackend`):
  димерный движок в строгом паритете с TS (бит-точные тесты паритета:
  `tests/wasm.test.ts`, `tests/wasm-web.test.ts`).
  - Node.js: `loadWasmBackend()` (явный URL, пакет
    `@sfstudio_tools/primer-calc-wasm`, затем локальная сборка `wasm-pkg/`)
    с автоматическим откатом на TS-движок.
  - Браузеры: сборка `wasm-pkg/web/` (`--target web`, на fetch) +
    `loadWasmBackendWeb(glueUrl)`; в бандлере (Vite/webpack) импортируйте
    glue и сконструируйте `new WasmBackend(mod)` после инициализации.
  - Регенерация: `npm run build:wasm` (тулчейн Rust +
    target `wasm32-unknown-unknown` + CLI `wasm-bindgen`).
- **Многопоточность**:
  - Node: `MultiplexPool.evaluateCrossDimerizationParallel()` поверх
    `node:worker_threads` (`tests/parallel.test.ts`).
  - Браузеры: `crossDimerizationWebWorkers(primers, cond, workerUrl, opts, spawn)`
    с `new Worker(url)` на `dist/worker.js` (самодостаточный IIFE-бандл,
    `npm run build:worker`), та же сборка отчёта (`tests/webworkers.test.ts`).

## 🧪 Тесты и CI

```bash
npm test             # Vitest: 212 тестов (эталоны, крайние случаи, соответствие спеке)
npm run test:coverage  # сборка + покрытие V8: 100 % строк/функций/ветвей
npm run build        # tsup + воркер браузера: ESM + CJS + .d.ts + dist/worker.js + dist/cli.js
npm run build:wasm   # Rust → wasm-pkg/ (цели Node.js + браузеры)
```

Наборы валидации:

- пример дуплекса SantaLucia 1998 (`CGTTGA`: ΔH −40.9, ΔS −114.6) и
  значения ΔG°37 SantaLucia и Hicks 2004;
- таблица висячих концов Bommarito и др. 2000;
- **Перекрёстный бенчмарк Primer3** (`tests/primer3.test.ts` + `tests/primer3-goldens.json`,
  заморожены через primer3-py 2.3.1): идентичная дифференциальная NN-структура
  (≤ 0.05 °C), абсолютные Tm ≤ 2.5 °C (документированный остаток ревизий
  1998→2004 на смешанных стеках), гомодимеры ΔG ≤ 1.5 ккал/моль, идентичный
  порядок Tm в условиях ПЦР. Регенерация: `python3 scripts/primer3-regen.py`
  (проверка: `--check`, еженедельный CI); npm-пакет никогда не зависит от Python.
- побитовый паритет TS ≡ Node-WASM ≡ web-WASM (`tests/wasm*.test.ts`),
  воркеры Node и браузеров (`tests/parallel*.test.ts`, `tests/webworkers.test.ts`);
- GC 0 %/100 %, очень короткие/длинные последовательности, сложный IUPAC,
  астрономическая вырожденность (`N×100`), невалидные условия.

Непрерывная интеграция (`.github/workflows/ci.yml`, Node 18/20/22 × Ubuntu/macOS)
воспроизводит typecheck, сборку TS, сборку WASM + **функциональную проверку
эквивалентности закоммиченного `wasm-pkg/`**, тесты + покрытие, и
перепроверяет голдены Primer3 еженедельно.

## 📄 Лицензия

Apache 2.0 — см. `LICENSE`.

## 📦 Публикация

```bash
npm login
# Первая публикация скопа: нужен публичный доступ.
npm publish --access public            # @sfstudio_tools/primer-calc
npm publish ./wasm-pkg --access public # @sfstudio_tools/primer-calc-wasm (опционально)
# С GitHub Actions OIDC: добавьте --provenance к обеим командам.
```

Проверено без учётных данных: `npm publish --dry-run` (23 файла, 163.6 kB,
`wasm/target/` исключён, `dist/` + `wasm-pkg/` включены).
