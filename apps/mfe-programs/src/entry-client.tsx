import { StrictMode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import createCache from '@emotion/cache';
import { cssVariablesCss } from '@credithub/design-tokens';
import { AppProviders } from './app-providers';
import { ProgramsSection } from './programs-section';
import './styles.css';

/**
 * Публикует дизайн-токены как CSS-переменные на :root.
 *
 * Тот же признак (`data-design-tokens`) использует shell: если тег уже пришёл
 * с сервера, второй не добавляем.
 */
function ensureDesignTokenVariables() {
  if (document.head.querySelector('style[data-design-tokens]')) return;

  const style = document.createElement('style');
  style.dataset.designTokens = 'true';
  style.textContent = cssVariablesCss;
  document.head.appendChild(style);
}

ensureDesignTokenVariables();

/**
 * Клиентская точка входа SSR-раздела.
 *
 * Режим выбирается по факту, а не по флагу сборки: контейнер либо уже заполнен
 * сервером (тогда `hydrateRoot`), либо пуст - это standalone-сборка Rsbuild и
 * dev-сервер, где серверного рендера нет (тогда `createRoot`). Гидрировать
 * пустой контейнер нельзя - React сообщит "Hydration failed", а рисовать заново
 * поверх серверной разметки означает мигание и лишнюю работу.
 */
const container = document.getElementById('root');
if (!container) throw new Error('#root element not found');

const cache = createCache({ key: 'css' });

const app = (
  <StrictMode>
    <AppProviders cache={cache}>
      <ProgramsSection />
    </AppProviders>
  </StrictMode>
);

if (container.hasChildNodes()) {
  hydrateRoot(container, app);
} else {
  createRoot(container).render(app);
}
