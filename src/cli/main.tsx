import React from 'react';
import { render } from 'ink';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { App } from './App.js';
import { parseArgs } from './parse.js';
import { formatAnalysisText } from './format.js';
import { detectLocale, resolveLocale, translate as t } from '../i18n/index.js';
import type { Locale } from '../i18n/types.js';
import { analyzePrimer } from '../analyze.js';

function packageVersion(): string {
  try {
    // ESM bundle: resolve package.json relative to this module.
    const dir = dirname(fileURLToPath(import.meta.url));
    const pkg = JSON.parse(readFileSync(join(dir, '..', 'package.json'), 'utf8')) as {
      version?: string;
    };
    return pkg.version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

function printHelp(locale: Locale): void {
  const lines = [
    t(locale, 'cliUsage'),
    '',
    t(locale, 'cliOptions'),
    `  ${t(locale, 'cliLang')}`,
    `  ${t(locale, 'cliJson')}`,
    `  ${t(locale, 'cliHelp')}`,
    `  --version       ${packageVersion()}`,
  ];
  process.stdout.write(lines.join('\n') + '\n');
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const locale: Locale = args.lang
    ? resolveLocale(args.lang)
    : detectLocale(process.env, Intl.DateTimeFormat().resolvedOptions().locale);
  if (args.error) {
    process.stderr.write(`${args.error}\n`);
    process.exitCode = 2;
    return;
  }
  if (args.help) {
    printHelp(locale);
    return;
  }
  if (args.version) {
    process.stdout.write(`${packageVersion()}\n`);
    return;
  }
  if (args.seq !== undefined) {
    try {
      const analysis = analyzePrimer(args.seq);
      if (args.json) {
        process.stdout.write(JSON.stringify(analysis, null, 2) + '\n');
      } else {
        process.stdout.write(formatAnalysisText(locale, analysis) + '\n');
      }
    } catch (err) {
      process.stderr.write(
        t(locale, 'errInvalid', { error: err instanceof Error ? err.message : String(err) }) + '\n',
      );
      process.exitCode = 1;
    }
    return;
  }
  render(<App initialLocale={locale} />);
}

main();
