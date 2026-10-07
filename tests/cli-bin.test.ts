import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const bin = new URL('../bin/primer-calc.js', import.meta.url);
const distBuilt = existsSync(bin) && existsSync(new URL('../dist/cli.js', import.meta.url));

function run(args: string[], lang?: string): { code: number | null; out: string; err: string } {
  const env: Record<string, string | undefined> = { ...process.env };
  delete env.LC_ALL;
  delete env.LC_MESSAGES;
  delete env.LANGUAGE;
  if (lang !== undefined) {
    env.LANG = lang;
  } else {
    delete env.LANG;
  }
  try {
    const out = execFileSync(process.execPath, [bin.pathname, ...args], {
      encoding: 'utf8',
      env,
      timeout: 30000,
    }) as string;
    return { code: 0, out, err: '' };
  } catch (e) {
    const err = e as { status?: number | null; stdout?: string; stderr?: string };
    return {
      code: err.status ?? 1,
      out: String(err.stdout ?? ''),
      err: String(err.stderr ?? ''),
    };
  }
}

describe.runIf(distBuilt)('primer-calc binary (spawned)', () => {
  it('prints localized help', () => {
    const en = run(['--help']);
    expect(en.code).toBe(0);
    expect(en.out).toContain('Usage:');
    const fr = run(['--help'], 'fr_FR.UTF-8');
    expect(fr.code).toBe(0);
    expect(fr.out).toContain('Usage :');
  });

  it('detects Spanish from the environment', () => {
    const es = run(['--help'], 'es_ES.UTF-8');
    expect(es.out).toContain('Uso:');
  });

  it('honours --lang over the environment', () => {
    const r = run(['--lang', 'de', '--help'], 'fr_FR.UTF-8');
    expect(r.out).toContain('Aufruf:');
  });

  it('prints the package version', () => {
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
      version: string;
    };
    const r = run(['--version']);
    expect(r.code).toBe(0);
    expect(r.out.trim()).toBe(pkg.version);
  });

  it('analyzes a sequence argument as text and JSON', () => {
    const text = run(['ATGCGTAGCTAGCTAGCTA']);
    expect(text.code).toBe(0);
    expect(text.out).toContain('Tm: 54.98');
    const json = run(['ATGCGTAGCTAGCTAGCTA', '--json']);
    expect(json.code).toBe(0);
    const parsed = JSON.parse(json.out) as { tm: number; sequence: string };
    expect(parsed.tm).toBeCloseTo(54.98, 1);
    expect(parsed.sequence).toBe('ATGCGTAGCTAGCTAGCTA');
  });

  it('rejects invalid sequences (exit 1) and flags (exit 2)', () => {
    const bad = run(['ATGCX']);
    expect(bad.code).toBe(1);
    expect(bad.err).toContain('Invalid sequence');
    const flag = run(['--nope']);
    expect(flag.code).toBe(2);
    expect(flag.err).toContain('Unknown option');
  });
});
