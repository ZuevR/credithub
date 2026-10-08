# План реализации CreditHub

Общая логика: каждый шаг — рабочий инкремент. Не переходим дальше, пока не
закрыты критерии приёмки предыдущего.

## Шаг 0 — Каркас монорепо (ЗАКРЫТ)

- [x] Nx workspace + Yarn 4 + node-modules
- [x] Плагины: @nx/react, @nx/nest, @nx/js, @nx/angular
- [x] libs/shared-types, libs/design-tokens, libs/ui
- [x] apps/shell, apps/mfe-credits (consumer + provider)
- [x] apps/bff, apps/core-api
- [x] CI workflow (.github/workflows/ci.yml)
- [x] Ручной порт bff=3000, core-api=3001, inspect=false
- [x] Коммит + push в публичный GitHub

Критерии приёмки: shell на 8100, mfe-credits на 8101, bff на 3000,
core-api на 3001; remoteEntry.js отдаётся; ошибок в консоли нет; build:all чистый.

## Шаг 1 — Shell + MFE-credits с общей дизайн-системой (ЗАКРЫТ)

- [x] Установка MUI, TanStack Query, React Router
- [x] libs/design-tokens: colors, spacing, typography, tokens
- [x] libs/ui: createAppTheme, PageHeader, WidgetShell
- [x] apps/shell/public/mfe-config.json (runtime-конфиг провайдеров)
- [x] apps/shell/src/mf.ts: initFederation(config) + lazyProvider
- [x] apps/shell/src/main.tsx: bootstrap с fetch mfe-config
- [x] apps/shell/src/app/app.tsx: AppBar + Drawer + Routes
- [x] mfe-credits: credits-app.tsx + expose ./CreditsApp
- [x] shared-зависимости MF в обоих config
- [x] Smoke-тест: /credits грузит remote, тема одинаковая

Критерии приёмки: /credits показывает PageHeader «Кредиты» + карточки,
primary color AppBar и кнопок совпадает в shell и mfe, standalone mfe-credits
работает с той же темой, HMR работает в обоих режимах, build:all чистый.

### Результат smoke-теста (проверено через CDP, Chrome DevTools Protocol)

| Критерий | Статус | Как проверено |
|---|---|---|
| `/credits` показывает PageHeader «Кредиты» + карточки | ✅ | DOM: `section[data-testid="credits-app"]`, `h1` «Кредиты», 3 × `credit-card` |
| primary color AppBar и кнопок совпадает в shell и mfe | ✅ | AppBar `#0B5FFF` = `tokens.colors.primary.main`; заголовок remote и shell = `rgb(26,31,54)` |
| Тема одинаковая (без визуального расхождения) | ✅ | вычисленные стили внутри remote: `h1` 24px/700, карточка 20px/600, caption 12px, радиус 8px, шрифт `Inter` — ровно токены `libs/ui` |
| standalone mfe-credits работает с той же темой | ✅ | prod-сборка статикой: `h1` 24px/700/`rgb(26,31,54)`, `body` `rgb(245,247,250)` + `Inter` + `margin: 0`, 0 исключений |
| `build:all` чистый | ✅ | `nx run-many -t build` → 4 проекта; `lint:all` → 5 проектов |
| HMR в обоих режимах | ⚠️ частично | Код shell пересобирается на лету без перезагрузки (проверено: `Обзор` → `Обзор OK`). Для кода **remote** — только перезагрузка страницы: см. ниже. Standalone-dev провайдера проверить нельзя из-за B4 (prod-версия standalone работает). |

**HMR для remote: почему только перезагрузка.** Контейнер провайдера действительно получает новый код — свежий `loadRemote('mfe-credits/CreditsApp')` вне React-фазы возвращает обновлённый модуль и рендерит новый текст. Но уже смонтированный `React.lazy` продолжает отдавать модуль, полученный при первом разрешении: пересоздание lazy через `useMemo` по счётчику версии (сброс кэша через `registerRemotes(..., {force:true})` и без него) в живом приложении новый модуль не подхватывало. Попытка автоматизировать это через HMR-сокет провайдера привела к бесконечному циклу монтирования: сокет закрывался, переподключался через 3 с и на каждом реконнекте присылал те же кадры `hash`/`ok`, а каждый кадр пересоздавал lazy → бесконечное «Loading ...» мигание (замер: 80 сокетов и 474 кадра за 24 с). Мост удалён; код remote нужно смотреть после перезагрузки страницы.

## Шаг 2 — Angular MFE (ЗАКРЫТ)

- [x] Создание apps/mfe-calculator (Angular) — Angular 22.2.1, webpack-билдер, zoneless, порт 8104
- [x] Федерация — вместо `@angular-architects/module-federation` взят `@nx/module-federation` (тот же webpack-путь, но интеграция с графом Nx; см. «Развилка по бандлеру»)
- [x] Экспонирование контракта `./mount` (`mount(element): Promise<() => void>`) вместо `./CalculatorApp`
- [x] Подключение к shell как remote — через `mfe-config.json` и `ProviderMount`, плюс кнопка «Повторить» при упавшем remote
- [x] Тема Angular на базе design-tokens — токены отдаются как CSS-переменные `--ch-*` из `libs/design-tokens`, Angular читает только их
- [x] Изоляция стилей, проверка двух runtime в одном браузере — React и Angular одновременно, утечек нет (детали и оговорки — в PROGRESS.md, 2e)
- [x] libs/shared-types: тип CreditDto, использование в React и Angular — `CreditDto` + `Money` + `LoanTerms` + общий `calcAnnuityPayment`; используется в mfe-credits (типизированные моки) и в Angular-калькуляторе (расчёт и пресеты)

Критерии приёмки: /calculator грузит Angular-remote из React-shell ✅, shared-типы
используются в обоих ✅, нет конфликтов стилей и runtime ✅.

**Почему shared-типы отложены.** Калькулятор — чисто клиентский расчёт, у него нет DTO, поэтому тип `CreditDto` в нём был бы искусственным. Естественное место для него — шаг 4 (BFF + core-api), где появляются реальные данные: тогда тип описывает настоящий контракт API. Проверка «shared-типы работают в React и Angular» имеет смысл именно на живых данных.

**Что выяснилось в шаге 2 (кратко; подробности — в PROGRESS.md).** Nx-хелперы собирают Angular-remote как **ESM** (`remoteEntry.mjs`, `library.type: 'module'`), поэтому `initFederation` выводит `type` из расширения entry, а dev-server Angular требует CORS-заголовки (`headers`, опции `cors` в схеме нет). `outputHashing: 'all'` ломает prod-сборку (`[contenthash:20]` в контексте федеративного рантайма) — отключено для этого приложения. HMR кода remote в shell не работает: модуль обновляется в контейнере, но уже смонтированный `React.lazy` продолжает отдавать прежний модуль — правки remote смотреть после перезагрузки страницы.

## Шаг 3 — SSR-раздел (ЗАКРЫТ)

- [x] apps/mfe-programs (React + Rsbuild SSR) — Rsbuild + федерация (3b) и серверный рендер через Express (3c); гидратация проверена
- [x] Shell знает про SSR-режим для /programs — пункт меню ведёт обычной ссылкой на отдельный SSR-сервис (вариант B)
- [x] Ingress (пока Traefik в dev — но проще Nginx-прокси или прямой URL) — локальный `tools/dev-ingress.mjs` на 8080: `/programs` и `/mfe/programs/*` → SSR, `/` → shell
- [x] Гидратация, обработка ошибок SSR + MF — гидратация 0 ошибок, токены + CssBaseline в документе, ошибки рендера → 500 без стектрейса; федерация в SSR-сервисе убрана (cross-bundler доказана на 3b)

Критерии приёмки: /programs отдаёт SSR-HTML, в браузере — гидрируется без
ошибок, MF не ломает SSR-контекст.

## Шаг 4 — BFF + Core API + PostgreSQL (ЗАКРЫТ)

- [x] Схема БД: Client, Credit, Installment, Program, Payment — **TypeORM**, не Prisma (нативен для NestJS); PostgreSQL 17.5 в docker-compose на порту 5433 (4a); сущности `Client`/`Program`/`Credit`/`Installment`/`Payment` и миграция `Init` применены (4b)
- [x] Seed-скрипт с фейковыми данными (4c) — `nx run core-api:seed`: клиент, 3 программы, 3 кредита, 312 платежей; считает общим `calcAnnuityPayment`, идемпотентен
- [x] core-api: модули credits, client, programs — `credits` (список/один), `programs` (только published), `dashboard` (сводка); `client` отдельным модулем пока не нужен: владелец портфеля определяется константой до появления Keycloak
- [x] bff: маршруты /api/dashboard, /api/credits, /api/programs — через `CoreApiClient` по HTTP (в базу BFF не ходит); 502 при недоступном core-api, 404/400 пробрасываются
- [x] Фронт ходит ТОЛЬКО в BFF — `mfe-credits` запрашивает относительный `/api/credits`; core-api наружу через ingress не выставлен
- [x] TanStack Query хуки в mfe-credits — `useQuery` вместо моков, react-query добавлен в shared как singleton, состояния загрузки/ошибки с кнопкой «Повторить»

Критерии приёмки: реальные данные из Postgres доезжают до UI через BFF.

## Шаг 5 — Auth (Keycloak)

**Отклонение от первоначальной формулировки (решено 2026-10-08).** Keycloak разворачивается
**в кластере** — своим чартом `infra/charts/keycloak`, с Ingress `/auth` через Traefik, — а не
в `docker-compose`. Причины: в `PROJECT.md` Keycloak и так стоит за Traefik (`/auth/*`), а
критерии приёмки проверяются на стенде; compose остался бы окружением только для локальной
разработки и был бы недоступен ни снаружи, ни (позже) ArgoCD.

- [ ] Keycloak **в кластере** (чарт `infra/charts/keycloak`, Ingress `/auth`), realm `credithub`
- [ ] Клиенты: shell (public, PKCE), bff (confidential)
- [ ] BFF проверяет JWT
- [ ] Токен из shell прокидывается в MFE через shared context
- [ ] Logout, refresh, роли

Критерии приёмки: без токена — редирект на Keycloak, с токеном — доступ,
MFE получает токен без перезагрузки.

## Шаг 6 — Dockerize

- [ ] Multi-stage Dockerfile на каждый app
- [ ] docker-compose.yml: postgres, keycloak, bff, core-api, shell, mfe-credits
- [ ] Прогон всего стека локально одной командой

Критерии приёмки: docker compose up поднимает всё, /credits работает.

## Шаг 7 — k3s + Helm + Ingress

- [ ] Установка k3s на домашний сервер
- [ ] Helm-чарты на каждый сервис
- [ ] Traefik Ingress с маршрутами /, /mfe/*, /api/*, /auth/*
- [ ] Secrets (kubectl или SOPS)
- [ ] Runtime-конфиг mfe-config.json через ConfigMap

Критерии приёмки: приложение доступно с другого устройства в домашней сети,
все MFE и бэкенды работают в кластере.

## Шаг 8 — CI/CD + ArgoCD

- [ ] GitHub Actions: lint, test, build, docker build, push в GHCR
- [ ] ArgoCD Application на каждый Helm-чарт
- [ ] GitOps: sync из Git
- [ ] Branch protection на main
- [ ] Откат, sync waves

Критерии приёмки: push в main → автоматический деплой в k3s без ручных действий.

## Шаг 9 — Observability + polish

- [ ] OpenTelemetry в bff и core-api
- [ ] Prometheus + Grafana + Loki
- [ ] Sentry на фронте
- [ ] Cloudflare Tunnel для публичного доступа (опционально)
- [ ] Публикация в README: скриншоты, схема, инструкция по запуску
