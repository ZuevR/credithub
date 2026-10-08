import { pluginReact } from '@rsbuild/plugin-react';
import { defineConfig } from '@rsbuild/core';

/**
 * Клиентская сборка SSR-раздела «Программы».
 *
 * Федерации здесь нет намеренно: по схеме ingress раздел - самостоятельный
 * сервис со своим документом (`/mfe/programs/*`, человекочитаемый адрес
 * `/programs`), а не remote внутри shell. Кросс-бандлерная загрузка
 * Rsbuild-remote была проверена на шаге 3b и в текущей архитектуре не нужна.
 */
export default defineConfig({
  html: {
    template: './src/index.html',
  },
  plugins: [pluginReact()],
  source: {
    entry: {
      // Точка входа выбирает режим по содержимому контейнера: серверная
      // разметка -> hydrateRoot, пустой #root (dev-сервер Rsbuild) -> createRoot.
      index: './src/entry-client.tsx',
    },
    tsconfigPath: './tsconfig.app.json',
  },
  server: {
    port: 8105,
  },
  output: {
    copy: [{ from: './src/favicon.ico' }, { from: './src/assets' }],
    target: 'web',
    // Ассеты живут под ingress-префиксом сервиса, чтобы не конфликтовать с
    // ассетами shell на том же origin.
    assetPrefix: '/mfe/programs',
    distPath: {
      // Клиентская сборка кладётся в dist/client, серверная - в dist/server
      // (rsbuild.config.server.ts). Так две сборки не перетирают друг друга.
      root: 'dist/client',
    },
  },
});
