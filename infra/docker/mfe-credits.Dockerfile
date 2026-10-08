# Статический remote: собирается как обычно, а отдаётся nginx - держать для
# раздачи статики Node-процесс незачем.
#
# Контекст сборки - корень репозитория (см. `docker build -f ... .`).
# Собирать нативно на целевой архитектуре: кросс-сборка под эмуляцией падает.

# --- сборка ---------------------------------------------------------------
FROM node:24-alpine AS builder

WORKDIR /app

RUN corepack enable

COPY package.json yarn.lock .yarnrc.yml ./
COPY .yarn/releases/ ./.yarn/releases/
RUN yarn install --immutable

COPY . .

RUN yarn nx run mfe-credits:build

# --- раздача --------------------------------------------------------------
FROM nginx:alpine AS runtime

# Сборка этого приложения кладётся в каталог приложения, а не в корневой dist:
# цель запускает `rspack build` с cwd=apps/mfe-credits.
COPY --from=builder /app/apps/mfe-credits/dist /usr/share/nginx/html

# Приложение отдаётся под префиксом /mfe/credits (см. комментарий в конфиге).
COPY infra/docker/nginx/mfe-credits.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

# Базовый образ nginx сам запускает nginx в foreground - свой CMD не нужен.
