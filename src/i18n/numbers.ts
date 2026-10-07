import type { Locale } from './types.js';

/**
 * Locale-aware number formatting for display layers (TUI, CLI text).
 * Latin digits are forced (standard in scientific contexts, including
 * Arabic and Chinese locales) with locale-appropriate decimal separators
 * and no thousands grouping.
 */
export function formatNumber(locale: Locale, value: number, fractionDigits: number): string {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
    numberingSystem: 'latn',
    useGrouping: false,
  }).format(value);
}

/**
 * Localizes a decimal string while preserving its precision
 * ("-10.25" → fr "-10,25", integers pass through unchanged).
 * Unparseable input is returned as-is (never throws on display paths).
 */
export function localizeNumberString(locale: Locale, text: string): string {
  const match = text.match(/^(-?\d+)(?:\.(\d+))?$/);
  if (!match) return text;
  // The regex above only matches finite plain decimals.
  const decimals = match[2]?.length ?? 0;
  return formatNumber(locale, Number(text), decimals);
}
