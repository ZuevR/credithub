# Сборка в контейнере оказывается быстрее, чем выгрузка локального dist:
# образ самодостаточен, и не нужно следить за тем, что джобы и миграции
# запускаются из того же самого артефакта.
#
# Контекст сборки - корень репозитория (см. `docker build -f <этот файл> .`),
# потому что приложению нужны и корневой yarn.lock, и yarn-релиз из .yarn/releases.
#
# ВАЖНО про архитектуру: образ надо собирать НАТИВНО на целевой архитектуре.
# Кросс-сборка под эмуляцией QEMU на этой сборке падает с
# `qemu: uncaught target signal 11 (Segmentation fault)`, хотя обычный Node под
# той же эмуляцией работает - падает именно `nx build`. Поэтому на arm64-машине
# разработчика образ не собрать, и сборка идёт на x86_64-хосте кластера.

# --- сборка ---------------------------------------------------------------
FROM node:24-alpine AS builder

WORKDIR /app

# Corepack поставляет нужную версию yarn из packageManager; глобально ставить
# yarn не нужно и не стоит - версия должна совпадать с репозиторием.
RUN corepack enable


# Сначала только манифесты: слой с зависимостями переиспользуется, пока не
# менялись package.json/yarn.lock, а правки исходников его не сбрасывают.
COPY package.json yarn.lock .yarnrc.yml ./
COPY .yarn/releases/ ./.yarn/releases/
RUN yarn install --immutable

# Исходники. .dockerignore исключает node_modules, dist и .git.
COPY . .

# Собираем два бандла: main.js (приложение) и seed.js (демо-данные).
RUN yarn nx run core-api:build

# --- рантайм --------------------------------------------------------------
FROM node:24-alpine AS runtime

ENV NODE_ENV=production
WORKDIR /app

# `pg` в сгенерированном package.json отсутствует, хотя драйвер нужен в
# рантайме: webpack бандлит @nestjs/typeorm, но не сам `pg`, и он берётся из
# workspace. Поэтому переносим node_modules целиком, а не ставим зависимости по
# списку из dist - по нему рантайм остался бы без драйвера базы.
#
# Плата за это - размер образа. Для однонодового кластера это приемлемо; если
# понадобится стройнее, dependencies-стадию можно пересобрать через
# `yarn workspaces focus`, но это отдельная задача с проверкой нативного `pg`.
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist/apps/core-api ./dist/apps/core-api
COPY package.json ./

# Процесс не root: образ работает в кластере, где лишние привилегии ни к чему.
USER node

EXPOSE 3001

CMD ["node", "dist/apps/core-api/main.js"]
