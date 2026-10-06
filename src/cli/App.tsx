import React, { useState } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import type { Locale } from '../i18n/types.js';
import { LOCALE_CODES, translate as t } from '../i18n/index.js';
import { hl } from './ui.js';
import { AnalyzeScreen } from './AnalyzeScreen.js';
import { MultiplexScreen } from './MultiplexScreen.js';
import { HelpScreen } from './HelpScreen.js';
import type { PoolPrimer } from '../types.js';

export type Tab = 'analyze' | 'multiplex' | 'help';

export function App({
  initialSeq = '',
  initialLocale,
  initialTab = 'analyze',
  initialPrimers = [],
}: {
  initialSeq?: string;
  initialLocale: Locale;
  initialTab?: Tab;
  initialPrimers?: PoolPrimer[];
}) {
  const { exit } = useApp();
  const [tab, setTab] = useState<Tab>(initialTab);
  const [locale, setLocale] = useState<Locale>(initialLocale);
  const tabs: Tab[] = ['analyze', 'multiplex', 'help'];
  const tabLabel = (name: Tab): string =>
    name === 'analyze'
      ? t(locale, 'tabAnalyze')
      : name === 'multiplex'
        ? t(locale, 'tabMultiplex')
        : t(locale, 'tabHelp');

  useInput((input, key) => {
    if (key.tab) {
      setTab((cur) => tabs[(tabs.indexOf(cur) + 1) % tabs.length] as Tab);
    } else if (key.ctrl && (input === 'q' || input === 'Q')) {
      exit();
    } else if (key.ctrl && (input === 'l' || input === 'L')) {
      setLocale(
        (cur) => LOCALE_CODES[(LOCALE_CODES.indexOf(cur) + 1) % LOCALE_CODES.length] as Locale,
      );
    } else if (key.escape) {
      setTab('analyze');
    }
  });

  return (
    <Box flexDirection="column">
      <Box>
        <Text bold color="cyan">
          {t(locale, 'appTitle')}
        </Text>
      </Box>
      <Box marginY={1}>
        {tabs.map((name) => (
          <Text key={name} {...hl(name === tab)}>
            {name === tab ? `[${tabLabel(name)}] ` : `${tabLabel(name)} `}
          </Text>
        ))}
      </Box>
      {tab === 'analyze' && <AnalyzeScreen locale={locale} initialSeq={initialSeq} />}
      {tab === 'multiplex' && <MultiplexScreen locale={locale} initialPrimers={initialPrimers} />}
      {tab === 'help' && <HelpScreen locale={locale} />}
      <Box marginTop={1}>
        <Text dimColor>
          {t(locale, 'footerTab')} · {t(locale, 'footerQuit')} ·{' '}
          {t(locale, 'footerLang', { lang: locale })}
        </Text>
      </Box>
    </Box>
  );
}
