# SSR-раздел: Node-сервис (Express), который отдаёт серверно отрендеренный
# документ и статику клиентской сборки.
#
# Контекст сборки - корень репозитория. Собирать нативно на целевой архитектуре.

# --- сборка ---------------------------------------------------------------
FROM node:24-alpine AS builder

WORKDIR /app

RUN corepack enable

COPY package.json yarn.lock .yarnrc.yml ./
COPY .yarn/releases/ ./.yarn/releases/
RUN yarn install --immutable

COPY . .

# Нужны ОБЕ сборки: клиентская (dist/client, отдаётся как статика) и серверная
# (dist/server, из неё берётся render()).
RUN yarn nx run mfe-programs:build-ssr

# --- рантайм --------------------------------------------------------------
FROM node:24-alpine AS runtime

ENV NODE_ENV=production
WORKDIR /app

# node_modules переносится целиком: в сгенерированных манифестах перечислены не
# все рантайм-зависимости, и установка по списку дала бы образ, падающий при
# первом запросе (на core-api так отсутствовал `pg`).
COPY --from=builder /app/node_modules ./node_modules
# Раскладка важна: server.mjs читает dist/client/index.html и dist/server/entry-server.js
# относительно своего каталога.
COPY --from=builder /app/apps/mfe-programs/dist ./dist
COPY --from=builder /app/apps/mfe-programs/server.mjs ./server.mjs
COPY package.json ./

# Права нормализуем явно. Контейнер работает под непривилегированным `node`, а
# `server.mjs` копируется из контекста сборки, где режим файла зависит от того,
# как репозиторий попал на машину: копирование сохранило 0600, и запуск падал с
# `EACCES: open '/app/server.mjs'`. Сборка не должна зависеть от прав источника.
RUN chmod -R a+rX ./dist ./server.mjs package.json

USER node

EXPOSE 8106

CMD ["node", "server.mjs"]
