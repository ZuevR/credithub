# Shell (React SPA): собирается rspack'ом, отдаётся nginx.
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

RUN yarn nx run shell:build

# --- раздача --------------------------------------------------------------
FROM nginx:alpine AS runtime

# Сборка кладётся в каталог приложения: цель запускает `rspack build` с
# cwd=apps/shell. Внутри уже есть mfe-config.json из public/, но в кластере он
# перекрывается файлом из ConfigMap (см. чарт) - адреса remote'ов задаются в
# рантайме, а не на сборке.
COPY --from=builder /app/apps/shell/dist /usr/share/nginx/html
COPY infra/docker/nginx/shell.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
