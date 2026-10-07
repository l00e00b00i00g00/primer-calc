import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import type { Locale } from '../i18n/types.js';
import { translate as t, translateWarning, translateSeverity } from '../i18n/index.js';
import { PrimerAnalyzer } from '../PrimerAnalyzer.js';
import type { PrimerAnalysis, SaltMethod, TempUnit } from '../types.js';
import { hl } from './ui.js';
import { formatNumber } from '../i18n/numbers.js';

const SALTS: SaltMethod[] = ['vonAhsen', 'owczarzy', 'none'];
const UNITS: TempUnit[] = ['C', 'F'];
const FIELD_COUNT = 7;

function saltLabel(locale: Locale, method: SaltMethod): string {
  return method === 'vonAhsen'
    ? t(locale, 'saltVonAhsen')
    : method === 'owczarzy'
      ? t(locale, 'saltOwczarzy')
      : t(locale, 'saltNone');
}

function fmtDeltaG(locale: Parameters<typeof formatNumber>[0], value: number | null): string {
  return value === null ? '–' : formatNumber(locale, value, 2);
}

function WarnRow({
  locale,
  code,
  severity,
  message,
}: {
  locale: Locale;
  code: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
}) {
  const color = severity === 'critical' ? 'red' : severity === 'warning' ? 'yellow' : 'gray';
  return (
    <Text>
      <Text color={color} bold={severity === 'critical'}>
        [{translateSeverity(locale, severity)}]
      </Text>
      <Text> {translateWarning(locale, { code, severity, message })}</Text>
    </Text>
  );
}

export function AnalyzeScreen({
  locale,
  initialSeq = '',
}: {
  locale: Locale;
  initialSeq?: string;
}) {
  const [seq, setSeq] = useState(initialSeq);
  const [na, setNa] = useState('50');
  const [mg, setMg] = useState('2.5');
  const [dntp, setDntp] = useState('0.8');
  const [conc, setConc] = useState('200');
  const [saltIdx, setSaltIdx] = useState(0);
  const [unitIdx, setUnitIdx] = useState(0);
  const [focus, setFocus] = useState(0);
  const [result, setResult] = useState<PrimerAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);

  const evaluate = () => {
    try {
      const analyzer = new PrimerAnalyzer({
        na_conc: Number(na),
        mg_conc: Number(mg),
        dNTPs_conc: Number(dntp),
        primer_conc: Number(conc),
        salt_method: SALTS[saltIdx] as SaltMethod,
        temp_unit: unit,
      });
      setResult(analyzer.evaluate(seq));
      setError(null);
    } catch (err) {
      setResult(null);
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  useInput((input, key) => {
    if (key.upArrow) setFocus((f) => (f + FIELD_COUNT - 1) % FIELD_COUNT);
    else if (key.downArrow) setFocus((f) => (f + 1) % FIELD_COUNT);
    else if (key.leftArrow || key.rightArrow) {
      const dir = key.leftArrow ? -1 : 1;
      if (focus === 5) setSaltIdx((i) => (i + dir + SALTS.length) % SALTS.length);
      if (focus === 6) setUnitIdx((i) => (i + dir + UNITS.length) % UNITS.length);
    } else if (key.return) {
      evaluate();
    }
  });

  const field = (index: number, label: string, node: React.ReactNode) => (
    <Box>
      <Box width={28}>
        <Text {...hl(focus === index)}>
          {focus === index ? '› ' : '  '}
          {label}
        </Text>
      </Box>
      {node}
    </Box>
  );

  const unit = UNITS[unitIdx] as TempUnit;
  const num = (value: number, digits: number): string => formatNumber(locale, value, digits);
  return (
    <Box flexDirection="column">
      {field(
        0,
        t(locale, 'anSeqLabel'),
        <TextInput
          value={seq}
          onChange={setSeq}
          placeholder={t(locale, 'anSeqPlaceholder')}
          focus={focus === 0}
        />,
      )}
      {field(1, t(locale, 'anNa'), <TextInput value={na} onChange={setNa} focus={focus === 1} />)}
      {field(2, t(locale, 'anMg'), <TextInput value={mg} onChange={setMg} focus={focus === 2} />)}
      {field(
        3,
        t(locale, 'anDntp'),
        <TextInput value={dntp} onChange={setDntp} focus={focus === 3} />,
      )}
      {field(
        4,
        t(locale, 'anConc'),
        <TextInput value={conc} onChange={setConc} focus={focus === 4} />,
      )}
      {field(
        5,
        t(locale, 'anSalt'),
        <Text>
          {SALTS.map((s, i) => (
            <Text key={s} {...hl(i === saltIdx)}>
              {i === saltIdx ? `[${saltLabel(locale, s)}] ` : `${saltLabel(locale, s)} `}
            </Text>
          ))}
        </Text>,
      )}
      {field(
        6,
        t(locale, 'anUnit'),
        <Text>
          {UNITS.map((u, i) => (
            <Text key={u} {...hl(i === unitIdx)}>
              {i === unitIdx ? `[°${u}] ` : `°${u} `}
            </Text>
          ))}
        </Text>,
      )}
      <Box marginTop={1}>
        <Text dimColor>{t(locale, 'anHint')}</Text>
      </Box>
      <Box marginTop={1} flexDirection="column" borderStyle="round" paddingX={1}>
        <Text bold underline>
          {t(locale, 'resTitle')}
        </Text>
        {error !== null && <Text color="red">{t(locale, 'errInvalid', { error })}</Text>}
        {error === null && result === null && <Text dimColor>{t(locale, 'resNone')}</Text>}
        {error === null && result !== null && (
          <>
            <Text>
              <Text bold>{t(locale, 'resTm')}: </Text>
              <Text color="cyan" bold>
                {num(result.tm, 2)} °{result.tmUnit}
              </Text>
              <Text>
                {' '}
                · {t(locale, 'resGc')}: {num(result.gcContent, 1)}% · {t(locale, 'resThermo')}:{' '}
                {num(result.deltaH, 1)}/{num(result.deltaS, 1)}
              </Text>
            </Text>
            <Text>
              {t(locale, 'resHairpin')}: {fmtDeltaG(locale, result.hairpin.deltaG)} ·{' '}
              {t(locale, 'resHomodimer')}: {fmtDeltaG(locale, result.homodimer.deltaG)}
              {result.homodimer.found
                ? result.homodimer.threePrimeAnchored
                  ? ` (${t(locale, 'resAnchored')})`
                  : ` (${t(locale, 'resNotAnchored')})`
                : ''}
              {' · '}
              {t(locale, 'resThreePrime')}:{' '}
              {result.threePrime.deltaG37 === null ? '–' : num(result.threePrime.deltaG37, 2)}
            </Text>
            <Text>
              {t(locale, 'resDegeneracy')}: {result.degeneracy.factor}
            </Text>
            <Box marginTop={1} flexDirection="column">
              <Text bold underline>
                {t(locale, 'resWarnings')}
              </Text>
              {result.warnings.length === 0 && (
                <Text color="green">{t(locale, 'resNoWarnings')}</Text>
              )}
              {result.warnings.map((w, i) => (
                <WarnRow
                  key={i}
                  locale={locale}
                  code={w.code}
                  severity={w.severity}
                  message={w.message}
                />
              ))}
            </Box>
          </>
        )}
      </Box>
    </Box>
  );
}
