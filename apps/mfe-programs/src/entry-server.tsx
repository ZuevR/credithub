import { renderToString } from 'react-dom/server';
import createCache from '@emotion/cache';
import { cssVariablesCss } from '@credithub/design-tokens';
import { AppProviders } from './app-providers';
import { ProgramsSection } from './programs-section';

/**
 * Токены отдаём из бандла, а не импортируем в `server.mjs` напрямую:
 * `libs/design-tokens` - это TypeScript-исходники, и обычный Node их не
 * прочитает. Здесь их заинлайнит сборщик.
 */
export { cssVariablesCss };

/**
 * Серверная точка входа SSR-раздела.
 *
 * Возвращает готовую разметку; шаблон HTML собирает Express (`server.mjs`).
 *
 * Отдельного извлечения стилей не нужно: Emotion 11 при рендере через
 * `CacheProvider` сам встраивает `<style data-emotion>` прямо в результат -
 * проверено, `extractCritical` на таком HTML возвращает пустую строку, потому
 * что извлекать уже нечего. Поэтому `@emotion/server` в проекте отсутствует.
 *
 * Кэш создаётся **на каждый вызов**: общий кэш между запросами накапливал бы
 * стили предыдущих рендеров и в пределе утёк бы в чужой ответ.
 */
export function render(): { html: string } {
  const cache = createCache({ key: 'css' });

  const html = renderToString(
    <AppProviders cache={cache}>
      <ProgramsSection />
    </AppProviders>
  );

  return { html };
}
