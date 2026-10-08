import type { ReactNode } from 'react';
import { CacheProvider } from '@emotion/react';
import createCache, { type EmotionCache } from '@emotion/cache';
import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider } from '@mui/material/styles';
import { createAppTheme } from '@credithub/ui';

/**
 * Единая обвязка для сервера и клиента.
 *
 * Держим её в одном месте намеренно: если серверная и клиентская ветки соберут
 * разный стек провайдеров, MUI/Emotion сгенерируют другие имена классов и
 * гидратация сообщит о расхождении.
 *
 * `key: 'css'` - тот же ключ, что Emotion использует по умолчанию на клиенте,
 * поэтому классы совпадают без дополнительной синхронизации.
 *
 * `CssBaseline` здесь, в отличие от remote-режима: SSR-документ самостоятельный
 * и владеет своей страницей, а значит отвечает за глобальную нормализацию.
 */
export function AppProviders({
  children,
  cache,
}: {
  children: ReactNode;
  cache: EmotionCache;
}) {
  return (
    <CacheProvider value={cache}>
      <ThemeProvider theme={createAppTheme()}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </CacheProvider>
  );
}
