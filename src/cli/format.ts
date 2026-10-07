import type { Locale } from '../i18n/types.js';
import { translate as t, translateWarning, translateSeverity } from '../i18n/index.js';
import { formatNumber } from '../i18n/numbers.js';
import type { PrimerAnalysis } from '../types.js';

/** Plain-text analysis summary for non-interactive CLI output. */
export function formatAnalysisText(locale: Locale, analysis: PrimerAnalysis): string {
  const num = (value: number, digits: number): string => formatNumber(locale, value, digits);
  const lines = [
    `${t(locale, 'resTm')}: ${num(analysis.tm, 2)} °${analysis.tmUnit}`,
    `${t(locale, 'resGc')}: ${num(analysis.gcContent, 1)}%`,
    `${t(locale, 'resHairpin')}: ${analysis.hairpin.deltaG === null ? '–' : num(analysis.hairpin.deltaG, 2)}`,
    `${t(locale, 'resHomodimer')}: ${analysis.homodimer.deltaG === null ? '–' : num(analysis.homodimer.deltaG, 2)}`,
    `${t(locale, 'resWarnings')}:`,
  ];
  if (analysis.warnings.length === 0) {
    lines.push(`- ${t(locale, 'resNoWarnings')}`);
  } else {
    for (const w of analysis.warnings) {
      lines.push(`- [${translateSeverity(locale, w.severity)}] ${translateWarning(locale, w)}`);
    }
  }
  return lines.join('\n');
}
