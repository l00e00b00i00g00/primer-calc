/** Parsed command-line arguments for the `primer-calc` binary. */
export interface CliArgs {
  /** Positional primer sequence (quick analysis mode). */
  seq?: string;
  /** `--lang` override (BCP 47 tag, e.g. `fr`, `pt-BR`). */
  lang?: string;
  /** `--json`: print analysis as JSON and exit. */
  json: boolean;
  /** `--help` / `-h`. */
  help: boolean;
  /** `--version` / `-V`. */
  version: boolean;
  /** Unknown-flag error message (English; localized at render). */
  error?: string;
}

/**
 * Pure CLI argument parser (no I/O, fully tested).
 * First non-flag token is the sequence; flags may come in any order.
 */
export function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { json: false, help: false, version: false };
  let i = 0;
  while (i < argv.length) {
    const token = argv[i] as string;
    if (token === '--json') {
      args.json = true;
    } else if (token === '--help' || token === '-h') {
      args.help = true;
    } else if (token === '--version' || token === '-V') {
      args.version = true;
    } else if (token === '--lang') {
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('-')) {
        args.error = 'Missing value for --lang (expected a locale code).';
        return args;
      }
      args.lang = next;
      i++;
    } else if (token.startsWith('--lang=')) {
      const value = token.slice('--lang='.length);
      if (value === '') {
        args.error = 'Missing value for --lang (expected a locale code).';
        return args;
      }
      args.lang = value;
    } else if (token.startsWith('-')) {
      args.error = `Unknown option: ${token}.`;
      return args;
    } else if (args.seq === undefined) {
      args.seq = token;
    } else {
      args.error = `Unexpected argument: ${token}.`;
      return args;
    }
    i++;
  }
  return args;
}
