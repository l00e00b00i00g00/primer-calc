/**
 * Shared presentational helpers for CLI screens (no logic, no side effects).
 */

/** Highlight props preserving exact visuals (ink disallows explicit undefined). */
export function hl(on: boolean): { color?: 'cyan'; bold?: boolean } {
  return on ? { color: 'cyan', bold: true } : {};
}
