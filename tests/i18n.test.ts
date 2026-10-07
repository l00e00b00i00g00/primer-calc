import { describe, expect, it } from 'vitest';
import {
  detectLocale,
  resolveLocale,
  translate,
  translateWarning,
  translateSeverity,
  messages,
  LOCALE_CODES,
  type Locale,
} from '../src/i18n/index.js';
import { formatNumber, localizeNumberString } from '../src/i18n/numbers.js';
import type { AnalysisWarning } from '../src/types.js';
import { analyzePrimer } from '../src/analyze.js';
import { analyzePrimerPair } from '../src/pair.js';
import { evaluateAgainstTarget } from '../src/target.js';

describe('resolveLocale', () => {
  it('normalizes tags with English fallback', () => {
    expect(resolveLocale('fr_FR.UTF-8')).toBe('fr');
    expect(resolveLocale('fr-FR')).toBe('fr');
    expect(resolveLocale('zh_CN.UTF-8')).toBe('zh');
    expect(resolveLocale('pt_BR')).toBe('pt');
    expect(resolveLocale('xx')).toBe('en');
    expect(resolveLocale(null)).toBe('en');
    expect(resolveLocale(undefined)).toBe('en');
  });

  it('covers every declared locale', () => {
    expect(LOCALE_CODES).toEqual(['en', 'fr', 'es', 'zh', 'ar', 'ru', 'pt', 'de']);
  });
});

describe('detectLocale', () => {
  it('prefers LC_ALL, then LC_MESSAGES, then LANG', () => {
    expect(detectLocale({ LC_ALL: 'es_ES.UTF-8', LANG: 'fr_FR.UTF-8' })).toBe('es');
    expect(detectLocale({ LC_MESSAGES: 'de_DE.UTF-8', LANG: 'fr_FR.UTF-8' })).toBe('de');
    expect(detectLocale({ LANG: 'ru_RU.UTF-8' })).toBe('ru');
    expect(detectLocale({ LANG: 'C' })).toBe('en');
    expect(detectLocale({})).toBe('en');
  });

  it('treats empty variables as unset (POSIX gettext semantics)', () => {
    expect(detectLocale({ LC_ALL: '', LANG: 'fr_FR.UTF-8' })).toBe('fr');
    expect(detectLocale({ LC_ALL: '', LC_MESSAGES: '', LANG: '' })).toBe('en');
  });

  it('lets an explicit terminal setting beat Intl', () => {
    expect(detectLocale({ LANG: 'en_US.UTF-8' }, 'fr-FR')).toBe('en');
  });

  it('falls back to the Intl locale (Windows regional settings)', () => {
    expect(detectLocale({}, 'pt-BR')).toBe('pt');
    expect(detectLocale({}, 'en-US')).toBe('en');
  });
});

describe('translate', () => {
  it('interpolates and falls back per key', () => {
    expect(translate('fr', 'footerLang', { lang: 'fr' })).toBe('ctrl+l langue (fr)');
    expect(translate('zh', 'resTm')).toBe('Tm');
  });
});

describe('locale numbers (Intl, Latin digits forced)', () => {
  it('formats decimals per locale', () => {
    expect(formatNumber('en', 54.98, 2)).toBe('54.98');
    expect(formatNumber('fr', 54.98, 2)).toBe('54,98');
    expect(formatNumber('de', 54.98, 2)).toBe('54,98');
    expect(formatNumber('ar', 54.98, 2)).toBe('54.98');
    expect(formatNumber('en', 8, 0)).toBe('8');
  });

  it('preserves precision from decimal strings', () => {
    expect(localizeNumberString('fr', '-10.25')).toBe('-10,25');
    expect(localizeNumberString('fr', '8')).toBe('8');
    expect(localizeNumberString('en', '54.98')).toBe('54.98');
    expect(localizeNumberString('fr', 'n/a')).toBe('n/a');
  });
});

describe('translateWarning', () => {
  const all: Locale[] = ['en', 'fr', 'es', 'zh', 'ar', 'ru', 'pt', 'de'];

  /** Real engine warnings covering every warning code. */
  function everyWarning(): AnalysisWarning[] {
    const out: AnalysisWarning[] = [];
    out.push(...analyzePrimer('GCGCGCGCTATGCGCGCGC').warnings);
    out.push(...analyzePrimer('ATGCATGCATGC').warnings); // too short
    out.push(...analyzePrimer('ATGC'.repeat(10)).warnings); // too long
    out.push(...analyzePrimer('AAAAAAAAAAAAAAAAAAAA').warnings); // GC + Tm
    out.push(...analyzePrimer('NNNNNNNN').warnings); // degeneracy
    out.push(...analyzePrimer('GCGCGCGC').warnings); // homodimer
    out.push(...analyzePrimer('ATATATATATATATATGGGGG').warnings); // 3' end
    out.push(...evaluateAgainstTarget('ATGCGTAGCTAG', 'CTATCTACTCAT').warnings);
    out.push(...evaluateAgainstTarget('TTTGACAGCCTCTGAC', 'ATCAGAGGCTGTCAAA').warnings); // 3' mismatch
    out.push(
      ...evaluateAgainstTarget('ATGCGTAGCTAGCTAGCTAGCTAG', 'CTCGCTAACTAACTAGATAGAAT').warnings,
    ); // high divergence
    out.push(...evaluateAgainstTarget('AAAAAAAAAAAA', 'AAAAAAAAAAAA').warnings);
    out.push(...analyzePrimerPair('ATGCGTAGCTAGCTAGCTA', 'GCTAGCTAGCTAGCTA').warnings);
    return out;
  }

  it('renders every warning code in every locale without raw placeholders', () => {
    const warnings = everyWarning();
    const codes = new Set(warnings.map((w) => w.code));
    // All 17 warning codes must appear at least once.
    expect(codes.size).toBe(17);
    for (const locale of all) {
      for (const w of warnings) {
        const text = translateWarning(locale, w);
        expect(text).not.toContain('{');
        expect(text).not.toContain('}');
        expect(text.length).toBeGreaterThan(0);
      }
    }
  });

  it('extracts template variables faithfully (French spot-check)', () => {
    const hairpin: AnalysisWarning = {
      code: 'STABLE_HAIRPIN',
      severity: 'critical',
      message: 'Stable hairpin ΔG=-10.25 kcal/mol (stem 8 bp, loop 3 nt) may inhibit PCR.',
    };
    expect(translateWarning('fr', hairpin)).toBe(
      'Hairpin stable ΔG=-10,25 kcal/mol (tige 8 pb, boucle 3 nt).',
    );
    const three: AnalysisWarning = {
      code: 'STABLE_3P_END',
      severity: 'warning',
      message: 'Over-stable 3′ end (pentamer ΔG°37=-5.35 kcal/mol): mispriming risk.',
    };
    expect(translateWarning('fr', three)).toBe(
      'Extrémité 3′ trop stable (ΔG°37=-5,35 kcal/mol) : risque de faux amorçage.',
    );
    const pair: AnalysisWarning = {
      code: 'PAIR_TM_MISMATCH',
      severity: 'warning',
      message: 'Forward/reverse Tm gap 13.4 °F exceeds 9.0 °F.',
    };
    expect(translateWarning('fr', pair)).toBe('Écart Tm forward/reverse 13,4 °F, limite 9,0 °F.');
  });

  it('falls back to the original message for unknown codes', () => {
    const w: AnalysisWarning = { code: 'NOPE', severity: 'info', message: 'raw text' };
    expect(translateWarning('fr', w)).toBe('raw text');
  });

  it('tolerates number-less messages in numeric templates', () => {
    const hairpin: AnalysisWarning = {
      code: 'STABLE_HAIRPIN',
      severity: 'warning',
      message: 'weird message without numbers',
    };
    // Partially-filled templates fall back to the original message.
    expect(translateWarning('en', hairpin)).toBe('weird message without numbers');
    const pair: AnalysisWarning = {
      code: 'PAIR_TM_MISMATCH',
      severity: 'warning',
      message: 'no numbers here',
    };
    expect(translateWarning('en', pair)).toBe('no numbers here');
  });

  it('falls back to English for unknown locales', () => {
    expect(messages('xx' as Locale).resTm).toBe('Tm');
  });

  it('localizes severities', () => {
    expect(translateSeverity('fr', 'critical')).toBe('CRITIQUE');
    expect(translateSeverity('es', 'warning')).toBe('aviso');
  });
});
