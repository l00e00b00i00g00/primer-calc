import { describe, expect, it } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { App } from '../src/cli/App.js';
import { formatAnalysisText } from '../src/cli/format.js';
import { analyzePrimer } from '../src/analyze.js';

const tick = (ms = 80): Promise<void> => new Promise((r) => setTimeout(r, ms));

describe('TUI rendering', () => {
  it('shows English analysis results', () => {
    const { lastFrame } = render(<App initialLocale="en" initialSeq="ATGCGTAGCTAGCTAGCTA" />);
    const frame = lastFrame() ?? '';
    expect(frame).toContain('Analyze');
    expect(frame).toContain('Primer (5′→3′, IUPAC):');
  });

  it('renders French labels when requested', () => {
    const { lastFrame } = render(<App initialLocale="fr" />);
    const frame = lastFrame() ?? '';
    expect(frame).toContain('Analyser');
    expect(frame).toContain('Amorce (5′→3′, IUPAC) :');
  });

  it('opens on the multiplex tab on demand', () => {
    const { lastFrame } = render(
      <App
        initialLocale="en"
        initialTab="multiplex"
        initialPrimers={[
          { id: 'p1', seq: 'ATCGATCGATCGATCG' },
          { id: 'p2', seq: 'GCTAGCTAGCTAGCTA' },
        ]}
      />,
    );
    expect(lastFrame() ?? '').toContain('Cross-dimer');
  });

  it('analyzes a typed sequence on Enter', async () => {
    const { stdin, lastFrame } = render(<App initialLocale="en" />);
    stdin.write('ATGCGTAGCTAGCTAGCTA');
    await tick();
    stdin.write('\r');
    await tick();
    const frame = lastFrame() ?? '';
    expect(frame).toContain('54.98');
    expect(frame).toContain('47.4%');
  });

  it('shows a localized error for invalid sequences', async () => {
    const { stdin, lastFrame } = render(<App initialLocale="fr" />);
    stdin.write('ATGCX');
    await tick();
    stdin.write('\r');
    await tick();
    expect(lastFrame() ?? '').toContain('Séquence invalide');
  });

  it('cycles salt options with arrow keys', async () => {
    const { stdin, lastFrame } = render(<App initialLocale="en" />);
    await tick();
    for (let i = 0; i < 5; i++) {
      stdin.write('\u001b[B'); // down ×5 → salt row
      await tick();
    }
    stdin.write('\u001b[C'); // right → owczarzy
    await tick();
    expect(lastFrame() ?? '').toContain('[owczarzy]');
  });

  it('cycles languages with ctrl+l', async () => {
    const { stdin, lastFrame } = render(<App initialLocale="en" />);
    await tick();
    expect(lastFrame() ?? '').toContain('Analyze');
    stdin.write('\x0c'); // ctrl+l → fr
    await tick();
    expect(lastFrame() ?? '').toContain('Analyser');
  });

  it('adds a multiplex primer by typing id=seq', async () => {
    const { stdin, lastFrame } = render(<App initialLocale="en" initialTab="multiplex" />);
    await tick();
    stdin.write('p1=AAAAAAAAAAAAAAAAAAAA');
    await tick();
    stdin.write('\r');
    await tick();
    expect(lastFrame() ?? '').toContain('p1: AAAAAAAAAAAAAAAAAAAA');
  });
});

describe('formatAnalysisText', () => {
  it('summarizes an analysis in the requested locale', () => {
    const analysis = analyzePrimer('ATGCGTAGCTAGCTAGCTA');
    const en = formatAnalysisText('en', analysis);
    expect(en).toContain('Tm: 54.98 °C');
    expect(en).toContain('Warnings:');
    const fr = formatAnalysisText('fr', analysis);
    expect(fr).toContain('Alertes:');
    expect(fr).not.toContain('Warnings:');
  });

  it('renders clean and hairpin-free analyses', () => {
    const clean = formatAnalysisText('en', analyzePrimer('GCTCCGTGAGTCTAGGATCT'));
    expect(clean).toContain('No risks detected.');
    const short = formatAnalysisText('en', analyzePrimer('ATGC'));
    expect(short).toContain('Hairpin ΔG: –');
    const nodimer = formatAnalysisText('en', analyzePrimer('AAAAAAAAAAAAAAAAAAAA'));
    expect(nodimer).toContain('Homodimer ΔG: –');
  });
});
