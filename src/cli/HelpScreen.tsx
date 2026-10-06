import React from 'react';
import { Box, Text } from 'ink';
import type { Locale } from '../i18n/types.js';
import { translate as t } from '../i18n/index.js';

export function HelpScreen({ locale }: { locale: Locale }) {
  const lines = [
    t(locale, 'helpQuit'),
    t(locale, 'helpTab'),
    t(locale, 'helpNav'),
    t(locale, 'helpEdit'),
    t(locale, 'helpLang'),
    t(locale, 'helpAdd'),
    t(locale, 'helpRemove'),
    t(locale, 'helpEval'),
  ];
  return (
    <Box flexDirection="column">
      <Text bold underline>
        {t(locale, 'helpTitle')}
      </Text>
      {lines.map((line, i) => (
        <Text key={i}>· {line}</Text>
      ))}
    </Box>
  );
}
