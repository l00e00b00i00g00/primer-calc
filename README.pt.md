# 🧬 `@sfstudio_tools/primer-calc`

[![npm version](https://badge.fury.io/js/@sfstudio_tools%2Fprimer-calc.svg)](https://www.npmjs.com/package/@sfstudio_tools/primer-calc)
[![CI](https://github.com/l00e00b00i00g00/primer-calc/actions/workflows/ci.yml/badge.svg)](https://github.com/l00e00b00i00g00/primer-calc/actions/workflows/ci.yml)
[![license](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![node](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](package.json)

> **Idiomas da documentação:** [English](README.md) · [Français](README.fr.md) · [Español](README.es.md) · [中文](README.zh.md) · [العربية](README.ar.md) · [Русский](README.ru.md) · [Português](README.pt.md) · [Deutsch](README.de.md)

A biblioteca open source de referência (licença **Apache 2.0**) para análise,
otimização e termodinâmica de primers e sondas oligonucleotídicas.

## 📥 Instalação

```bash
npm install @sfstudio_tools/primer-calc
# ou: yarn add @sfstudio_tools/primer-calc
#     pnpm add @sfstudio_tools/primer-calc
#     bun add @sfstudio_tools/primer-calc
```

Verificação: o pacote aparece em `dependencies` do seu `package.json`.

## 🖥️ Interface de terminal

```bash
npx @sfstudio_tools/primer-calc                  # TUI interativo
npx @sfstudio_tools/primer-calc ATGCGTAGCTAGCTA  # análise rápida
npx @sfstudio_tools/primer-calc ATGC... --json   # saída JSON
LANG=pt_BR.UTF-8 npx @sfstudio_tools/primer-calc # idioma forçado
primer-calc --lang es --help
```

O TUI (Ink) oferece as abas **Analisar / Multiplex / Ajuda** com o motor
completo — sem bioquímica prévia: digite uma sequência, Enter. Teclas: `tab`
abas, `↑↓←→` navegar, `Enter` confirmar, `Ctrl+Q` sair, `Ctrl+L` idioma.

## 🚀 Uso rápido em TypeScript

```typescript
import { analyzePrimer, calculateTm } from '@sfstudio_tools/primer-calc';

// 1. Temperatura de fusão (Tm)
const tm = calculateTm('ATGCGTAGCTAGCTAGCTA');
console.log(`Temperatura de fusão: ${tm} °C`);

// 2. Análise completa (estruturas secundárias, GC%, etc.)
const analysis = analyzePrimer('ATGCGTAGCTAGCTAGCTA');
console.log('Relatório de análise:', analysis);
```

Execute com `tsx` / `ts-node`: o terminal mostra a Tm e o objeto de análise
sem erros de compilação TypeScript. Ver `examples/quickstart.ts`
(`npm run example`).

## 💻 API TypeScript avançada

```typescript
import { PrimerAnalyzer, MultiplexPool } from '@sfstudio_tools/primer-calc';

const analyzer = new PrimerAnalyzer({
  na_conc: 50, // mM
  mg_conc: 2.5, // mM (correção de von Ahsen)
  dNTPs_conc: 0.8, // mM (total dos 4 dNTPs)
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
  console.error('Risco de dimerização cruzada:', crossCheck.conflicts);
}

// Pool grande: distribuição em worker threads (resultados idênticos)
const parallel = await pool.evaluateCrossDimerizationParallel({}, { workers: 4 });

// Par de primers, alvo, batch, degeneração
const pair = analyzePrimerPair('ATGCGTAGCTAGCTAGCTA', 'GCTAGCTAGCTAGCTA');
const target = analyzer.evaluateAgainstTarget('ATGCGTAGCTAG', 'CTAGCTACGCAT');
const batch = analyzeBatch(['ATGCGTAGCTAGCTAGCTA', { id: 'gc8', seq: 'GCGCGCGC' }]);
const tmMin = calculateTm('ATGCATGCATRY', {}, 'min'); // mean|min|consensus
```

## 🌍 Internacionalização

O TUI e o CLI detectam seu idioma de forma invisível, em três etapas:

1. **Detecção do idioma do sistema** — na inicialização, o programa consulta o
   SO: `LC_ALL`, depois `LC_MESSAGES`, depois `LANG` (ex. `pt_BR.UTF-8`), com
   recuo para as configurações regionais `Intl` (cobre Windows) e o inglês.
2. **Dicionários de tradução** — uma tabela tipada por idioma
   (`src/i18n/locales/`); qualquer chave faltante falha na compilação,
   nunca em silêncio.
3. **Fiação do framework** — as telas Ink renderizam via `translate()`; cada
   código de aviso mapeia para um modelo localizado com seus valores.

Suportados: English, Français, Español, 中文, العربية, Русский, Português,
Deutsch. Forçar: flag `--lang <code>` ou `Ctrl+L` no TUI.
Uso programático: `detectLocale()`, `resolveLocale()`, `translate()`,
`translateWarning()` — todos exportados. Nota: o árabe está traduzido mas a
maioria dos terminais o exibe da esquerda para a direita (sem bidirecional).

## 🧮 Modelo científico

- **Nearest-neighbor SantaLucia 1998 unificado** (verificado com o exemplo
  `CGTTGA`: ΔH = −40.9 kcal/mol, ΔS = −114.6 cal/(mol·K),
  ΔG°37 = −5.36 kcal/mol), iniciação, penalidade terminal A·T, correção de simetria.
- **Dangling ends** (Bommarito, Peyret & SantaLucia 2000, via SantaLucia &
  Hicks 2004 Tabela 3): cada base desemparelhada junto a uma extremidade do
  duplex contribui seu incremento medido — nenhuma extremidade livre é ignorada.
- **Tm**: `ΔH/(ΔS + R·ln(Ct/4)) − 273.15 + 16.6·log₁₀[Na⁺]eq − 0.75·DMSO%`
  para o duplex primer–molde; dímeros: `R·ln(Ct)` + simetria (homodímeros),
  `R·ln(Ct/2)` (heterodímeros).
- **Sais**: equivalente sódio de **von Ahsen 2001**,
  `[Na⁺]eq = [mono] + 120·√([Mg²⁺] − [dNTP])` (mM), Mg²⁺ limitado a zero —
  ou correção mista mono/divalente **Owczarzy 2004/2008** (`salt_method:
'owczarzy'`, equilíbrio Ka Mg:dNTP, árvore de decisão em R), mais próxima
  do Primer3 em todas as sondas de referência.
- **Mismatches**: internos isolados (Allawi/SantaLucia/Peyret/Watkins, IMM) e
  terminais (SantaLucia & Peyret 2001, TMM); tándems e bulges quebram
  o empilhamento (bulge +3.0 kcal/mol).
- **Estruturas**: hairpins (hastes perfeitas + penalidades de loop de Turner,
  extrapolação Jacobson–Stockmayer além de 9 nt), homo/heterodímeros
  (blocos + pontes + alinhamento DP termodinâmico Smith–Waterman,
  mínimo global).
- **Limiares**: ΔG < −9 kcal/mol → alerta **crítico** (hairpins, dímeros);
  ΔG ≤ −6 → aviso; também crítico em dímeros ancorados 3′ com ΔG < −7.
  Extremidade 3′ (janela de 5 nt): aviso se ΔG°37 < −5, crítico se ≤ −6
  (escala calibrada na faixa física de um pentâmero, máx ≈ −6.7).
- **IUPAC completo**: fator de degeneração D = ∏nᵢ, Tm ponderada por abundância
  (aproximação de O'Donnell–Maloney, modos `mean|min|consensus`),
  estruturas avaliadas na variante canônica. As funções de baixo nível
  (`bestDimer`, `bestHairpin`, `tracebackBestAlignment`) exigem ACGT sem
  ambiguidade (`AMBIGUOUS_SEQUENCE` caso contrário); as APIs de alto nível
  canonicalizam por você.
- **Viés 3′**: estabilidade ΔG°37 do pentâmero 3′-terminal + relatório GC-clamp.

## ⚡ Arquitetura híbrida (TypeScript + WASM + workers)

- **TypeScript puro por padrão** (`TypeScriptBackend`): Node ≥ 18, Bun,
  navegadores, zero dependências nativas. Os imports `node:` (workers, carregador
  WASM) são preguiçosos: o núcleo de análise continua empacotável para navegador.
- **Núcleo Rust compilado em WASM** (`wasm/` → `wasm-pkg/`, `WasmBackend`): motor
  de dímeros em paridade estrita com TS (testes de paridade bit a bit:
  `tests/wasm.test.ts`, `tests/wasm-web.test.ts`).
  - Node.js: `loadWasmBackend()` (URL explícita, pacote
    `@sfstudio_tools/primer-calc-wasm`, depois build local `wasm-pkg/`) com
    recuo automático ao motor TS.
  - Navegadores: build `wasm-pkg/web/` (`--target web`, baseado em fetch) +
    `loadWasmBackendWeb(urlGlue)`; com bundler (Vite/webpack), importe o
    glue e construa `new WasmBackend(mod)` após inicializá-lo.
  - Regeneração: `npm run build:wasm` (toolchain Rust +
    target `wasm32-unknown-unknown` + CLI `wasm-bindgen`).
- **Multi-threading**:
  - Node: `MultiplexPool.evaluateCrossDimerizationParallel()` sobre
    `node:worker_threads` (`tests/parallel.test.ts`).
  - Navegadores: `crossDimerizationWebWorkers(primers, cond, workerUrl, opts, spawn)`
    com `new Worker(url)` sobre `dist/worker.js` (bundle IIFE autocontido,
    `npm run build:worker`), mesma montagem (`tests/webworkers.test.ts`).

## 🧪 Testes e CI

```bash
npm test             # Vitest: 225 testes (gold standards, edge cases, conformidade spec)
npm run test:coverage  # build + cobertura V8: 100 % linhas/funções/ramos
npm run build        # tsup + worker navegador: ESM + CJS + .d.ts + dist/worker.js + dist/cli.js
npm run build:wasm   # Rust → wasm-pkg/ (alvos Node.js + navegadores)
```

Jogos de validação:

- exemplo duplex SantaLucia 1998 (`CGTTGA`: ΔH −40.9, ΔS −114.6) e
  valores ΔG°37 SantaLucia & Hicks 2004;
- tabela dangling ends Bommarito et al. 2000;
- **Benchmark cruzado Primer3** (`tests/primer3.test.ts` + `tests/primer3-goldens.json`,
  congelados via primer3-py 2.3.1): estrutura diferencial NN idêntica (≤ 0.05 °C),
  Tm absolutos ≤ 2.5 °C (resíduo documentado das revisões 1998→2004
  em stacks mistos), homodímeros ΔG ≤ 1.5 kcal/mol, idêntica ordem Tm em
  condições PCR. Regeneração: `python3 scripts/primer3-regen.py`
  (verificação: `--check`, job CI semanal); o pacote npm nunca depende de Python.
- paridade bit a bit TS ≡ WASM Node ≡ WASM web (`tests/wasm*.test.ts`),
  workers Node e navegadores (`tests/parallel*.test.ts`, `tests/webworkers.test.ts`);
- GC 0 %/100 %, sequências muito curtas/longas, IUPAC complexos,
  degeneração astronômica (`N×100`), condições inválidas.

A integração contínua (`.github/workflows/ci.yml`, Node 18/20/22 × Ubuntu/macOS)
reproduz typecheck, build TS, build WASM + **verificação de equivalência
funcional de `wasm-pkg/`**, testes + cobertura, e revalida os goldens Primer3
toda semana.

## 📄 Licença

Apache 2.0 — ver `LICENSE`.

## 📦 Publicação

```bash
npm login
# Primeira publicação do scope: acesso público requerido.
npm publish --access public            # @sfstudio_tools/primer-calc
npm publish ./wasm-pkg --access public # @sfstudio_tools/primer-calc-wasm (opcional)
# Com GitHub Actions OIDC: adicionar --provenance aos dois comandos.
```

Verificado sem credenciais: `npm publish --dry-run` (23 arquivos, 163.6 kB,
`wasm/target/` excluído, `dist/` + `wasm-pkg/` incluídos).
