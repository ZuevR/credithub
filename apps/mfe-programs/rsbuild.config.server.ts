import { defineConfig } from '@rsbuild/core';
import { pluginReact } from '@rsbuild/plugin-react';

/**
 * Вторая (серверная) сборка SSR-раздела.
 *
 * Отдельный конфиг, а не `environments` в основном, по двум причинам:
 * - клиентский конфиг несёт федерацию (`pluginModuleFederation`), серверной
 *   сборке она не нужна: сервер рендерит компонент напрямую из исходников;
 * - так проще держать разные `target` и каталоги вывода.
 *
 * Встроенный SSR-режим MF-плагина (`target: 'dual'`) недоступен: он работает
 * только в Rslib/Rspress и падает с "target option is only supported in Rslib".
 */
export default defineConfig({
  plugins: [pluginReact()],
  source: {
    entry: {
      'entry-server': './src/entry-server.tsx',
    },
    tsconfigPath: './tsconfig.app.json',
  },
  output: {
    target: 'node',
    distPath: {
      root: 'dist/server',
    },
  },
});
