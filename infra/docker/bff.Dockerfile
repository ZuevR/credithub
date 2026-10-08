# Сборка в контейнере: контекст - корень репозитория (см. `docker build -f ... .`),
# потому что нужны корневой yarn.lock и yarn-релиз из .yarn/releases.
#
# ВАЖНО про архитектуру: собирать НАТИВНО на целевой архитектуре. Кросс-сборка под
# эмуляцией QEMU падает на `nx build` с `Segmentation fault` (проверено на core-api).

# --- сборка ---------------------------------------------------------------
FROM node:24-alpine AS builder

WORKDIR /app

RUN corepack enable

# Манифесты отдельным слоем: пока не менялись package.json/yarn.lock, зависимости
# берутся из кэша и пересборка после правок исходников идёт быстро.
COPY package.json yarn.lock .yarnrc.yml ./
COPY .yarn/releases/ ./.yarn/releases/
RUN yarn install --immutable

COPY . .

RUN yarn nx run bff:build

# --- рантайм --------------------------------------------------------------
FROM node:24-alpine AS runtime

ENV NODE_ENV=production
WORKDIR /app

# node_modules переносится целиком, а не ставится по dist/package.json: в
# сгенерированном манифесте перечислены не все рантайм-зависимости (у core-api там
# отсутствовал `pg`), и установка по списку дала бы образ, падающий при запросе.
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist/apps/bff ./dist/apps/bff
COPY package.json ./

# Процесс не root: лишние привилегии в кластере ни к чему.
USER node

EXPOSE 3000

CMD ["node", "dist/apps/bff/main.js"]
