import React, { useMemo, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import type { Locale } from '../i18n/types.js';
import { translate as t } from '../i18n/index.js';
import { MultiplexPool } from '../MultiplexPool.js';
import { normalizeSequence } from '../sequence/validate.js';
import { hl } from './ui.js';
import { formatNumber } from '../i18n/numbers.js';
import type { PoolPrimer } from '../types.js';

function cellColor(deltaG: number): 'red' | 'yellow' | 'green' {
  if (deltaG < -9) return 'red';
  if (deltaG <= -6) return 'yellow';
  return 'green';
}

export function MultiplexScreen({
  locale,
  initialPrimers = [],
}: {
  locale: Locale;
  initialPrimers?: PoolPrimer[];
}) {
  const [primers, setPrimers] = useState<PoolPrimer[]>(initialPrimers);
  const [draft, setDraft] = useState('');
  const [sel, setSel] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const report = useMemo(() => {
    if (primers.length === 0) return null;
    try {
      return new MultiplexPool(primers).evaluateCrossDimerization();
    } catch {
      return null;
    }
  }, [primers]);

  useInput((input, key) => {
    if (key.upArrow) setSel((s) => Math.max(0, s - 1));
    else if (key.downArrow) setSel((s) => s + 1);
    else if (key.return && draft.trim().length > 0) {
      const eq = draft.indexOf('=');
      const id = (eq >= 0 ? draft.slice(0, eq) : `p${primers.length + 1}`).trim();
      const seq = (eq >= 0 ? draft.slice(eq + 1) : draft).trim();
      try {
        if (primers.some((p) => p.id === id)) throw new Error(t(locale, 'mxDuplicate'));
        const clean = normalizeSequence(seq);
        setPrimers((ps) => [...ps, { id, seq: clean }]);
        setDraft('');
        setError(null);
        setSel(primers.length);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    } else if (input === 'x' && draft === '' && primers.length > 0) {
      const idx = Math.min(sel, primers.length - 1);
      setPrimers((ps) => ps.filter((_, i) => i !== idx));
      setSel((s) => Math.max(0, Math.min(s, primers.length - 2)));
    }
  });

  return (
    <Box flexDirection="column">
      <Box>
        <Box width={16}>
          <Text bold>{t(locale, 'mxAddLabel')}</Text>
        </Box>
        <TextInput
          value={draft}
          onChange={setDraft}
          placeholder={t(locale, 'mxAddPlaceholder')}
          focus
        />
      </Box>
      <Box>
        <Text dimColor>
          {t(locale, 'mxAddHint')} · {t(locale, 'mxRemoveHint')}
        </Text>
      </Box>
      {error !== null && <Text color="red">{error}</Text>}
      <Box marginTop={1} flexDirection="column">
        <Text bold underline>
          {t(locale, 'mxListTitle')} ({primers.length})
        </Text>
        {primers.length === 0 && <Text dimColor>{t(locale, 'mxEmpty')}</Text>}
        {primers.map((p, i) => (
          <Text key={p.id} {...hl(i === sel)}>
            {i === sel ? '› ' : '  '}
            {p.id}: {p.seq}
          </Text>
        ))}
      </Box>
      {report !== null && (
        <Box marginTop={1} flexDirection="column">
          <Text bold underline>
            {t(locale, 'mxMatrixTitle')}
          </Text>
          {report.ids.map((id, i) => (
            <Text key={id}>
              {(id as string).slice(0, 10).padEnd(11)}
              {(report.matrix[i] as (number | null)[]).map((v, j) =>
                v === null ? (
                  <Text key={j} dimColor>
                    {'   · '}
                  </Text>
                ) : (
                  <Text key={j} color={cellColor(v)}>
                    {`${formatNumber(locale, v, 1).padStart(6)} `}
                  </Text>
                ),
              )}
            </Text>
          ))}
          <Box marginTop={1} flexDirection="column">
            <Text bold underline>
              {t(locale, 'mxConflictsTitle')}
            </Text>
            {report.conflicts.length === 0 && (
              <Text color="green">{t(locale, 'mxConflictsNone')}</Text>
            )}
            {report.conflicts.map((c, i) => (
              <Text key={i} color={c.severity === 'critical' ? 'red' : 'yellow'}>
                {c.primerA}×{c.primerB} ΔG={formatNumber(locale, c.deltaG, 2)}
              </Text>
            ))}
          </Box>
        </Box>
      )}
    </Box>
  );
}
