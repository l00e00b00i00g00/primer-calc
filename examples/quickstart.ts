/**
 * Quickstart example (spec §installation & §4).
 * Run with: npm run example  (tsx examples/quickstart.ts)
 */
import { PrimerAnalyzer, MultiplexPool, analyzePrimer, calculateTm } from '../src/index.js';

// 1. Calcul rapide de la température de fusion (Tm)
const tm = calculateTm('ATGCGTAGCTAGCTAGCTA');
console.log(`Température de fusion : ${tm.toFixed(2)} °C`);

// 2. Analyse complète (structures secondaires, GC%, etc.)
const analysis = analyzePrimer('ATGCGTAGCTAGCTAGCTA');
console.log('Rapport d’analyse :', JSON.stringify(analysis, null, 2));

// 3. Analyseur configuré + pool multiplex (spec §4)
const analyzer = new PrimerAnalyzer({
  na_conc: 50, // mM
  mg_conc: 2.5, // mM (correction de von Ahsen)
  dNTPs_conc: 0.8, // mM
  primer_conc: 200, // nM
  temp_unit: 'C',
});

const result = analyzer.evaluate('ATGCGTAGCTAGCTAGCTA');
console.log(`Tm (SantaLucia): ${result.tm.toFixed(2)} °C`);
console.log(`GC Content: ${result.gcContent.toFixed(1)}%`);
console.log(`Free Energy Hairpin: ${result.hairpin.deltaG?.toFixed(2) ?? 'n/a'} kcal/mol`);
if (result.hasRisks) {
  console.warn('Avertissements détectés :', result.warnings);
}

const pool = new MultiplexPool([
  { id: 'primer_fwd_1', seq: 'ATCGATCGATCGATCG' },
  { id: 'primer_rev_1', seq: 'GCTAGCTAGCTAGCTA' },
]);
const crossCheck = pool.evaluateCrossDimerization();
if (crossCheck.hasCrossDimers) {
  console.error('Risque de dimérisation croisée détecté entre :', crossCheck.conflicts);
} else {
  console.log('Pool multiplex : aucune dimérisation croisée détectée.');
}
