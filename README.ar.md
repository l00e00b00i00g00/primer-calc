# 🧬 `@sfstudio_tools/primer-calc`

[![npm version](https://badge.fury.io/js/@sfstudio_tools%2Fprimer-calc.svg)](https://www.npmjs.com/package/@sfstudio_tools/primer-calc)
[![CI](https://github.com/l00e00b00i00g00/primer-calc/actions/workflows/ci.yml/badge.svg)](https://github.com/l00e00b00i00g00/primer-calc/actions/workflows/ci.yml)
[![license](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![node](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](package.json)

> **لغات التوثيق:** [English](README.md) · [Français](README.fr.md) · [Español](README.es.md) · [中文](README.zh.md) · [العربية](README.ar.md) · [Русский](README.ru.md) · [Português](README.pt.md) · [Deutsch](README.de.md)

المكتبة المرجعية مفتوحة المصدر (برخصة **Apache 2.0**) لتحليل البادئات
(_primers_) والمسابر وتحسينها وديناميكيتها الحرارية.

## 📥 التثبيت

```bash
npm install @sfstudio_tools/primer-calc
# أو: yarn add @sfstudio_tools/primer-calc
#     pnpm add @sfstudio_tools/primer-calc
#     bun add @sfstudio_tools/primer-calc
```

للتحقق: تظهر الحزمة في `dependencies` في ملف `package.json`.

## 🖥️ الواجهة الطرفية

```bash
npx @sfstudio_tools/primer-calc                  # واجهة تفاعلية
npx @sfstudio_tools/primer-calc ATGCGTAGCTAGCTA  # تحليل سريع
npx @sfstudio_tools/primer-calc ATGC... --json   # مخرجات JSON
LANG=ar_EG.UTF-8 npx @sfstudio_tools/primer-calc # فرض اللغة
primer-calc --lang es --help
```

واجهة TUI (Ink) بتبويبات **تحليل / متعدد / مساعدة** بالمحرك الكامل —
دون خلفية كيميائية: اكتب تسلسلاً واضغط Enter. المفاتيح: `tab` تبويب،
`↑↓←→` تنقل، `Enter` تأكيد، `Ctrl+Q` خروج، `Ctrl+L` لغة.

## 🚀 استخدام سريع في TypeScript

```typescript
import { analyzePrimer, calculateTm } from '@sfstudio_tools/primer-calc';

// 1. درجة حرارة الانصهار (Tm)
const tm = calculateTm('ATGCGTAGCTAGCTAGCTA');
console.log(`درجة الانصهار: ${tm} °C`);

// 2. تحليل كامل (بنى ثانوية، GC%، إلخ)
const analysis = analyzePrimer('ATGCGTAGCTAGCTAGCTA');
console.log('تقرير التحليل:', analysis);
```

نفّذ بـ `tsx` / `ts-node`: يعرض الطرفية درجة الانصهار وكائن التحليل
دون أخطاء ترجمة TypeScript. انظر `examples/quickstart.ts`
(`npm run example`).

## 💻 واجهة TypeScript المتقدمة

```typescript
import { PrimerAnalyzer, MultiplexPool } from '@sfstudio_tools/primer-calc';

const analyzer = new PrimerAnalyzer({
  na_conc: 50, // ملي مول
  mg_conc: 2.5, // ملي مول (تصحيح von Ahsen)
  dNTPs_conc: 0.8, // ملي مول (مجموع dNTPs الأربعة)
  primer_conc: 200, // نانو مول
  temp_unit: 'C',
});

const result = analyzer.evaluate('ATGCGTAGCTAGCTAGCTA');
console.log(`Tm (SantaLucia): ${result.tm.toFixed(2)} °C`);
console.log(`GC Content: ${result.gcContent.toFixed(1)}%`);
console.log(`Free Energy Hairpin: ${result.hairpin.deltaG?.toFixed(2) ?? 'n/a'} kcal/mol`);
if (result.hasRisks) console.warn('تحذيرات:', result.warnings);

const pool = new MultiplexPool([
  { id: 'primer_fwd_1', seq: 'ATCGATCGATCGATCG' },
  { id: 'primer_rev_1', seq: 'GCTAGCTAGCTAGCTA' },
]);
const crossCheck = pool.evaluateCrossDimerization();
if (crossCheck.hasCrossDimers) {
  console.error('خطر تضاعف متقاطع:', crossCheck.conflicts);
}

// تجمع كبير: توزيع على worker threads (نتائج مطابقة)
const parallel = await pool.evaluateCrossDimerizationParallel({}, { workers: 4 });

// زوج بادئات، هدف، دفعة، تحلل
const pair = analyzePrimerPair('ATGCGTAGCTAGCTAGCTA', 'GCTAGCTAGCTAGCTA');
const target = analyzer.evaluateAgainstTarget('ATGCGTAGCTAG', 'CTAGCTACGCAT');
const batch = analyzeBatch(['ATGCGTAGCTAGCTAGCTA', { id: 'gc8', seq: 'GCGCGCGC' }]);
const tmMin = calculateTm('ATGCATGCATRY', {}, 'min'); // mean|min|consensus
```

## 🌍 التدويل

يكتشف TUI وCLI لغتك بصمت، في ثلاث خطوات:

1. **كشف لغة النظام** — عند البدء يسأل البرنامج النظام:
   `LC_ALL` ثم `LC_MESSAGES` ثم `LANG` (مثل `ar_EG.UTF-8`)، مع التراجع
   إلى إعدادات `Intl` الإقليمية (تغطي Windows)، ثم الإنجليزية.
2. **قواميس الترجمة** — جدول مُنمَّط لكل لغة (`src/i18n/locales/`)؛
   أي مفتاح ناقص يُفشل الترجمة، ولا يُتجاهل بصمت أبداً.
3. **ربط الإطار** — شاشات Ink تُعرض عبر `translate()`؛ كل رمز تحذير
   يُسقط على قالب مترجم بقيمه.

المدعوم: English, Français, Español, 中文, العربية, Русский, Português,
Deutsch. التجاوز: علم `--lang <code>` أو `Ctrl+L` في TUI.
استعمال برمجي: `detectLocale()`، `resolveLocale()`، `translate()`،
`translateWarning()` — كلها مُصدَّرة. ملاحظة: العربية مترجمة لكن معظم
الطرفيات تعرضها من اليسار لليمين (لا تشكيل ثنائي الاتجاه).

## 🧮 النموذج العلمي

- **نموذج الجار الأقرب الموحد SantaLucia 1998** (مُتحقق بالمثال المرجعي
  `CGTTGA`: ΔH = −40.9 kcal/mol، ΔS = −114.6 cal/(mol·K)،
  ΔG°37 = −5.36 kcal/mol)، بدء، جزاء A·T الطرفي، تصحيح التماثل.
- **نهايات متدلية** (Bommarito وPeyret وSantaLucia 2000، عبر SantaLucia
  وHicks 2004 جدول 3): كل قاعدة غير مقترنة بجوار نهاية مزدوج تساهم
  بزيادتها المقاسة — لا نهاية حرة تُتجاهل.
- **Tm**: `ΔH/(ΔS + R·ln(Ct/4)) − 273.15 + 16.6·log₁₀[Na⁺]eq − 0.75·DMSO%`
  لمزدوج البادئ–القالب؛ الثنائيات: `R·ln(Ct)` + تماثل (متماثلة)،
  `R·ln(Ct/2)` (مغايرة).
- **الأملاح**: مكافئ الصوديوم **von Ahsen 2001**،
  `[Na⁺]eq = [mono] + 120·√([Mg²⁺] − [dNTP])` (ملي مول)، Mg²⁺ ≥ 0 —
  أو تصحيح مختلط أحادي/ثنائي **Owczarzy 2004/2008** (`salt_method:
'owczarzy'`, توازن Ka لـ Mg:dNTP، شجرة قرار R)، الأقرب إلى Primer3
  في كل المسابر المرجعية.
- **عدم التطابق**: داخلية معزولة (Allawi/SantaLucia/Peyret/Watkins، IMM)
  وطرفية (SantaLucia وPeyret 2001، TMM)؛ الترادفية والانتفاخات تكسر
  التكديس (انتفاخ +3.0 kcal/mol).
- **البنى**: شَعريات (سيقان مثالية + جزاءات حلقات Turner، استقراء
  Jacobson–Stockmayer بعد 9 nt)، ثنائيات متماثلة/مغايرة
  (كتل + جسور + محاذاة DP ديناميكية حرارية Smith–Waterman، أدنى عالمي).
- **العتبات**: ΔG < −9 kcal/mol → تنبيه **حرج** (شعريات، ثنائيات)؛
  ΔG ≤ −6 → تحذير؛ حرج أيضاً للمرتكز 3′ مع ΔG < −7.
  الطرف 3′ (نافذة 5 nt): تحذير إذا ΔG°37 < −5، حرج إذا ≤ −6 (مقياس
  معاير على المدى الفيزيائي للخماسي، أقصى ≈ −6.7).
- **IUPAC كامل**: عامل التحلل D = ∏nᵢ، Tm مرجح بالوفرة
  (تقريب O'Donnell–Maloney، أوضاع `mean|min|consensus`)، البنى تُقيَّم
  على المتغير القانوني. الدوال منخفضة المستوى
  (`bestDimer`، `bestHairpin`، `tracebackBestAlignment`) تتطلب ACGT
  غير غامض (`AMBIGUOUS_SEQUENCE` وإلا)؛ الواجهات العليا تُقنن لك.
- **انحياز 3′**: استقرار خماسي الطرف 3′ ΔG°37 + تقرير GC-clamp.

## ⚡ معمارية هجينة (TypeScript + WASM + workers)

- **TypeScript خالص افتراضياً** (`TypeScriptBackend`): Node ≥ 18، Bun،
  المتصفحات، صفر اعتماديات أصلية. استيرادات `node:` (workers، محمّل
  WASM) كسولة: نواة التحليل تبقى قابلة للحزم للمتصفح.
- **نواة Rust مترجمة إلى WASM** (`wasm/` → `wasm-pkg/`، `WasmBackend`):
  محرك الثنائيات بتكافؤ صارم مع TS (اختبارات تكافؤ بت-بت:
  `tests/wasm.test.ts`، `tests/wasm-web.test.ts`).
  - Node.js: `loadWasmBackend()` (رابط صريح، حزمة
    `@sfstudio_tools/primer-calc-wasm`، ثم بناء `wasm-pkg/` المحلي) مع
    تراجع تلقائي لمحرك TS.
  - المتصفحات: بناء `wasm-pkg/web/` (`--target web`، قائم على fetch) +
    `loadWasmBackendWeb(glueUrl)`؛ مع حازم (Vite/webpack)، استورد الغراء
    وابنِ `new WasmBackend(mod)` بعد تهيئته.
  - إعادة التوليد: `npm run build:wasm` (سلسلة Rust +
    هدف `wasm32-unknown-unknown` + CLI‏ `wasm-bindgen`).
- **تعدد الخيوط**:
  - Node: `MultiplexPool.evaluateCrossDimerizationParallel()` عبر
    `node:worker_threads` (`tests/parallel.test.ts`).
  - المتصفحات: `crossDimerizationWebWorkers(primers, cond, workerUrl, opts, spawn)`
    مع `new Worker(url)` على `dist/worker.js` (حزمة IIFE مكتفية،
    `npm run build:worker`)، نفس تجميع النتائج (`tests/webworkers.test.ts`).

## 🧪 الاختبارات وCI

```bash
npm test             # Vitest: 212 اختباراً (معايير ذهبية، حدود، مطابقة)
npm run test:coverage  # بناء + تغطية V8: 100% أسطر/دوال/فروع
npm run build        # tsup + عامل المتصفح: ESM + CJS + .d.ts + dist/worker.js + dist/cli.js
npm run build:wasm   # Rust → wasm-pkg/ (هدفي Node.js والمتصفحات)
```

مجموعات التحقق:

- مثال SantaLucia 1998 المزدوج (`CGTTGA`: ΔH −40.9، ΔS −114.6) وقيم
  ΔG°37 SantaLucia وHicks 2004؛
- جدول النهايات المتدلية Bommarito وآخرون 2000؛
- **المعيار المتقاطع Primer3** (`tests/primer3.test.ts` + `tests/primer3-goldens.json`،
  مجمد عبر primer3-py 2.3.1): بنية NN التفاضلية مطابقة (≤ 0.05 °C)،
  Tm المطلقة ≤ 2.5 °C (بقايا موثقة لمراجعات 1998→2004 في الركائز
  المختلطة)، ثنائيات متماثلة ΔG ≤ 1.5 kcal/mol، ترتيب Tm مطابق في
  ظروف PCR. إعادة التوليد: `python3 scripts/primer3-regen.py`
  (التحقق: `--check`، مهمة CI أسبوعية)؛ حزمة npm لا تعتمد على Python أبداً.
- تكافؤ بت-بت TS ≡ WASM Node ≡ WASM web (`tests/wasm*.test.ts`)،
  عمال Node والمتصفحات (`tests/parallel*.test.ts`، `tests/webworkers.test.ts`)؛
- GC 0%/100%، تسلسلات قصيرة/طويلة جداً، IUPAC معقدة،
  تحلل فلكي (`N×100`)، ظروف غير صالحة.

التكامل المستمر (`.github/workflows/ci.yml`، Node 18/20/22 × Ubuntu/macOS)
يعيد فحص الأنواع، بناء TS، بناء WASM + **التحقق من التكافؤ الوظيفي
لـ `wasm-pkg/` المُثبت**، الاختبارات + التغطية، ويعيد التحقق من ذهبيات
Primer3 أسبوعياً.

## 📄 الرخصة

Apache 2.0 — انظر `LICENSE`.

## 📦 النشر

```bash
npm login
# أول نشر للنطاق: يلزم وصول عام.
npm publish --access public            # @sfstudio_tools/primer-calc
npm publish ./wasm-pkg --access public # @sfstudio_tools/primer-calc-wasm (اختياري)
# مع GitHub Actions OIDC: أضف --provenance للأمرين.
```

مُتحقق بدون بيانات: `npm publish --dry-run` (23 ملفاً، 163.6 kB،
يستبعد `wasm/target/`، يشمل `dist/` + `wasm-pkg/`).
