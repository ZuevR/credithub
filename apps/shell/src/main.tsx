import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeProvider } from '@mui/material/styles';
import { CssBaseline } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import * as ui from '@credithub/ui';
import { AuthProvider } from '@credithub/auth-context';
import { cssVariablesCss } from '@credithub/design-tokens';
import { initFederation, type MfeConfig } from './mf';
import { App } from './app/app';

// The runtime provider registry (see public/mfe-config.json).
const CONFIG_URL = '/mfe-config.json';

/**
 * Publishes the design tokens as CSS custom properties on :root.
 *
 * This is how remotes built with another framework share the theme: the shell
 * owns the document, so it declares the variables, and e.g. the Angular remote
 * only references `var(--ch-*)` in its styles. Both sides read the same
 * libs/design-tokens values, and nothing framework-specific crosses the border.
 */
function applyDesignTokenVariables() {
  const style = document.createElement('style');
  style.dataset.designTokens = 'true';
  style.textContent = cssVariablesCss;
  document.head.appendChild(style);
}

function showFatalError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  // eslint-disable-next-line no-console
  console.error('[shell] bootstrap failed', error);
  const container = document.getElementById('root');
  if (container) {
    container.innerHTML =
      '<pre role="alert" style="font:13px/1.5 monospace;padding:16px;white-space:pre-wrap">' +
      `Shell failed to start: ${message}` +
      '</pre>';
  }
}

async function bootstrap() {
  // Providers must be registered before React renders, because rendering
  // triggers the first loadRemote() in lazyProvider (src/mf.ts).
  const config: MfeConfig = await fetch(CONFIG_URL).then((r) => r.json());
  initFederation(config);

  // Before the first render, so remotes mounted later already see the variables.
  applyDesignTokenVariables();

  const theme = ui.createAppTheme();
  // Опции берём из libs/ui: те же значения использует mfe-credits в
  // standalone, иначе поведение запросов зависело бы от способа запуска.
  const queryClient = new QueryClient({ defaultOptions: ui.queryDefaults });

  const container = document.getElementById('root');
  if (!container) throw new Error('#root element not found');

  createRoot(container).render(
    <StrictMode>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            {/* Настройки авторизации берём из того же рантайм-конфига, что и
                адреса remote'ов: образ shell один, а Keycloak у каждого стенда свой. */}
            <AuthProvider settings={config.auth ?? null}>
              <App />
            </AuthProvider>
          </BrowserRouter>
        </QueryClientProvider>
      </ThemeProvider>
    </StrictMode>
  );
}

bootstrap().catch(showFatalError);
