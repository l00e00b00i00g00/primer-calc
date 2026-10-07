import type { AnalysisWarning } from '../types.js';
import type { Locale, Messages } from './types.js';
import { localizeNumberString } from './numbers.js';
import { LOCALES } from './types.js';
import { en } from './locales/en.js';
import { fr } from './locales/fr.js';
import { es } from './locales/es.js';
import { zh } from './locales/zh.js';
import { ar } from './locales/ar.js';
import { ru } from './locales/ru.js';
import { pt } from './locales/pt.js';
import { de } from './locales/de.js';

const DICTS: Record<Locale, Messages> = { en, fr, es, zh, ar, ru, pt, de };

export { LOCALES };
export type { Locale, Messages };

/** All supported locale codes, in UI order. */
export const LOCALE_CODES: readonly Locale[] = LOCALES.map((l) => l.code);

/** Normalizes any BCP 47-ish tag to a supported locale (English fallback). */
export function resolveLocale(tag: string | undefined | null): Locale {
  if (!tag) return 'en';
  const base = tag
    .toLowerCase()
    .replace('_', '-')
    .split('-')[0]
    ?.replace(/[^a-z]/g, '');
  if (base === 'zh') return 'zh';
  const found = (LOCALE_CODES as readonly string[]).find((c) => c === base);
  return (found ?? 'en') as Locale;
}
/**
 * Detects the system language, terminal convention first:
 * `LC_ALL` → `LC_MESSAGES` → `LANG` (Linux/macOS), then the
 * `Intl`-provided locale (covers Windows regional settings), else English.
 * Empty variables count as unset (POSIX gettext semantics).
 */
export function detectLocale(
  env: Record<string, string | undefined> = process.env,
  intlLocale?: string,
): Locale {
  const fromEnv = env.LC_ALL || env.LC_MESSAGES || env.LANG || env.LANGUAGE || null;
  // An explicit terminal setting always wins — including explicit English.
  if (fromEnv) return resolveLocale(fromEnv.split(':')[0]);
  if (intlLocale) return resolveLocale(intlLocale);
  return 'en';
}

/** Message dictionary for a locale (English fallback per key). */
export function messages(locale: Locale): Messages {
  return DICTS[locale] ?? DICTS.en;
}

/** Interpolates `{name}` placeholders (dictionaries are compile-time complete). */
export function translate(
  locale: Locale,
  key: keyof Messages,
  vars?: Record<string, string | number>,
): string {
  const text0: string = messages(locale)[key];
  let text = text0;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      text = text.split(`{${k}}`).join(String(v));
    }
  }
  return text;
}

/** Warning code → dictionary key for localized rendering. */
const WARNING_KEYS: Record<string, keyof Messages> = {
  SEQUENCE_TOO_SHORT: 'wSequenceTooShort',
  SEQUENCE_TOO_LONG: 'wSequenceTooLong',
  GC_CONTENT_SUBOPTIMAL: 'wGcContentSuboptimal',
  TM_OUT_OF_RANGE: 'wTmOutOfRange',
  HIGH_DEGENERACY: 'wHighDegeneracy',
  STABLE_HAIRPIN: 'wStableHairpin',
  STABLE_HOMODIMER: 'wStableHomodimer',
  HOMODIMER_3P_ANCHORED: 'wHomodimer3pAnchored',
  STABLE_3P_END: 'wStable3pEnd',
  NO_GC_CLAMP: 'wNoGcClamp',
  TARGET_NO_BINDING: 'wTargetNoBinding',
  TARGET_3P_MISMATCH: 'wTarget3pMismatch',
  TARGET_3P_FLAP: 'wTarget3pFlap',
  TARGET_HIGH_DIVERGENCE: 'wTargetHighDivergence',
  TARGET_WEAK_BINDING: 'wTargetWeakBinding',
  PAIR_TM_MISMATCH: 'wPairTmMismatch',
  PAIR_CROSS_DIMER: 'wPairCrossDimer',
};

/**
 * Renders an analysis warning in the given locale, extracting template
 * variables from the English message. Unknown codes fall back to the
 * original message.
 */
export function translateWarning(locale: Locale, warning: AnalysisWarning): string {
  const key = WARNING_KEYS[warning.code];
  if (!key) return warning.message;
  const msg = warning.message;
  const firstNum = (m: string): string | undefined => m.match(/-?\d+(?:\.\d+)?/)?.[0];
  const eqNum = (m: string): string | undefined => m.match(/=(-?\d+(?:\.\d+)?)/)?.[1];
  const vars: Record<string, string> = {};
  const set = (name: string, value: string | undefined): void => {
    if (value !== undefined) vars[name] = value;
  };
  switch (warning.code) {
    case 'SEQUENCE_TOO_SHORT':
    case 'SEQUENCE_TOO_LONG':
      set('length', firstNum(msg));
      break;
    case 'GC_CONTENT_SUBOPTIMAL':
      set('gc', firstNum(msg));
      break;
    case 'TM_OUT_OF_RANGE':
      set('tm', firstNum(msg));
      break;
    case 'HIGH_DEGENERACY':
      set('factor', firstNum(msg));
      break;
    case 'STABLE_HAIRPIN': {
      const nums = msg.match(/-?\d+(?:\.\d+)?/g) ?? [];
      set('dg', nums[0]);
      set('stem', nums[1]);
      set('loop', nums[2]);
      break;
    }
    case 'STABLE_HOMODIMER':
    case 'PAIR_CROSS_DIMER':
      set('dg', eqNum(msg));
      break;
    case 'STABLE_3P_END':
      // Avoid the "°37" in "ΔG°37=…": take the value after '='.
      set('dg', eqNum(msg));
      break;
    case 'TARGET_HIGH_DIVERGENCE':
      set('count', firstNum(msg));
      break;
    case 'TARGET_WEAK_BINDING':
      set('dg', eqNum(msg));
      set('temp', msg.match(/at (-?\d+(?:\.\d+)?) °C/)?.[1]);
      break;
    case 'PAIR_TM_MISMATCH': {
      const nums = msg.match(/-?\d+(?:\.\d+)?/g) ?? [];
      set('gap', nums[0]);
      set('tol', nums[1]);
      vars.unit = msg.includes('°F') ? 'F' : 'C';
      break;
    }
    default:
      break; // no variables (info texts, anchored flag, no-binding, …)
  }
  // Localize numeric slots (units stay raw); then never leak placeholders:
  // a partially-filled template falls back to the original message.
  for (const name of Object.keys(vars)) {
    if (name !== 'unit') vars[name] = localizeNumberString(locale, vars[name] as string);
  }
  const rendered = translate(locale, key, vars);
  return /\{[^}]+\}/.test(rendered) ? warning.message : rendered;
}

/** Localized severity label. */
export function translateSeverity(locale: Locale, severity: AnalysisWarning['severity']): string {
  return translate(
    locale,
    severity === 'critical' ? 'sevCritical' : severity === 'warning' ? 'sevWarning' : 'sevInfo',
  );
}
