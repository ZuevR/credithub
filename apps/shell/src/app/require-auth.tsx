import { useEffect, useRef, type ReactNode } from 'react';
import { Typography } from '@mui/material';
import { useAuth } from '@credithub/auth-context';

/**
 * Защита маршрута: без сессии сразу уводит на Keycloak.
 *
 * Дашборд намеренно НЕ защищён: он показывает статическую сводку и не ходит в
 * API, а редирект с главной страницы был бы навязчивым. Обёртка нужна там, где
 * данные приходят из защищённого BFF.
 *
 * Возврат после входа происходит на ту же страницу - `redirect_uri` считается в
 * libs/auth-context как origin + pathname.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const { login } = auth;
  const requested = useRef(false);

  const waiting =
    auth.isConfigured && (auth.isLoading || !auth.isAuthenticated);
  const mustRedirect =
    auth.isConfigured && !auth.isLoading && !auth.isAuthenticated;

  useEffect(() => {
    // signinRedirect() нельзя звать дважды подряд: второй вызов не найдёт
    // сохранённого состояния и завершится ошибкой. Поэтому один раз.
    if (!mustRedirect || requested.current) return;
    requested.current = true;
    login();
  }, [mustRedirect, login]);

  if (waiting) {
    return (
      <Typography variant="body1" data-testid="auth-redirecting">
        {mustRedirect ? 'Перенаправление на вход…' : 'Проверка сессии…'}
      </Typography>
    );
  }

  return <>{children}</>;
}
