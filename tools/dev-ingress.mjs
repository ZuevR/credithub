import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';

/**
 * Локальный ingress для разработки - упрощённый аналог Traefik в k3s.
 *
 * Маршрутизация повторяет схему из PROJECT.md:
 *   /programs       -> mfe-programs SSR (документ публичного раздела)
 *   /mfe/programs/* -> mfe-programs SSR (тот же сервис: документ и ассеты)
 *   /api/*          -> BFF (и ТОЛЬКО он: core-api наружу не выставлен)
 *   всё остальное   -> shell
 *
 * Ассеты SSR-сервиса живут под префиксом `/mfe/programs`, а человекочитаемый
 * адрес раздела - `/programs`: так ссылки короткие, а префикс не конфликтует с
 * ассетами shell на том же origin.
 *
 * Матчинг делается опцией `pathFilter`, а НЕ аргументом `app.use(path, mw)`:
 * Express срезает mount-путь, и до целевого сервиса доезжает `/` вместо
 * `/programs` - сервис отвечает 404.
 */
const SHELL = process.env.SHELL_ORIGIN ?? 'http://localhost:8100';
const PROGRAMS = process.env.PROGRAMS_ORIGIN ?? 'http://localhost:8106';
const BFF = process.env.BFF_ORIGIN ?? 'http://localhost:3000';
const PORT = Number(process.env.INGRESS_PORT ?? 8080);

const app = express();

/** Понятный 502, если целевой сервис лежит, вместо пустого ответа. */
function onProxyError(service) {
  return (err, _req, res) => {
    console.error(`[ingress] ${service} недоступен:`, err.message);
    if (res && !res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' });
    }
    res?.end?.(`${service} недоступен`);
  };
}

app.use(
  createProxyMiddleware({
    target: PROGRAMS,
    changeOrigin: true,
    pathFilter: ['/programs', '/mfe/programs'],
    on: { error: onProxyError('mfe-programs') },
  })
);

app.use(
  createProxyMiddleware({
    target: BFF,
    changeOrigin: true,
    pathFilter: '/api',
    on: { error: onProxyError('bff') },
  })
);

app.use(
  createProxyMiddleware({
    target: SHELL,
    changeOrigin: true,
    on: { error: onProxyError('shell') },
  })
);

app.listen(PORT, () => {
  console.log(
    `[ingress] http://localhost:${PORT}  /programs -> ${PROGRAMS}, /api -> ${BFF}, / -> ${SHELL}`
  );
});
