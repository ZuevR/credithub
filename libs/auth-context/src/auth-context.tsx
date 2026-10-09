import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { UserManager, WebStorageStateStore, type User } from 'oidc-client-ts';

/**
 * Настройки OIDC приходят из runtime-конфига (`mfe-config.json`), а не из
 * сборки: адрес Keycloak зависит от стенда, а образ один и тот же.
 */
export interface AuthSettings {
  /** Issuer realm'а: `http://<хост>/auth/realms/credithub`. */
  authority: string;
  /** client_id публичного клиента (Authorization Code + PKCE). */
  clientId: string;
  scope?: string;
  redirectUri?: string;
  postLogoutRedirectUri?: string;
}

export interface AuthState {
  /** Идёт первичная проверка: есть ли уже сохранённая сессия. */
  isLoading: boolean;
  isAuthenticated: boolean;
  /** access-токен для заголовка `Authorization`; `null`, если вход не выполнен. */
  token: string | null;
  username: string | null;
  roles: string[];
  /** Настроена ли авторизация вообще (есть ли блок `auth` в конфиге). */
  isConfigured: boolean;
  error: string | null;
  login: () => void;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

function rolesFrom(user: User | null): string[] {
  // Роли realm лежат в ACCESS-токене. `user.profile` у oidc-client-ts - это
  // полезная нагрузка ID-токена, и Keycloak не кладёт туда realm_access,
  // поэтому читаем access-токен и лишь при неудаче откатываемся на profile.
  const fromAccessToken = (() => {
    const token = user?.access_token;
    const part = token?.split('.')[1];
    if (!part) return undefined;
    try {
      const padded = part + '='.repeat((4 - (part.length % 4)) % 4);
      const json = atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
      const parsed = JSON.parse(json) as {
        realm_access?: { roles?: string[] };
      };
      return parsed.realm_access?.roles;
    } catch {
      return undefined;
    }
  })();

  if (Array.isArray(fromAccessToken)) return fromAccessToken;

  const profile = user?.profile as
    | { realm_access?: { roles?: string[] } }
    | undefined;
  return Array.isArray(profile?.realm_access?.roles)
    ? (profile?.realm_access?.roles as string[])
    : [];
}

export function AuthProvider({
  settings,
  children,
}: {
  settings: AuthSettings | null;
  children: ReactNode;
}) {
  const managerRef = useRef<UserManager | null>(null);
  // Момент последнего запуска входа - см. защиту от двойного запуска в login().
  const lastRedirectAt = useRef(0);
  // Инициализация (разбор колбэка или чтение сохранённой сессии) запускается
  // ровно один раз, а оба прохода эффекта в StrictMode ждут ОДИН и тот же промис.
  // Иначе второй проход успевал выставить isLoading=false с пустым пользователем,
  // пока обмен кода ещё шёл по сети, и защита маршрута уводила на Keycloak заново.
  const initRef = useRef<Promise<User | null> | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setLoading] = useState(Boolean(settings));
  const [error, setError] = useState<string | null>(null);

  if (settings && !managerRef.current) {
    managerRef.current = new UserManager({
      authority: settings.authority,
      client_id: settings.clientId,
      // Возвращаемся на ту же страницу, с которой начали вход: тогда remote
      // смонтируется сам, токен придёт в контекст и данные подтянутся без
      // ручного перехода и без перезагрузки. Query-строку намеренно не
      // переносим - маршрутам shell она не нужна.
      redirect_uri:
        settings.redirectUri ??
        `${window.location.origin}${window.location.pathname}`,
      post_logout_redirect_uri:
        settings.postLogoutRedirectUri ??
        `${window.location.origin}${window.location.pathname}`,
      scope: settings.scope ?? 'openid profile email',
      response_type: 'code',
      // Токены в localStorage: страница переживает перезагрузку, а
      // automaticSilentRenew продлевает сессию без участия пользователя.
      // Для стенда это осознанный выбор; в проде стоит оценить sessionStorage
      // или BFF-сессии (refresh-токен в браузере - компромисс).
      userStore: new WebStorageStateStore({ store: window.localStorage }),
      automaticSilentRenew: true,
    });
  }

  useEffect(() => {
    const manager = managerRef.current;
    if (!manager) return;

    const onLoaded = (next: User) => {
      setUser(next);
      setError(null);
    };
    const onUnloaded = () => setUser(null);
    const onExpired = () => setError('Сессия истекла — нужно войти заново');
    const onRenewError = (err: Error) =>
      setError(`Не удалось продлить сессию: ${err.message}`);

    manager.events.addUserLoaded(onLoaded);
    manager.events.addUserUnloaded(onUnloaded);
    manager.events.addAccessTokenExpired(onExpired);
    manager.events.addSilentRenewError(onRenewError);

    void (async () => {
      // Запускаем ровно один раз: StrictMode выполняет эффект дважды, а обмен
      // кода одноразовый.
      if (!initRef.current) {
        initRef.current = (async () => {
          const params = new URLSearchParams(window.location.search);
          const isCallback = params.has('code') && params.has('state');
          if (!isCallback) {
            return manager.getUser();
          }
          // ВАЖНО: сначала обмен кода, потом чистка адресной строки.
          // signinRedirectCallback() читает code/state из текущего URL, поэтому
          // replaceState до вызова ломает обмен ("No state in response").
          const signedIn = await manager.signinRedirectCallback();
          window.history.replaceState(
            {},
            document.title,
            window.location.pathname
          );
          return signedIn;
        })();
      }

      try {
        setUser(await initRef.current);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    })();

    return () => {
      manager.events.removeUserLoaded(onLoaded);
      manager.events.removeUserUnloaded(onUnloaded);
      manager.events.removeAccessTokenExpired(onExpired);
      manager.events.removeSilentRenewError(onRenewError);
    };
  }, []);

  const login = useCallback(() => {
    const manager = managerRef.current;
    if (!manager) {
      setError('Авторизация не настроена: в mfe-config.json нет блока auth');
      return;
    }
    // Защита от двух запусков входа подряд (двойной клик, либо клик в момент,
    // когда защита маршрута уже начала редирект). Два signinRedirect подряд
    // перезаписывают сохранённое состояние, первый код становится недействителен,
    // и пользователь видит лишний переход. Окно небольшое, поэтому честный
    // повторный вход (например, после истечения сессии) не блокируется.
    const now = Date.now();
    if (now - lastRedirectAt.current < 1500) return;
    lastRedirectAt.current = now;
    void manager.signinRedirect();
  }, []);

  const logout = useCallback(() => {
    void managerRef.current?.signoutRedirect();
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      isLoading,
      isAuthenticated: Boolean(user && !user.expired),
      token: user && !user.expired ? user.access_token : null,
      username:
        (user?.profile?.preferred_username as string | undefined) ?? null,
      roles: rolesFrom(user),
      isConfigured: Boolean(settings),
      error,
      login,
      logout,
    }),
    [user, isLoading, error, login, logout, settings]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Доступ к состоянию авторизации. Работает только внутри AuthProvider. */
export function useAuth(): AuthState {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error('useAuth() вызван вне AuthProvider');
  }
  return value;
}

/**
 * То же, что useAuth(), но возвращает null вне AuthProvider.
 *
 * Нужно remote'ам: mfe-credits умеет запускаться standalone, где провайдера нет,
 * и падать в этом режиме из-за отсутствия контекста он не должен.
 */
export function useOptionalAuth(): AuthState | null {
  return useContext(AuthContext);
}
