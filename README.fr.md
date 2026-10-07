# 🧬 `@sfstudio_tools/primer-calc`

[![npm version](https://badge.fury.io/js/@sfstudio_tools%2Fprimer-calc.svg)](https://www.npmjs.com/package/@sfstudio_tools/primer-calc)
[![CI](https://github.com/l00e00b00i00g00/primer-calc/actions/workflows/ci.yml/badge.svg)](https://github.com/l00e00b00i00g00/primer-calc/actions/workflows/ci.yml)
[![license](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![node](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](package.json)

> **Langues de la documentation :** [English](README.md) · [Français](README.fr.md) · [Español](README.es.md) · [中文](README.zh.md) · [العربية](README.ar.md) · [Русский](README.ru.md) · [Português](README.pt.md) · [Deutsch](README.de.md)

La bibliothèque open source de référence (licence **Apache 2.0**) pour l'analyse,
l'optimisation et la thermodynamique des amorces (_primers_) et sondes oligonucléotidiques.

## 📥 Installation

```bash
npm install @sfstudio_tools/primer-calc
# ou : yarn add @sfstudio_tools/primer-calc
#       pnpm add @sfstudio_tools/primer-calc
#       bun add @sfstudio_tools/primer-calc
```

Vérification du succès : le package apparaît dans les `dependencies` de votre `package.json`.

## 🖥️ Interface terminal

```bash
npx @sfstudio_tools/primer-calc                  # TUI interactif
npx @sfstudio_tools/primer-calc ATGCGTAGCTAGCTA  # analyse rapide
npx @sfstudio_tools/primer-calc ATGC... --json   # sortie JSON
LANG=fr_FR.UTF-8 npx @sfstudio_tools/primer-calc # locale forcée
primer-calc --lang es --help
```

Le TUI (Ink) propose les onglets **Analyser / Multiplex / Aide** avec le moteur
complet — aucune connaissance biochimique requise : tapez une séquence, Entrée.
Touches : `tab` onglets, `↑↓←→` naviguer, `Entrée` valider,
`Ctrl+Q` quitter, `Ctrl+L` changer de langue.

## 🚀 Utilisation rapide en TypeScript

```typescript
import { analyzePrimer, calculateTm } from '@sfstudio_tools/primer-calc';

// 1. Température de fusion (Tm)
const tm = calculateTm('ATGCGTAGCTAGCTAGCTA');
console.log(`Température de fusion : ${tm} °C`);

// 2. Analyse complète (structures secondaires, GC%, etc.)
const analysis = analyzePrimer('ATGCGTAGCTAGCTAGCTA');
console.log('Rapport d’analyse :', analysis);
```

Exécutez avec `tsx` / `ts-node` : le terminal affiche la Tm et l'objet d'analyse
sans erreur de compilation TypeScript. Voir `examples/quickstart.ts`
(`npm run example`).

## 💻 API avancée

```typescript
import { PrimerAnalyzer, MultiplexPool } from '@sfstudio_tools/primer-calc';

const analyzer = new PrimerAnalyzer({
  na_conc: 50, // mM
  mg_conc: 2.5, // mM (correction de von Ahsen)
  dNTPs_conc: 0.8, // mM (total des 4 dNTP)
  primer_conc: 200, // nM
  temp_unit: 'C',
});

const result = analyzer.evaluate('ATGCGTAGCTAGCTAGCTA');
console.log(`Tm (SantaLucia): ${result.tm.toFixed(2)} °C`);
console.log(`GC Content: ${result.gcContent.toFixed(1)}%`);
console.log(`Free Energy Hairpin: ${result.hairpin.deltaG?.toFixed(2) ?? 'n/a'} kcal/mol`);
if (result.hasRisks) console.warn('Avertissements détectés :', result.warnings);

const pool = new MultiplexPool([
  { id: 'primer_fwd_1', seq: 'ATCGATCGATCGATCG' },
  { id: 'primer_rev_1', seq: 'GCTAGCTAGCTAGCTA' },
]);
const crossCheck = pool.evaluateCrossDimerization();
if (crossCheck.hasCrossDimers) {
  console.error('Risque de dimérisation croisée :', crossCheck.conflicts);
}

// Grand pool : distribution sur worker threads (résultats identiques)
const parallel = await pool.evaluateCrossDimerizationParallel({}, { workers: 4 });

// Paire d'amorces, cible, batch, dégénérescence
const pair = analyzePrimerPair('ATGCGTAGCTAGCTAGCTA', 'GCTAGCTAGCTAGCTA');
const target = analyzer.evaluateAgainstTarget('ATGCGTAGCTAG', 'CTAGCTACGCAT');
const batch = analyzeBatch(['ATGCGTAGCTAGCTAGCTA', { id: 'gc8', seq: 'GCGCGCGC' }]);
const tmMin = calculateTm('ATGCATGCATRY', {}, 'min'); // mean|min|consensus
```

## 🌍 Internationalisation

Le TUI et le CLI détectent votre langue invisiblement, en trois étapes :

1. **Détection de la langue système** — au lancement, le programme interroge
   l'OS : `LC_ALL`, puis `LC_MESSAGES`, puis `LANG` (ex. `fr_FR.UTF-8`), avec
   repli sur les paramètres régionaux `Intl` (couvre Windows), puis l'anglais.
2. **Dictionnaires de traduction** — une table typée par locale
   (`src/i18n/locales/`) ; toute clé manquante échoue à la compilation,
   jamais silencieusement.
3. **Câblage framework** — les écrans Ink rendent via `translate()` ; chaque
   code d'alerte est projeté sur un modèle localisé avec ses valeurs.

Pris en charge : English, Français, Español, 中文, العربية, Русский,
Português, Deutsch. Forçage : flag `--lang <code>` ou `Ctrl+L` dans le TUI.
Usage programmatique : `detectLocale()`, `resolveLocale()`, `translate()`,
`translateWarning()` — tous exportés. Note : l'arabe est traduit mais la
plupart des terminaux l'affichent de gauche à droite (pas de bidirectionnel).

## 🧮 Modèle scientifique

- **Nearest-neighbor SantaLucia 1998** (paramètres unifiés vérifiés contre l'exemple
  de référence `CGTTGA` : ΔH = −40.9 kcal/mol, ΔS = −114.6 cal/(mol·K),
  ΔG°37 = −5.36 kcal/mol), initiation, pénalité terminale A·T, correction de symétrie.
- **Dangling ends** (Bommarito, Peyret & SantaLucia 2000, via SantaLucia & Hicks
  2004 Table 3) : chaque base non appariée adjacente à une extrémité de duplex
  contribue son incrément mesuré — aucune extrémité libre n'est ignorée.
- **Tm** : `ΔH/(ΔS + R·ln(Ct/4)) − 273.15 + 16.6·log₁₀[Na⁺]eq − 0.75·DMSO%`
  pour le duplex amorce–matrice ; dimères : `R·ln(Ct)` + symétrie (homodimères),
  `R·ln(Ct/2)` (hétérodimères).
- **Sels** : équivalent sodium de **von Ahsen 2001**,
  `[Na⁺]eq = [mono] + 120·√([Mg²⁺] − [dNTP])` (mM), avec clamp Mg²⁺ ≥ 0 —
  ou correction mixte mono/divalent **Owczarzy 2004/2008** (`salt_method:
'owczarzy'`, équilibre Ka Mg:dNTP, arbre de décision en R), plus proche
  de Primer3 sur toutes les sondes de référence.
- **Mismatches** : internes isolés (Allawi/SantaLucia/Peyret/Watkins, IMM) et
  terminaux (SantaLucia & Peyret 2001, TMM) ; tandems et bulges rompent
  l'empilement (bulge +3.0 kcal/mol).
- **Structures** : hairpins (tiges parfaites + pénalités de boucle de Turner,
  extrapolation Jacobson–Stockmayer au-delà de 9 nt), homo/hétéro-dimères
  (blocs + pontages + alignement DP thermodynamique Smith–Waterman,
  minimum global).
- **Seuils** : ΔG < −9 kcal/mol → alerte **critique** (hairpins, dimères) ;
  ΔG ≤ −6 → avertissement ; dimère critique aussi si ancré en 3′ avec ΔG < −7.
  Extrémité 3′ (fenêtre de 5 nt) : avertissement si ΔG°37 < −5, critique si
  ≤ −6 (échelle calibrée sur l'amplitude physique d'un pentamère, max ≈ −6.7).
- **IUPAC complet** : dégénérescence D = ∏nᵢ, Tm pondérée par abondance
  (approximation d'O'Donnell–Maloney, modes `mean|min|consensus`),
  structures évaluées sur le variant canonique. Les fonctions bas niveau
  (`bestDimer`, `bestHairpin`, `tracebackBestAlignment`) exigent de
  l'ACGT non ambigu (`AMBIGUOUS_SEQUENCE` sinon) ; les APIs haut niveau
  canonicalisent pour vous.
- **Biais 3′** : stabilité ΔG°37 du pentamère 3′-terminal + rapport de GC-clamp.

## ⚡ Architecture hybride (TypeScript + WASM + workers)

- **TypeScript pur par défaut** (`TypeScriptBackend`) : Node ≥ 18, Bun, navigateurs,
  zéro dépendance native. Les imports `node:` (workers, chargeur WASM) sont
  paresseux : le cœur d'analyse reste bundlable pour navigateur.
- **Cœur Rust compilé en WASM** (`wasm/` → `wasm-pkg/`, `WasmBackend`) : moteur
  dimères en parité stricte avec le TS (tests de parité bit-à-bit :
  `tests/wasm.test.ts`, `tests/wasm-web.test.ts`).
  - Node.js : `loadWasmBackend()` (URL explicite, package
    `@sfstudio_tools/primer-calc-wasm`, puis build local `wasm-pkg/`) avec repli
    automatique vers le moteur TS.
  - Navigateurs : build `wasm-pkg/web/` (`--target web`, fetch-based) +
    `loadWasmBackendWeb(urlGlue)` ; en bundler (Vite/webpack), importez la
    glue et construisez `new WasmBackend(mod)` après son initialisation.
  - Régénération : `npm run build:wasm` (toolchain Rust +
    target `wasm32-unknown-unknown` + CLI `wasm-bindgen`).
- **Multi-threading** :
  - Node : `MultiplexPool.evaluateCrossDimerizationParallel()` sur
    `node:worker_threads` (`tests/parallel.test.ts`).
  - Navigateurs : `crossDimerizationWebWorkers(primers, cond, workerUrl, opts, spawn)`
    avec `new Worker(url)` sur `dist/worker.js` (bundle IIFE auto-suffisant,
    `npm run build:worker`), même assemblage de résultats (`tests/webworkers.test.ts`).

## 🧪 Tests & CI

```bash
npm test             # Vitest : 225 tests (standards-or, cas limites, conformité spec)
npm run test:coverage  # build + couverture V8 : 100 % lignes/fonctions/branches
npm run build        # tsup + worker navigateur : ESM + CJS + .d.ts + dist/worker.js + dist/cli.js
npm run build:wasm   # Rust → wasm-pkg/ (cibles Node.js + navigateurs)
```

Jeux de validation :

- exemple duplex SantaLucia 1998 (`CGTTGA` : ΔH −40.9, ΔS −114.6) et
  ΔG°37 SantaLucia & Hicks 2004 ;
- table dangling ends Bommarito et al. 2000 ;
- **Benchmark croisé Primer3** (`tests/primer3.test.ts` + `tests/primer3-goldens.json`,
  gelés via primer3-py 2.3.1) : structure différentielle NN identique (≤ 0.05 °C),
  Tm absolus ≤ 2.5 °C (résidu documenté des révisions de tables 1998→2004
  sur les stacks mixtes), homodimères ΔG ≤ 1.5 kcal/mol, ordre de Tm
  identique en conditions PCR. Régénération :
  `python3 scripts/primer3-regen.py` (vérification : `--check`, job CI hebdomadaire) ;
  le package npm ne dépend jamais de Python.
- parité bit-à-bit TS ≡ WASM Node ≡ WASM web (`tests/wasm*.test.ts`),
  workers Node et navigateurs (`tests/parallel*.test.ts`, `tests/webworkers.test.ts`) ;
- GC 0 %/100 %, séquences très courtes/longues, IUPAC complexes,
  dégénérescence astronomique (`N×100`), conditions invalides.

L'intégration continue (`.github/workflows/ci.yml`, Node 18/20/22 × Ubuntu/macOS)
reproduit typecheck, build TS, build WASM + **vérifie l'équivalence fonctionnelle
de `wasm-pkg/` committé**, tests + couverture, et re-valide
les goldens Primer3 chaque semaine.

## 📄 Licence

Apache 2.0 — voir `LICENSE`.

## 📦 Publication

```bash
npm login
# Premier publish du scope : accès public requis.
npm publish --access public            # @sfstudio_tools/primer-calc
npm publish ./wasm-pkg --access public # @sfstudio_tools/primer-calc-wasm (optionnel)
# Avec GitHub Actions OIDC : ajouter --provenance aux deux commandes.
```

Vérifié sans credentials : `npm publish --dry-run` (23 fichiers, 163.6 kB,
`wasm/target/` exclu, `dist/` + `wasm-pkg/` inclus).
