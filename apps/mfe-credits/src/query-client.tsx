import { useMemo, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { queryDefaults } from '@credithub/ui';

/**
 * Создаёт `QueryClient` с общими настройками из `libs/ui`.
 *
 * `mfe-credits` использует это в standalone, shell - в hosted-режиме, поэтому
 * опции берутся из одного места и не могут разойтись. Сам `QueryClient` каждая
 * сторона создаёт свой: клиент нельзя передать через границу remote'а.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({ defaultOptions: queryDefaults });
}

/**
 * Провайдер react-query для standalone-режима.
 *
 * В hosted-режиме remote использует `QueryClient` хоста (shell создаёт свой).
 * Оборачивать нужно ТОЛЬКО standalone-ветку: вложенный клиент в hosted-режиме
 * означал бы второй кэш и повторные походы в сеть.
 */
export function StandaloneQueryProvider({ children }: { children: ReactNode }) {
  const client = useMemo(() => createQueryClient(), []);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
