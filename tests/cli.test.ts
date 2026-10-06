import { describe, expect, it } from 'vitest';
import { parseArgs } from '../src/cli/parse.js';

describe('parseArgs', () => {
  it('parses a bare sequence', () => {
    expect(parseArgs(['ATGC'])).toMatchObject({ seq: 'ATGC', json: false });
  });

  it('parses flags in any order', () => {
    const a = parseArgs(['--json', '--lang', 'fr', 'ATGC']);
    expect(a).toMatchObject({ seq: 'ATGC', lang: 'fr', json: true });
    expect(parseArgs(['--lang=pt-BR', '--help'])).toMatchObject({
      lang: 'pt-BR',
      help: true,
    });
    expect(parseArgs(['-h'])).toMatchObject({ help: true });
    expect(parseArgs(['-V'])).toMatchObject({ version: true });
  });

  it('rejects unknown flags, missing values and extra positionals', () => {
    expect(parseArgs(['--nope']).error).toMatch(/Unknown option/);
    expect(parseArgs(['--lang']).error).toMatch(/Missing value/);
    expect(parseArgs(['--lang', '--json']).error).toMatch(/Missing value/);
    expect(parseArgs(['--lang=']).error).toMatch(/Missing value/);
    expect(parseArgs(['A', 'B']).error).toMatch(/Unexpected argument/);
  });

  it('defaults to an empty TUI launch', () => {
    const args = parseArgs([]);
    expect(args.seq).toBeUndefined();
    expect(args).toMatchObject({ json: false, help: false, version: false });
  });
});
