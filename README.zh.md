# 🧬 `@sfstudio_tools/primer-calc`

[![npm version](https://badge.fury.io/js/@sfstudio_tools%2Fprimer-calc.svg)](https://www.npmjs.com/package/@sfstudio_tools/primer-calc)
[![CI](https://github.com/l00e00b00i00g00/primer-calc/actions/workflows/ci.yml/badge.svg)](https://github.com/l00e00b00i00g00/primer-calc/actions/workflows/ci.yml)
[![license](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![node](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](package.json)

> **文档语言:** [English](README.md) · [Français](README.fr.md) · [Español](README.es.md) · [中文](README.zh.md) · [العربية](README.ar.md) · [Русский](README.ru.md) · [Português](README.pt.md) · [Deutsch](README.de.md)

参考级开源库（**Apache 2.0** 许可证），用于引物与寡核苷酸探针的分析、
优化与热力学计算。

## 📥 安装

```bash
npm install @sfstudio_tools/primer-calc
# 或: yarn add @sfstudio_tools/primer-calc
#     pnpm add @sfstudio_tools/primer-calc
#     bun add @sfstudio_tools/primer-calc
```

验证：`package.json` 的 `dependencies` 中出现该包。

## 🖥️ 终端界面

```bash
npx @sfstudio_tools/primer-calc                  # 交互式 TUI
npx @sfstudio_tools/primer-calc ATGCGTAGCTAGCTA  # 快速分析
npx @sfstudio_tools/primer-calc ATGC... --json   # JSON 输出
LANG=zh_CN.UTF-8 npx @sfstudio_tools/primer-calc # 强制语言
primer-calc --lang es --help
```

终端 UI (Ink) 提供**分析 / 多重 / 帮助**标签页，搭载完整引擎——无需生化背景：
输入序列，回车。按键：`tab` 切换，`↑↓←→` 导航，`回车` 确认，
`Ctrl+Q` 退出，`Ctrl+L` 切换语言。

## 🚀 TypeScript 快速上手

```typescript
import { analyzePrimer, calculateTm } from '@sfstudio_tools/primer-calc';

// 1. 熔解温度 (Tm)
const tm = calculateTm('ATGCGTAGCTAGCTAGCTA');
console.log(`熔解温度: ${tm} °C`);

// 2. 完整分析 (二级结构、GC% 等)
const analysis = analyzePrimer('ATGCGTAGCTAGCTAGCTA');
console.log('分析报告:', analysis);
```

用 `tsx` / `ts-node` 运行：终端输出熔解温度与完整分析对象，
无 TypeScript 编译错误。见 `examples/quickstart.ts` (`npm run example`)。

## 💻 高级 TypeScript API

```typescript
import { PrimerAnalyzer, MultiplexPool } from '@sfstudio_tools/primer-calc';

const analyzer = new PrimerAnalyzer({
  na_conc: 50, // mM
  mg_conc: 2.5, // mM (von Ahsen 校正)
  dNTPs_conc: 0.8, // mM (4 种 dNTP 总和)
  primer_conc: 200, // nM
  temp_unit: 'C',
});

const result = analyzer.evaluate('ATGCGTAGCTAGCTAGCTA');
console.log(`Tm (SantaLucia): ${result.tm.toFixed(2)} °C`);
console.log(`GC Content: ${result.gcContent.toFixed(1)}%`);
console.log(`Free Energy Hairpin: ${result.hairpin.deltaG?.toFixed(2) ?? 'n/a'} kcal/mol`);
if (result.hasRisks) console.warn('发现警告:', result.warnings);

const pool = new MultiplexPool([
  { id: 'primer_fwd_1', seq: 'ATCGATCGATCGATCG' },
  { id: 'primer_rev_1', seq: 'GCTAGCTAGCTAGCTA' },
]);
const crossCheck = pool.evaluateCrossDimerization();
if (crossCheck.hasCrossDimers) {
  console.error('交叉二聚化风险:', crossCheck.conflicts);
}

// 大反应池: worker 线程并行 (结果一致)
const parallel = await pool.evaluateCrossDimerizationParallel({}, { workers: 4 });

// 引物对、靶标、批量、简并
const pair = analyzePrimerPair('ATGCGTAGCTAGCTAGCTA', 'GCTAGCTAGCTAGCTA');
const target = analyzer.evaluateAgainstTarget('ATGCGTAGCTAG', 'CTAGCTACGCAT');
const batch = analyzeBatch(['ATGCGTAGCTAGCTAGCTA', { id: 'gc8', seq: 'GCGCGCGC' }]);
const tmMin = calculateTm('ATGCATGCATRY', {}, 'min'); // mean|min|consensus
```

## 🌍 国际化

TUI 与 CLI 以无感方式检测您的语言，分三步：

1. **系统语言检测** — 启动时查询操作系统：`LC_ALL`、`LC_MESSAGES`、`LANG`
   (如 `zh_CN.UTF-8`)，回退到 `Intl` 区域设置 (覆盖 Windows)，最后英语。
2. **翻译词典** — 每个语言一个类型化表格 (`src/i18n/locales/`)；
   缺失的键编译失败，绝不静默。
3. **框架接入** — Ink 界面经 `translate()` 渲染；每个分析警告码映射
   到带值的本地化模板。

支持：English, Français, Español, 中文, العربية, Русский, Português,
Deutsch。覆盖：`--lang <code>` 参数或 TUI 内 `Ctrl+L`。
编程使用：`detectLocale()`、`resolveLocale()`、`translate()`、
`translateWarning()` —— 全部导出。注意：阿拉伯语已翻译，但多数终端
从左向右显示 (无双向排版)。

## 🧮 科学模型

- **SantaLucia 1998 统一最近邻参数** (以 `CGTTGA` 参考验证：
  ΔH = −40.9 kcal/mol, ΔS = −114.6 cal/(mol·K), ΔG°37 = −5.36 kcal/mol)，
  起始项、末端 A·T 罚分、对称校正。
- **悬垂末端** (Bommarito, Peyret & SantaLucia 2000, 经 SantaLucia & Hicks
  2004 表 3)：双链体末端每个未配对碱基贡献实测增量——无自由末端被忽略。
- **Tm**: `ΔH/(ΔS + R·ln(Ct/4)) − 273.15 + 16.6·log₁₀[Na⁺]eq − 0.75·DMSO%`
  (引物–模板双链体)；二聚体：`R·ln(Ct)` + 对称 (同源二聚体)，
  `R·ln(Ct/2)` (异源二聚体)。
- **盐**：von Ahsen 2001 钠当量，
  `[Na⁺]eq = [mono] + 120·√([Mg²⁺] − [dNTP])` (mM)，Mg²⁺ 下限为零——
  或 mono/divalent 混合 **Owczarzy 2004/2008** 校正 (`salt_method:
'owczarzy'`, Mg:dNTP Ka 平衡，R 决策树)，在所有参考探针上更接近
  Primer3。
- **错配**：孤立内部错配 (Allawi/SantaLucia/Peyret/Watkins, IMM) 与
  末端错配 (SantaLucia & Peyret 2001, TMM)；串联错配与凸起打断堆积
  (凸起 +3.0 kcal/mol)。
- **结构**：发夹 (完美茎 + Turner 环罚分，>9 nt 用 Jacobson–Stockmayer
  外推)，同源/异源二聚体 (block + 错配桥接 + Smith–Waterman 热力学 DP，
  全局最小)。
- **阈值**：ΔG < −9 kcal/mol → **严重**警报 (发夹、二聚体)；
  ΔG ≤ −6 → 警告；3′端锚定的二聚体 ΔG < −7 也为严重。
  3′端 (5 nt 窗口)：ΔG°37 < −5 警告，≤ −6 严重 (按五聚体物理幅度
  校准，最大 ≈ −6.7)。
- **完整 IUPAC**：简并度 D = ∏nᵢ，按丰度加权 Tm
  (O'Donnell–Maloney 近似，`mean|min|consensus` 模式)，
  结构按 canonical 变体评估。底层函数 (`bestDimer`、`bestHairpin`、
  `tracebackBestAlignment`) 要求明确的 ACGT (`AMBIGUOUS_SEQUENCE` 否则)；
  高层 API 自动 canonical 化。
- **3′偏向**：3′末端五聚体 ΔG°37 稳定性 + GC 钳报告。

## ⚡ 混合架构 (TypeScript + WASM + workers)

- **默认纯 TypeScript** (`TypeScriptBackend`)：Node ≥ 18、Bun、
  浏览器，零原生依赖。`node:` 导入 (workers、WASM 加载器) 均为惰性：
  分析核心保持可打包到浏览器。
- **Rust 编译的 WASM 核心** (`wasm/` → `wasm-pkg/`、`WasmBackend`)：二聚体
  引擎与 TS 严格一致 (逐位一致性测试：
  `tests/wasm.test.ts`、`tests/wasm-web.test.ts`)。
  - Node.js：`loadWasmBackend()` (显式 URL、
    `@sfstudio_tools/primer-calc-wasm` 包、本地 `wasm-pkg/` 构建)，
    自动回退到 TS 引擎。
  - 浏览器：`wasm-pkg/web/` 构建 (`--target web`，基于 fetch) +
    `loadWasmBackendWeb(glueUrl)`；打包器 (Vite/webpack) 中导入 glue，
    初始化后构造 `new WasmBackend(mod)`。
  - 重新生成：`npm run build:wasm` (Rust 工具链 +
    `wasm32-unknown-unknown` target + `wasm-bindgen` CLI)。
- **多线程**：
  - Node：`MultiplexPool.evaluateCrossDimerizationParallel()` 基于
    `node:worker_threads` (`tests/parallel.test.ts`)。
  - 浏览器：`crossDimerizationWebWorkers(primers, cond, workerUrl, opts, spawn)`，
    `new Worker(url)` 加载 `dist/worker.js` (自包含 IIFE 包，
    `npm run build:worker`)，结果组装一致 (`tests/webworkers.test.ts`)。

## 🧪 测试与 CI

```bash
npm test             # Vitest: 225 个测试 (金标准、边界、spec 一致性)
npm run test:coverage  # 构建 + V8 覆盖率: 行/函数/分支 100%
npm run build        # tsup + 浏览器 worker: ESM + CJS + .d.ts + dist/worker.js + dist/cli.js
npm run build:wasm   # Rust → wasm-pkg/ (Node.js + 浏览器目标)
```

验证数据集：

- SantaLucia 1998 双链体示例 (`CGTTGA`: ΔH −40.9, ΔS −114.6) 与
  SantaLucia & Hicks 2004 ΔG°37 值；
- Bommarito 等 2000 悬垂末端表；
- **Primer3 交叉基准** (`tests/primer3.test.ts` + `tests/primer3-goldens.json`，
  primer3-py 2.3.1 冻结)：NN 差异结构一致 (≤ 0.05 °C)，
  绝对 Tm ≤ 2.5 °C (1998→2004 表格修订在混合 stack 的已知残差)，
  同源二聚体 ΔG ≤ 1.5 kcal/mol，PCR 条件下 Tm 排序一致。重新生成：
  `python3 scripts/primer3-regen.py` (用 `--check` 验证，每周 CI 任务)；
  npm 包永不依赖 Python。
- 逐位 TS ≡ Node-WASM ≡ web-WASM 一致性 (`tests/wasm*.test.ts`)，
  Node 与浏览器 workers (`tests/parallel*.test.ts`、`tests/webworkers.test.ts`)；
- GC 0%/100%、极短/极长序列、复杂 IUPAC、
  天文数字简并度 (`N×100`)、非法条件。

持续集成 (`.github/workflows/ci.yml`，Node 18/20/22 × Ubuntu/macOS)
复现类型检查、TS 构建、WASM 构建 + **已提交 `wasm-pkg/` 的功能等价
验证**、测试 + 覆盖率，并每周重新验证 Primer3 goldens。

## 📄 许可证

Apache 2.0 — 见 `LICENSE`。

## 📦 发布

```bash
npm login
# 首次发布该 scope 需要公开权限。
npm publish --access public            # @sfstudio_tools/primer-calc
npm publish ./wasm-pkg --access public # @sfstudio_tools/primer-calc-wasm (可选)
# GitHub Actions OIDC: 给两条命令加上 --provenance。
```

无凭证验证：`npm publish --dry-run` (23 个文件，163.6 kB，
排除 `wasm/target/`，包含 `dist/` + `wasm-pkg/`)。
