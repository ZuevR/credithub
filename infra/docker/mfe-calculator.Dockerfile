# Angular-remote: собирается webpack'ом (@nx/angular), отдаётся nginx.
#
# Контекст сборки - корень репозитория. Собирать нативно на целевой архитектуре:
# кросс-сборка под эмуляцией падает на сборке.

# --- сборка ---------------------------------------------------------------
FROM node:24-alpine AS builder

WORKDIR /app

RUN corepack enable

COPY package.json yarn.lock .yarnrc.yml ./
COPY .yarn/releases/ ./.yarn/releases/
RUN yarn install --immutable

COPY . .

# Сборка Angular заметно дольше остальных приложений (webpack + компилятор).
RUN yarn nx run mfe-calculator:build

# --- раздача --------------------------------------------------------------
FROM nginx:alpine AS runtime

# В стандартном mime.types этого образа нет расширения mjs, а Angular отдаёт
# ES-модуль `remoteEntry.mjs`. Браузер строго проверяет MIME для модулей, и без
# этой правки файл пришёл бы как `application/octet-stream` и не исполнился.
RUN sed -i 's#\(application/javascript[[:space:]]*\)js;#\1js mjs;#' /etc/nginx/mime.types

COPY --from=builder /app/dist/apps/mfe-calculator /usr/share/nginx/html
COPY infra/docker/nginx/mfe-calculator.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

# Проверка, что патч mime.types применился - иначе ошибка всплыла бы только в
# браузере, и выглядела бы как «модуль не загрузился».
RUN grep -q 'js mjs;' /etc/nginx/mime.types
