import express from 'express';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * Express-сервер SSR-раздела «Программы».
 *
 * Отдаёт готовый HTML (разметка приходит с сервера) и статику клиентской сборки.
 *
 * Два пути, и оба нужны:
 * - `/mfe/programs` - ingress-путь сервиса по схеме PROJECT.md;
 * - `/programs`     - человекочитаемый адрес публичного раздела.
 * Ассеты собираются под префиксом `/mfe/programs` (см. assetPrefix в
 * rsbuild.config.ts), поэтому статика монтируется именно туда.
 *
 * Шаблон берём из СОБРАННОГО клиентского index.html: имена скриптов у Rsbuild
 * хешированные, и подставлять их руками - значит ломаться на каждой сборке.
 * Токены и разметку отдаёт серверный бандл: libs/design-tokens - это
 * TypeScript-исходники, и обычный Node их не прочитает без сборки.
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const clientDir = path.join(here, 'dist', 'client');
const serverEntry = path.join(here, 'dist', 'server', 'entry-server.js');
const clientIndex = path.join(clientDir, 'index.html');

if (!existsSync(serverEntry) || !existsSync(clientIndex)) {
  console.error(
    '[mfe-programs SSR] Нет сборок. Сначала: nx run mfe-programs:build-ssr'
  );
  process.exit(1);
}

const template = readFileSync(clientIndex, 'utf8');
const { render, cssVariablesCss } = await import(serverEntry);

const app = express();
const PORT = Number(process.env.PORT ?? 8106);
const ROUTES = ['/programs', '/programs/', '/mfe/programs', '/mfe/programs/'];

app.get(ROUTES, (_req, res) => {
  try {
    const { html } = render();

    res.type('html').send(
      template
        // Токены объявляет владелец документа; здесь он - SSR-сервер, а не shell.
        .replace(
          '</head>',
          `<style data-design-tokens="true">${cssVariablesCss}</style></head>`
        )
        .replace('<div id="root"></div>', `<div id="root">${html}</div>`)
    );
  } catch (error) {
    // Пользователю - понятная страница, разработчику - полный стек в логах.
    // Отдавать стектрейс в HTML нельзя: это и утечка внутренностей, и мусор
    // для того, кто просто открыл публичный раздел.
    console.error('[mfe-programs SSR] ошибка рендера:', error);
    res
      .status(500)
      .type('html')
      .send(
        '<!DOCTYPE html><html lang="ru"><head><meta charset="utf-8">' +
          '<title>Программы временно недоступны</title></head>' +
          '<body><h1>Раздел временно недоступен</h1>' +
          '<p>Не удалось отрисовать страницу. Попробуйте обновить позже.</p>' +
          '</body></html>'
      );
  }
});

app.use('/mfe/programs', express.static(clientDir));

app.listen(PORT, () => {
  console.log(
    `[mfe-programs SSR] http://localhost:${PORT}/programs (ассеты: /mfe/programs)`
  );
});
