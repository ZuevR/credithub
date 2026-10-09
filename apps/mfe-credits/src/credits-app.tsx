import { useMemo } from 'react';
import { Alert, Box, Button, Skeleton, Stack, Typography } from '@mui/material';
import { ThemeProvider } from '@mui/material/styles';
import { useQuery } from '@tanstack/react-query';
import { createAppTheme, PageHeader, WidgetShell } from '@credithub/ui';
import { useOptionalAuth } from '@credithub/auth-context';
import type { CreditDto, CurrencyCode, Money } from '@credithub/shared-types';

/**
 * Данные приходят из BFF по относительному пути: в dev его проксирует
 * дев-сервер shell, в проде - ingress. Абсолютный адрес бэкенда здесь был бы
 * лишним знанием: приложение не должно знать, где живёт API.
 */
const CREDITS_ENDPOINT = '/api/credits';

/** Токена нет или он истёк: BFF отвечает 401. Отделяю от прочих ошибок. */
class UnauthorizedError extends Error {}

async function fetchCredits(token: string | null): Promise<CreditDto[]> {
  const response = await fetch(CREDITS_ENDPOINT, {
    // Токен приходит из общего контекста авторизации (libs/auth-context):
    // библиотека объявлена общим singleton'ом федерации, поэтому remote видит
    // тот же токен, что и shell.
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (response.status === 401) {
    throw new UnauthorizedError('Сессия истекла — войдите заново');
  }
  if (!response.ok) {
    // Сообщение BFF полезнее общего «ошибка запроса»: он различает 404,
    // недоступный core-api (502) и прочие случаи.
    const body = await response.json().catch(() => null);
    throw new Error(body?.message ?? `Запрос не удался (${response.status})`);
  }
  return response.json();
}

// Форматирование живёт в UI, а не в модели данных: DTO несёт числа, а как их
// показать - дело конкретного экрана.
function formatMoney({ minorUnits }: Money, currency: CurrencyCode): string {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(minorUnits / 100);
}

function formatRate(percent: number): string {
  return `${percent.toLocaleString('ru-RU', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`;
}

function CreditCard({ credit }: { credit: CreditDto }) {
  return (
    <div data-testid="credit-card">
      <WidgetShell title={credit.title}>
        <Stack spacing={0.5}>
          <Typography variant="h3" component="p">
            {formatMoney(credit.principal, credit.currency)}
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Ставка: {formatRate(credit.annualRatePercent)}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {credit.monthlyPayment
              ? `Платёж: ${formatMoney(credit.monthlyPayment, credit.currency)} из ${credit.termMonths}`
              : `Возобновляемый · срок ${credit.termMonths} мес.`}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Внесено {credit.paidInstallments} из {credit.termMonths}
            {credit.nextPaymentAt ? ` · следующий ${credit.nextPaymentAt}` : ''}
          </Typography>
        </Stack>
      </WidgetShell>
    </div>
  );
}

/**
 * Exposed to the shell as `mfe-credits/CreditsApp`.
 *
 * The theme is provided here as well as by the shell, so this renders the same
 * standalone and as a remote. That is safe: MUI's ThemeProvider replaces the
 * outer theme object rather than deep-merging it (`{...upperTheme,
 * ...localTheme}` in @mui/system), and createAppTheme() is deterministic, so an
 * identical theme is a no-op when hosted and the correct theme when standalone.
 *
 * CssBaseline is deliberately NOT here - global element styling belongs to the
 * app root, and that is src/bootstrap.tsx for the standalone entry point.
 *
 * The query client is NOT created here either: as a remote this uses the host's
 * client (see src/query-client.tsx for the standalone case).
 */
export function CreditsApp() {
  const theme = useMemo(() => createAppTheme(), []);
  // Тот же контекст, что и в shell (библиотека объявлена общим singleton'ом
  // федерации). null означает standalone-режим, где провайдера нет.
  const auth = useOptionalAuth();
  const token = auth?.token ?? null;
  const { data, isPending, isError, error, refetch, isFetching } = useQuery({
    // Токен входит в ключ запроса: после входа или выхода данные
    // перезапрашиваются сами, без перезагрузки страницы.
    queryKey: ['credits', token ?? 'anonymous'],
    queryFn: () => fetchCredits(token),
    // Без токена запрос бессмысленен - BFF ответит 401, поэтому вместо ошибки
    // показываем состояние «нужен вход».
    enabled: Boolean(token),
  });

  return (
    <ThemeProvider theme={theme}>
      <section data-testid="credits-app">
        <PageHeader title="Кредиты" subtitle="Портфель кредитов клиента" />
        <Typography
          variant="caption"
          color="text.secondary"
          data-testid="credits-auth"
        >
          Контекст авторизации:{' '}
          {auth ? (auth.username ?? 'не выполнен вход') : 'нет (standalone)'}
        </Typography>

        {!token && (
          <Alert
            severity="info"
            data-testid="credits-need-login"
            action={
              auth ? (
                <Button color="inherit" size="small" onClick={auth.login}>
                  Войти
                </Button>
              ) : undefined
            }
          >
            {auth
              ? 'Нужен вход: кредиты доступны только с токеном.'
              : 'Запущено standalone: вход доступен внутри shell.'}
          </Alert>
        )}

        {isPending && token && (
          // Скелетоны вместо спиннера: держат итоговую раскладку и не дают
          // странице «прыгнуть» после загрузки.
          <Box
            data-testid="credits-loading"
            sx={{
              display: 'grid',
              gap: 2,
              gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' },
            }}
          >
            {[0, 1, 2].map((index) => (
              <Skeleton key={index} variant="rounded" height={140} />
            ))}
          </Box>
        )}

        {isError && (
          <Alert
            severity="error"
            data-testid="credits-error"
            action={
              <Button color="inherit" size="small" onClick={() => refetch()}>
                Повторить
              </Button>
            }
          >
            {error instanceof UnauthorizedError
              ? 'Сессия истекла — войдите заново'
              : `Не удалось загрузить кредиты: ${(error as Error).message}`}
          </Alert>
        )}

        {data && (
          <Box
            sx={{
              display: 'grid',
              gap: 2,
              gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' },
              // Приглушаем список во время фонового обновления, чтобы не
              // показывать скелетоны поверх уже загруженных данных.
              opacity: isFetching ? 0.6 : 1,
              transition: 'opacity 150ms ease',
            }}
          >
            {data.map((credit) => (
              <CreditCard key={credit.id} credit={credit} />
            ))}
          </Box>
        )}
      </section>
    </ThemeProvider>
  );
}

export default CreditsApp;
