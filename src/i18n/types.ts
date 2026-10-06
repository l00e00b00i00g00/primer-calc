/** Supported UI locales (BCP 47 base codes). */
export type Locale = 'en' | 'fr' | 'es' | 'zh' | 'ar' | 'ru' | 'pt' | 'de';

export const LOCALES: ReadonlyArray<{ code: Locale; label: string; dir: 'ltr' | 'rtl' }> = [
  { code: 'en', label: 'English', dir: 'ltr' },
  { code: 'fr', label: 'Français', dir: 'ltr' },
  { code: 'es', label: 'Español', dir: 'ltr' },
  { code: 'zh', label: '中文', dir: 'ltr' },
  { code: 'ar', label: 'العربية', dir: 'rtl' },
  { code: 'ru', label: 'Русский', dir: 'ltr' },
  { code: 'pt', label: 'Português', dir: 'ltr' },
  { code: 'de', label: 'Deutsch', dir: 'ltr' },
];

/**
 * Full UI message dictionary. Every locale file must satisfy this shape,
 * so missing keys fail compilation — never silently at runtime.
 * `{name}` placeholders are filled by `translate()`.
 */
export interface Messages {
  appTitle: string;
  tabAnalyze: string;
  tabMultiplex: string;
  tabHelp: string;
  footerQuit: string;
  footerTab: string;
  footerLang: string;
  anSeqLabel: string;
  anSeqPlaceholder: string;
  anNa: string;
  anMg: string;
  anDntp: string;
  anConc: string;
  anSalt: string;
  anUnit: string;
  saltVonAhsen: string;
  saltOwczarzy: string;
  saltNone: string;
  anHint: string;
  resTitle: string;
  resTm: string;
  resGc: string;
  resThermo: string;
  resHairpin: string;
  resHomodimer: string;
  resThreePrime: string;
  resDegeneracy: string;
  resWarnings: string;
  resNoWarnings: string;
  resNone: string;
  resAnchored: string;
  resNotAnchored: string;
  errInvalid: string;
  mxListTitle: string;
  mxAddLabel: string;
  mxAddPlaceholder: string;
  mxAddHint: string;
  mxRemoveHint: string;
  mxMatrixTitle: string;
  mxConflictsTitle: string;
  mxConflictsNone: string;
  mxEmpty: string;
  mxAdded: string;
  mxRemoved: string;
  mxDuplicate: string;
  helpTitle: string;
  helpQuit: string;
  helpTab: string;
  helpNav: string;
  helpEdit: string;
  helpLang: string;
  helpAdd: string;
  helpRemove: string;
  helpEval: string;
  sevInfo: string;
  sevWarning: string;
  sevCritical: string;
  wSequenceTooShort: string;
  wSequenceTooLong: string;
  wGcContentSuboptimal: string;
  wTmOutOfRange: string;
  wHighDegeneracy: string;
  wStableHairpin: string;
  wStableHomodimer: string;
  wHomodimer3pAnchored: string;
  wStable3pEnd: string;
  wNoGcClamp: string;
  wTargetNoBinding: string;
  wTarget3pMismatch: string;
  wTarget3pFlap: string;
  wTargetHighDivergence: string;
  wTargetWeakBinding: string;
  wPairTmMismatch: string;
  wPairCrossDimer: string;
  cliUsage: string;
  cliOptions: string;
  cliLang: string;
  cliJson: string;
  cliHelp: string;
}
