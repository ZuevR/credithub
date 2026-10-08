# Текущий прогресс

**Обновлено:** 2026-10-07
**Текущий шаг:** 4 (BFF + Core API + PostgreSQL)
**Статус:** шаги 1–3 закрыты; **шаг 4 закрыт** (4a–4f). Следующий — шаг 5 (Keycloak/OIDC) или инфраструктура (Helm/k3s) по PLAN.md.

## Точка остановки: с чего продолжать

**Шаг 4 закрыт целиком:** 4a PostgreSQL → 4b TypeORM + миграция → 4c seed → 4d модули core-api → 4e BFF + ingress → 4f TanStack Query в `mfe-credits`. Критерий приёмки выполнен: реальные данные из Postgres доезжают до UI через BFF.

**Решение по ORM изменено пользователем: TypeORM вместо Prisma** (нативен для NestJS через `@nestjs/typeorm`, без отдельного codegen-шага). В `PROJECT.md` и `PLAN.md` решение обновлено, чтобы не осталось противоречия.

План шага 4: 4a PostgreSQL (готово) → 4b сущности + миграции TypeORM (готово) → 4c seed (готово) → 4d модули core-api (готово) → 4e маршруты BFF `/api/*` + ingress (готово) → 4f TanStack Query в mfe-credits (готово). **Граница сервисов настоящая:** BFF ходит в core-api по HTTP, а не в общую БД. Именно на 4f предварительный `CreditDto` из `libs/shared-types` станет настоящим контрактом ответа API.

**Как поднять окружение после паузы** (все сервисы сейчас запущены):

| Порт | Что | Команда |
|---|---|---|
| 8080 | ingress (точка входа) | `yarn dev:ingress` |
| 8100 | shell (rspack) | `yarn dev:front` (поднимает 8100/8101/8104) |
| 8101 | mfe-credits (rspack) | —"— |
| 8104 | mfe-calculator (Angular) | —"— |
| 8105 | mfe-programs dev (Rsbuild, CSR) | `yarn dev:programs` |
| 8106 | mfe-programs SSR (Express) | `yarn dev:ssr` |

Открывать приложение следует через ingress: `http://localhost:8080/`. Прямые порты тоже работают, но именно ingress повторяет прод-схему (`/programs` → SSR-сервис, `/` → shell).

## Шаг 4 — BFF + Core API + PostgreSQL (в работе)

### 4a — инфраструктура: PostgreSQL в Docker (готово)

- `docker-compose.yml`: сервис `postgres` на образе **`postgres:17.5-alpine`** (образ уже был в Docker, качать не пришлось), контейнер `credithub-postgres`, `healthcheck` через `pg_isready`, именованный том `credithub-pgdata`.
- **Порт 5433, а не 5432.** На машине уже есть посторонний остановленный контейнер `local-postgres-17`; занимать дефолтный порт ради проекта — гарантированный конфликт. Чужой контейнер не тронут (проверено: он так и остался `Exited`).
- `.env.example` (в репозитории) и `.env` (локально, добавлен в `.gitignore` вместе с `.env.local`): `DATABASE_URL`, `CORE_API_URL`, порты сервисов.
- **Проверено:** контейнер `healthy`, PostgreSQL 17.5; подключение по сети с хоста через `postgres://credithub:credithub@localhost:5433/credithub` возвращает `current_database=credithub`; том создан. Схемы пока нет — это 4b.
- `@nestjs/config` в проекте нет: конфигурация сервисов и чтение `.env` — задача 4b.

### 4b — сущности TypeORM и первая миграция (готово)

**Установлено:** `@nestjs/typeorm@12.0.2`, `typeorm@1.1.2`, `pg@8.23.1`, `@nestjs/config@12.0.1`. `ts-node@10.9.1` уже был в дереве — понадобился для CLI.

**Важно про версию TypeORM:** `typeorm@1.1.2` — это **актуальный latest**, у TypeORM вышел мажор 1.x. Сначала принял его за подделку/ошибку, проверил через реестр: `dist-tags.latest = 1.1.2`, а `@nestjs/typeorm@12` официально поддерживает его (peer `^0.3.0 || ^1.0.0-dev`). Единственное отличие API, которое встретилось: `MigrationInterface` теперь **type-only** экспорт — нужен `import type`.

**Сущности** (`apps/core-api/src/db/entities/`): `Client`, `Program`, `Credit`, `Installment`, `Payment`. Решения по схеме:
- **Деньги хранятся в минорных единицах (копейках) как `bigint`.** Дробные рубли в `numeric`/`float` дают ошибки округления при суммировании портфеля, а конвертация «рубли ↔ копейки» на каждом слое — источник расхождений. Так же устроен публичный `CreditDto` (`Money.minorUnits`), то есть один способ представления денег на всех слоях.
- **`bigint` приходит из `pg` строкой** — это неизбежно (JS `number` теряет точность выше 2^53), и так и записано в типах сущностей (`principalMinor!: string`).
- Ставки — `numeric(5,2)`, тоже строка: участвуют в денежных расчётах, двоичное представление ни к чему.
- `clients` намеренно **без персональных данных** (только имя) — хранение PII это отдельный разговор.
- Уникальность `(creditId, sequence)` в графике платежей не даёт задвоить платёж.
- `payments.creditId` продублирован рядом с `installmentId` намеренно: считает оплаченное по кредиту без обязательного join через график.

**Конфигурация подключения** (`src/db/data-source-options.ts`) вынесена из Nest-модуля: тот же объект нужен CLI TypeORM, который работает без запуска приложения. `synchronize: false` — схема меняется только миграциями. Глоб миграций выбирается по расширению файла модуля (`.ts` при запуске через ts-node, `.js` из `dist`).

**Цели CLI** в `project.json`: `migration:generate` / `migration:run` / `migration:revert` / `migration:show`. Запускаются через `typeorm-ts-node-commonjs` с явным `TS_NODE_PROJECT` (иначе ts-node берёт корневой tsconfig без настройки декораторов).

**Грабли в собственной правке:** при добавлении целей через скрипт у трёх целей `options` оказались заданы дважды, и вторые перекрывали `cwd`/`env`. Заметил при чтении результата и переписал аккуратно.

**`.env`** ищется подъёмом вверх по дереву (`src/config/find-env-file.ts`), а не фиксированным числом `../`: из исходников и из `dist` глубина разная, и одна из веток молча получила бы неверный путь — а `@nestjs/config` при отсутствии файла не падает, просто потом всплывает непонятной ошибкой подключения.

**Проверено:**
- миграция `1791455727995-Init.ts` сгенерирована по сущностям и применена: в базе **5 таблиц** (`clients`, `programs`, `credits`, `installments`, `payments`) + `migrations`, **5 внешних ключей** (проверено запросом к `pg_constraint`), индексы и уникальный ключ на месте;
- `uuid_generate_v4()` в миграции работает без правок: официальный образ Postgres прописывает `uuid-ossp` в `template1`, и новая база его унаследовала (проверил `\dx` и сам вызов функции). Отдельный шаг `CREATE EXTENSION` не понадобился, но для «голого» Postgres он был бы нужен — учту при переходе на k3s;
- `core-api` поднимается с подключённой базой: в логе `TypeOrmCoreModule dependencies initialized`, `GET /api` отвечает `{"message":"Hello API"}`;
- `tsc`, `build:all` (6 проектов), `lint:all` (7), `test:all` (3) — зелёные.

**Расхождение с публичным `CreditDto`, которое надо решить на 4e/4f:** в `libs/shared-types` валюта лежит **внутри** `Money` (`{ minorUnits, currency }`), а в БД — на уровне кредита (в одной записи валюта одна). При маппинге это приведёт к дублированию валюты в каждой сумме. Предлагаю на 4e/4f упростить `Money` до `{ minorUnits }`, а `currency` поднять в `CreditDto`. Решение пока не принимал.

### 4c — seed с демо-данными (готово)

**Что грузится** (`apps/core-api/src/db/seed.service.ts`): клиент «Иванов Иван Иванович», 3 кредитные программы (Автокредит, Ипотека, Кредитная карта), 3 кредита с графиками платежей — 60/240/12 месяцев, то есть **312 платежей**, из них **42 внесённых** (12/24/6). Те же кредиты, что показывает `mfe-credits`, поэтому данные совпадают с UI.

**Ключевое решение:** график считает общий `calcAnnuityPayment` из `libs/shared-types` — тот же, что использует Angular-калькулятор. Дублировать формулу в seed нельзя: БД и UI разошлись бы в копейках, и это выглядело бы как ошибка округления в приложении. Сверено: платёж автокредита `2 941 035` коп = 29 410,35 ₽ (UI округляет до рублей — 29 410 ₽, сходится).

**Идемпотентность:** если клиенты уже есть, seed ничего не делает. Иначе повторный запуск плодил бы дубли, а команду легко нажать дважды. Проверено: второй запуск пишет «клиенты уже есть — пропускаю», счётчики не меняются.

**Грабли (потратил на них больше всего времени) — как запускать TypeScript-скрипт с путями `@credithub/*`:**
1. `ts-node` + `tsconfig-paths` не работают: `tsconfig-paths` требует `baseUrl`, а он **объявлен устаревшим** в TypeScript 5.x (`error TS5101: Option 'baseUrl' is deprecated… Specify '"ignoreDeprecations": "6.0"'`). Подпихивать `ignoreDeprecations` ради seed-скрипта — плохой размен.
2. Поэтому seed **собирается вместе с приложением** отдельной точкой входа webpack: в `webpack.config.js` у `NxAppWebpackPlugin` указан `additionalEntryPoints: [{ entryName: 'seed', entryPath: './src/db/seed-cli.ts' }]`, в `dist/apps/core-api/` появляется `seed.js`, а цель `core-api:seed` запускает именно его. Пути `@credithub/*` разрешает webpack, отдельная настройка не нужна.
3. Сам seed идёт **через Nest-контекст** (`NestFactory.createApplicationContext`), а не через отдельный `DataSource`: конфигурация подключения и `.env` читаются ровно так же, как в работающем приложении, а не «вторым способом», который может разойтись.

**Побочно:** seed вынесен в `SeedModule` (подключён в `AppModule`), а не в провайдеры основного модуля — видно, что это dev-инструмент, а не часть приложения.

**Проверено:** счётчики `clients=1`, `programs=3`, `credits=3`, `installments=312`, `payments=42`; разбивка первого платежа автокредита корректна (проценты 1 510 417 коп при теле 1 250 000 под 14,5% годовых — сходится с расчётом); повторный запуск идемпотентен; `tsc`, `build:all` (6), `lint:all` (7), `test:all` (3) — зелёные.

### 4d — модули core-api и упрощение общего контракта (готово)

**Сначала упростил `Money` в `libs/shared-types`** (это было отложенное решение из 4b): убрал из него `currency`, а валюту поднял на уровень сущности — `CreditDto.currency`. В схеме БД она и так лежит на уровне кредита, поэтому `{ minorUnits, currency }` в каждой сумме давало дублирование. Заодно `CreditDto` дополнен полями из реальной схемы: `status`, `paidInstallments`, `nextPaymentAt`. Добавлены `PortfolioSummaryDto` и `ProgramDto`. Компилятор сам показал все места, которые надо поправить: `mfe-credits` (мок-данные и формат) и Angular-калькулятор (демо-кредиты).

**Модули** (`apps/core-api/src/modules/`):
- `credits` — `GET /credits`, `GET /credits/:id` (404 на несуществующий, а не пустой объект);
- `programs` — `GET /programs`, только `published` (фильтр на источнике данных, а не на клиенте: черновики не должны попадать в публичный раздел);
- `dashboard` — `GET /dashboard` со сводкой. Сервис берётся из `CreditsModule`, а не пишется вторым независимым запросом: иначе появился бы второй способ считать «активные кредиты», и обзор мог разойтись со страницей кредитов.

**Маппинг** вынесен в `src/db/mappers.ts` — единственное место, где строки БД (`bigint`, `numeric`) превращаются в числа контракта. Если размазать `Number()` по сервисам, где-то его забудут и клиент получит строку вместо суммы.

Внесённые платежи и дата ближайшего платежа считаются отдельным запросом, а не через жадную загрузку `relations`: для графика в 240 платежей это вытянуло бы из базы заметно больше данных ради двух чисел.

**Найден и исправлен реальный баг с датами.** `nextPaymentAt` возвращался на день раньше: в базе `2027-12-15`, в API `2027-12-14`. Причина — `toISOString()`: `Date` для колонки `date` означает полночь по **локальному** времени, а `toISOString()` переводит в UTC, и в отрицательных зонах (здесь `Europe/Moscow`) отматывает день назад. Теперь значение приводится без UTC-конвертации, и оба случая (`string` от драйвера и `Date`) обрабатываются явно. Проверено сверкой с базой по всем трём кредитам.

**Грабли:** после переноса сервисов в `modules/<feature>/` пути импортов до `db/entities` изменились на уровень выше. Мой скрипт массовой замены заодно поправил `mappers.ts`, который лежит в `db/` и потому должен ссылаться на `./entities/*` — поймал по ошибкам компилятора.

**Побочно про Nx:** цель `serve` держит блокировку проекта, и при перезапусках копились деревья процессов, из-за чего новый `serve` писал «Waiting for core-api:serve:development in another nx process». Для итераций запускаю собранный бандл напрямую (`node dist/apps/core-api/main.js`) — без блокировок.

**Проверено:**
- `GET /api/credits` — 3 кредита с корректными суммами, ставками, `paidInstallments` (12/24/6) и датами, совпадающими с БД;
- `GET /api/dashboard` — `totalDebt = 620 000 000` коп (совпадает с суммой моков: 1,25 + 4,8 + 0,15 млн ₽), `totalMonthlyPayment = 7 321 653` коп, `activeCredits = 3`;
- `GET /api/programs` — 3 программы, отсортированы по ставке;
- `GET /api/credits/:id` — 200 для существующего, **404** с понятным телом для несуществующего;
- `tsc`, `build:all` (6), `lint:all` (7), `test:all` (3) — зелёные.

**Осознанное ограничение:** клиент-владелец портфеля определяется константой `DEMO_CLIENT_ID` в `CreditsService` — авторизации (Keycloak) ещё нет, это отдельный шаг. Когда появится, идентификатор придёт из токена, а форма вызова сервиса не изменится.

### 4e — маршруты BFF и ingress `/api/*` (готово)

**BFF** (`apps/bff`): `CoreApiClient` — HTTP-клиент к core-api (через уже имевшийся `axios`, новых зависимостей нет), модули `credits` (`GET /credits`, `/credits/:id`) и `data` (`/dashboard`, `/programs`), плюс `GET /health` для проб. BFF **не ходит в базу напрямую** — только в core-api по HTTP, иначе граница сервисов была бы декоративной.

Ошибки транспорта превращаются в осмысленные статусы: недоступный core-api → **502** с текстом «Доменный сервис временно недоступен», а не 500 и не зависший запрос. Статус core-api пробрасывается как есть, чтобы 404 оставался 404. `/health` проверяет **только процесс**: если добавить туда поход в core-api, недоступность доменного сервиса начнёт «ронять» BFF в глазах ingress'а. Проверено: при мёртвом core-api `/api/credits` → 502, а `/api/health` → 200.

Идентификатор в пути валидируется до похода в core-api (не-UUID → 400), чтобы не гонять заведомо плохой запрос.

**Ingress** (`tools/dev-ingress.mjs`): `/programs` и `/mfe/programs` → SSR-сервис, `/api` → BFF, остальное → shell. **core-api наружу не выставлен** — это и есть пункт плана «фронт ходит ТОЛЬКО в BFF».

**Побочно:** в dev-сервер shell добавлен прокси `/api` → BFF, чтобы фронт обращался по относительному пути и в dev, и в проде через ingress, без адреса бэкенда в конфиге приложения.

**Главная ошибка этого шага — и урок про диагностику.** Симптом выглядел как проблема NestJS: маршруты `CreditsController` и `DataController` значились в логе как зарегистрированные, но отвечали 404, причём в форме `Cannot GET /credits`; контроллеры из `AppModule` при этом работали. Я успел проверить и отклонить несколько гипотез (влияние `exclude` в `setGlobalPrefix`, двойной префикс, ошибка сборки — воспроизводилось и из исходников, и из бандла, проблема `@Global`/явных импортов, молчаливая ошибка DI, минимальный самодостаточный пример Nest с внедрением — он работал).

Настоящая причина оказалась тривиальной: **`CORE_API_URL` указывал на `http://localhost:3001` без префикса `/api`**, который core-api добавляет через `setGlobalPrefix('api')`. То есть клиент получал 404 на каждом запросе, и это выглядело как «контроллер не смонтирован». Исправлено в `.env` и `.env.example`.

**Что помогло найти:** минимальный пример с внедрением зависимости отработал успешно — это отвело подозрение от Nest и направило к самому клиенту; дальше временный маршрут, дергающий клиент напрямую, показал ответ `Cannot GET /programs`, то есть 404 приходит **из core-api**, а не из BFF.

**Проверено:**
- через ingress: `/` 200, `/programs` 200, `/api/credits` 200, `/api/programs` 200, `/api/dashboard` 200, `/api/health` 200;
- `GET /api/credits` — реальные данные из базы (3 кредита); `/api/dashboard` — `totalDebt = 620 000 000` коп;
- 404 для несуществующего UUID (с телом от core-api), **400** для не-UUID, 200 для существующего;
- **502** при недоступном core-api, при этом `/api/health` остаётся 200;
- dev-сервер shell проксирует `/api` на BFF (проверено: `/api/credits` на 8100 отдаёт JSON, а не HTML SPA);
- `tsc`, `build:all` (6), `lint:all` (7), `test:all` (3) — зелёные.

### 4f — mfe-credits на реальных данных через TanStack Query (готово). Шаг 4 закрыт

Моки удалены: `CreditsApp` запрашивает `/api/credits` через `useQuery`. Критерий приёмки шага 4 выполнен — **реальные данные из Postgres доезжают до UI через BFF** (в браузере видно `200 /api/credits` и карточки из базы).

**Найдены и устранены две дыры, без которых это не работало бы:**
1. **`@tanstack/react-query` не был в списке shared** ни у shell, ни у `mfe-credits`. Без этого remote собрал бы свою копию библиотеки, и получилось бы два независимых кэша и повторные походы в сеть за одними и теми же данными. Добавлен как singleton в оба конфига.
2. **В standalone у remote не было `QueryClientProvider`** — в hosted его даёт shell, а на 8101 (отдельный запуск) не давал никто. Добавлен `StandaloneQueryProvider` только для standalone-ветки: в hosted вложенный клиент означал бы второй кэш.

**Общие настройки запросов** (`staleTime`, `retry`, `refetchOnWindowFocus`) вынесены в `libs/ui/src/lib/query-defaults.ts` как **обычный объект опций**, а `QueryClient` из него создаёт каждая сторона. Сначала я положил фабрику клиента в `libs/shared-types` и вовремя отыграл: там только типы, и рантайм-зависимость от react-query была бы лишней для Angular и core-api. Проверил также, что shell действительно использует те же опции, — иначе поведение зависело бы от способа запуска.

**UI получил состояния:** скелетоны при загрузке (держат раскладку, страница не «прыгает»), приглушение списка при фоновом обновлении, `Alert` с текстом ошибки от BFF и кнопкой «Повторить».

**Запрос идёт по относительному `/api/credits`**: в dev его проксирует дев-сервер (добавлен прокси и в `mfe-credits`, и в shell), в проде — ingress. Абсолютного адреса бэкенда в приложении нет.

**Проверено в браузере:**
- hosted через ingress (`:8080/credits`): 3 карточки, `200 /api/credits`, 0 ошибок; первая карточка — «Ипотека · 4 800 000 ₽ · Ставка 9,2% · Платёж 43 806 ₽ из 240 · Внесено 24 из 240 · следующий 2027-12-15» (значения из базы);
- standalone провайдера (`:8101`): те же 3 карточки, `200 /api/credits` — то есть работает и без хоста;
- **состояние ошибки:** при остановленном BFF показывается `Alert` «Не удалось загрузить кредиты: Запрос не удался (504)» и кнопка «Повторить»; **после возврата BFF клик по кнопке восстанавливает список** (3 карточки, ошибка уходит);
- регрессия: `/calculator` (3 инпута), `/programs` (SSR-раздел), `/` (обзор) — без ошибок в консоли;
- `tsc` по четырём приложениям, `build:all` (6), `lint:all` (7), `test:all` (3) — зелёные.

## Инфраструктура на домашнем ПК (в работе)

Целевая машина под развёртывание: **`romanzuev@192.168.1.187`** (`PC4-32`), Ubuntu 24.04.5 LTS,
Intel i5-4460 (4 ядра), 31 ГБ RAM, 469 ГБ диска. Выбран вариант **k3s + Helm + Traefik**
(как в PROJECT.md, где под прод заложен k3s). На машине уже что-то слушает на порту **1234** —
это чужой сервис, мы его не трогаем.

### Что установлено

| Компонент | Версия | Как |
|---|---|---|
| k3s | v1.36.5+k3s1 | официальный скрипт **с `--disable traefik`** — Traefik ставим сами, чтобы управлять его версией |
| kubectl | v1.37.1 | бинарник с dl.k8s.io, контрольная сумма проверена |
| Helm | **3.22.0** (не 4.x) | архив с get.helm.sh, сумма сверена с официальной. Мажор 4 намеренно не берём: чарты пишем сами, внезапный мажор в фундаменте — лишний риск |
| Traefik | chart 41.6.1 / app v3.7.13 | Helm в namespace `traefik`, `EXTERNAL-IP 192.168.1.187` через встроенный в k3s ServiceLB |

Настроено: passwordless sudo для `romanzuev` (файл `/etc/sudoers.d/romanzuev`, проверен `visudo -c`),
`~/.kube/config` для пользователя (копия `/etc/rancher/k3s/k3s.yaml` с адресом `192.168.1.187`).

### Проверено

- кластер: нода `Ready`, системные поды `Running` (coredns, local-path-provisioner, metrics-server),
  k3s занял только порты 6443 и 10250;
- **связка ingress → service → pod работает**: демо-nginx в отдельном namespace отдавался по
  `curl -H "Host: demo.local" http://192.168.1.187` со статусом 200 и страницей nginx, а без хоста —
  404 от Traefik. Демо после проверки удалено, кластер чист;
- чужой сервис на порту 1234 не задет.

### PostgreSQL в кластере (готово)

Развёрнут **собственным Helm-чартом** (`infra/charts/`), а не готовым: в PROJECT.md
заложены «Helm-чарты на каждый сервис», и свои манифесты понятны целиком, без чужих
соглашений о секретах и хранилище.

**Два чарта, а не один:**
- `namespace` — владеет namespace `credithub`. Вынесен отдельно, потому что namespace
  ресурс кластерного уровня: если бы им владел чарт postgres, то `helm uninstall postgres`
  сносил бы namespace вместе со всеми остальными сервисами. Первая попытка установки
  упала именно на этом — `Namespace exists and cannot be imported into the current
  release: missing key "app.kubernetes.io/managed-by"`.
- `postgres` — `StatefulSet` + headless `Service` + `PVC`. Ресурсы кластерного уровня
  в него не входят.

**Решения в чарте:**
- образ `postgres:17.5-alpine` — **та же версия, что в локальном docker-compose**, чтобы
  поведение в кластере и у разработчика совпадало;
- `PGDATA` вынесен в подкаталог тома: в корне точки монтирования `local-path` создаёт
  `lost+found`, и `initdb` отказывается работать в непустом каталоге;
- пробы `pg_isready` через `exec`, а не `tcpSocket`: открытый порт означает лишь, что
  процесс слушает, принимать запросы база может начать позже;
- **пароль не хранится в репозитории**: Secret создаётся заранее через `kubectl`, чарт
  умеет использовать существующий (`auth.existingSecret`). Это заодно не оставляет
  пароль в истории команд, чего не избежать при `helm --set`. Если Secret не создан и
  пароль не передан — рендер падает с понятным сообщением, а не поднимает базу с пустым
  паролем. Пароль лежит локально в `infra/.env.infra` (в `.gitignore`);
- `local-path` привязывает том к ноде — у нас нода одна, но в чарте это отмечено как
  непригодное для многонодового кластера.

**Проверено:**
- релизы `namespace-0.1.0` и `postgres-0.1.0` в статусе `deployed`;
- под `postgres-0` — `1/1 Running`, потребление 95m CPU / 22Mi RAM;
- PVC `data-postgres-0` — `Bound`, 10Gi, `local-path`;
- база отвечает: `PostgreSQL 17.5`, `current_database=credithub`, DNS внутри кластера
  резолвится (`postgres.credithub.svc.cluster.local` → `10.42.0.9`);
- **данные живут на диске, а не в поде**: создал таблицу с записью, удалил под, дождался
  пересоздания (другой UID) — запись на месте, PVC тот же. Тестовая таблица удалена.

**Доступ снаружи для миграций и отладки** — через port-forward (в кластер наружу база
не выставлена):
```sh
kubectl -n credithub port-forward svc/postgres 5433:5432
```
Пароль: `kubectl -n credithub get secret postgres-credentials -o jsonpath='{.data.POSTGRES_PASSWORD}' | base64 -d`

**Что ещё не сделано:** схема и seed в кластерной базе (миграции пока применялись только
к локальной), и приложения в кластере не развёрнуты.

### Грабли

- **`kubectl` в k3s — это симлинк на сам `k3s`**, и он читает `/etc/rancher/k3s/k3s.yaml` мимо
  `~/.kube/config`. Поэтому поставлен настоящий клиент kubectl из релиза Kubernetes.
- **Сеть на машине флапает**: установка Helm через `get.helm.sh` упала по таймауту, следующая
  попытка прошла. На больших загрузках (образы, чарты) стоит закладываться на повторы.
- **Порты 80/443 не видны в `ss` как слушатели** — ServiceLB в k3s проксирует их через iptables,
  а не биндится процессом. Это нормально и не признак проблемы.

## Что сделано

### Шаг 0 — закрыт
- Монорепо Nx 23.3.0 создано.
- Yarn 4.5.0 + `.yarnrc.yml` (`nodeLinker: node-modules`).
- Установлены плагины Nx: @nx/react, @nx/nest, @nx/js, @nx/angular, @nx/eslint, @nx/workspace.
- Созданы библиотеки:
    - `libs/shared-types` (tsc)
    - `libs/design-tokens` (tsc)
    - `libs/ui` (bundler: none, style: none)
- Созданы приложения:
    - `apps/shell` (consumer, Rspack) — порт 8100
    - `apps/mfe-credits` (provider, Rspack) — порт 8101
    - `apps/bff` (NestJS) — порт 3000
    - `apps/core-api` (NestJS) — порт 3001, `inspect: false`
- `.github/workflows/ci.yml` сгенерирован.
- `mf.ts` в shell написан (хардкод URL — будет заменён на runtime-конфиг в шаге 1).
- Проверено: shell и mfe-credits стартуют, remoteEntry.js отдаётся, HMR работает, `#RUNTIME-002` нет.
- `tsconfig.base.json` содержит алиасы `@credithub/*`.

## Что в работе (шаг 1)

- [x] Установка MUI, TanStack Query, React Router. (в корневом `package.json`) + объявлены в `apps/shell/package.json`: `@emotion/react`, `@emotion/styled`, `@mui/material`, `@tanstack/react-query`, `react-router-dom`. Проверено: `yarn install` не изменил `yarn.lock`, все пять резолвятся из shell, `nx run shell:build` — success.
- [x] Alias'ы `@credithub/ui` + `@credithub/design-tokens` для shell (`tsconfig.json` → `extends`, `resolve.alias` в `rspack.config.ts`). Проверено: `tsc --noEmit` и `nx run shell:build` — чисто.
- [ ] `libs/design-tokens`: colors.ts, spacing.ts, typography.ts, tokens.ts, index.ts. → **реализовано параллельно** (23:20:46, не мной), проверено сборкой — см. B1.
- [x] `libs/ui`: create-app-theme.ts, page-header.tsx, widget-shell.tsx, index.ts. → **реализовано параллельно** (22:57–23:04, не мной); используется провайдером и shell, проверено сборкой и вычисленными стилями.
- [x] `apps/shell/public/mfe-config.json` + `CopyRspackPlugin` + явный `devServer.static`. Проверено: в `dist/mfe-config.json` копируется (build success), dev-server отдаёт `/mfe-config.json` → `200 application/json` с верным содержимым, `/` → 200, `compiled successfully`. Порт 8100 после проверки освобождён.
- [x] `apps/shell/src/mf.ts` → `initFederation(config)` + `MfeConfig` + `lazyProvider`. Проверено: `tsc` exit 0, build success; реестр провайдеров больше не вкомпилирован в бандл (`registerRemotes` вызывается без литералов), `type:'module'` не добавлял (иначе `#RUNTIME-002` на UMD-провайдерах).
- [x] `apps/shell/src/main.tsx` → bootstrap с fetch mfe-config. Создан, `index.ts` переведён на `import('./main')`, `bootstrap.tsx` удалён. Проверено в headless Chrome против обоих dev-серверов: в DOM `#root` = `<main><h1>shell</h1><section data-testid="mfe-credits">…`, глобальные стили emotion несут токены (`color:#1A1F36`, `background-color:#F5F7FA`, `font-family:"Inter",…`) — тема, remote и граница ошибок работают.
- [x] `apps/shell/src/app/app.tsx` → AppBar + Drawer + Routes. `src/App.tsx` переехал в `src/app/app.tsx` (kebab-case, как в PLAN.md и libs/ui), `ProviderBoundary` вынесен в `src/app/provider-boundary.tsx`, `main.tsx` импортирует `./app/app`. Маршруты: `/` (Обзор), `/credits` (remote), `*` (не найдено). Проверено CDP: `/` рендерит обзор и **не делает ни одного запроса к 8101**; прямой заход на `/credits` работает (historyApiFallback) и грузит remote; клик по пункту меню навигирует на `/credits`; `/nope` → «Страница не найдена»; 0 исключений, 0 ошибок во всех четырёх сценариях.
- [x] `mfe-credits`: `src/credits-app.tsx` (PageHeader «Кредиты» + 3 × WidgetShell) + `expose ./CreditsApp`; standalone-`App.tsx` делегирует в него; shell переведён на `lazyProvider('mfe-credits','CreditsApp')`. Провайдеру добавлены `extends` базы, alias'ы `@credithub/ui` + `@credithub/design-tokens`, зависимости MUI/Emotion. Проверено CDP: `h1` = 24px/700 (токены h2), заголовок карточки = 20px/600 (h3), caption = 12px, радиус карточек = 8px, шрифт `Inter`, цвет `rgb(26,31,54)` (= `colors.text.primary`) — тема из shell применилась внутри remote.
- [x] Shared-зависимости в обоих rspack-конфигах. Shell: 7 пакетов из PROJECT.md. Провайдер: `react`, `react-dom`, `@mui/material`, `@emotion/react`, `@emotion/styled` (B2 закрыт — список расширен вместе с реальными импортами UI). У всех `singleton: true`, `strictVersion: false`, `requiredVersion: ^<installed>`. Проверено CDP: 0 предупреждений о версиях (было 7), 0 исключений, 0 упавших запросов.
- [x] Тема для standalone-провайдера. `CreditsApp` оборачивает себя в `ThemeProvider` (тема из `libs/ui`), а `src/bootstrap.tsx` (standalone-точка входа) добавляет `CssBaseline` — глобальные стили элементам тела не дело remote'а, поэтому в shell они не попадают. Проверено CDP в обоих режимах: заголовок remote «Кредиты» = 24px/700/`rgb(26,31,54)`/Inter **и** хосте, **и** standalone; standalone body = `rgb(245,247,250)`, Inter, `margin: 0`; заголовок AppBar shell остался 20px/600 (тема не подменена); 0 исключений. Дублирования стилей нет: `/` без remote = 82 тега emotion, `/credits` = 86.
- [x] Smoke-тест. Проведён через CDP, критерии приёмки — в `PLAN.md`. Итог: `/credits` грузит remote (3 карточки), тема одинаковая в shell и remote (вычисленные стили = токены), standalone с той же темой, `build:all` (4 проекта) и `lint:all` (5 проектов) чистые, HMR работает и для shell, и для remote. **HMR для remote починен** отдельным шагом — см. заметку ниже.

## Что осталось (шаги 2–9)

См. PLAN.md.

## Известные проблемы и их решения

### B1 (закрыт). `libs/design-tokens` был пустым скелетом — `libs/ui` из-за него не собирался
- Было: `libs/design-tokens/src/index.ts` реэкспортил отсутствующий `./lib/design-tokens`; вместо него четыре файла по 0 байт.
- Как обнаружено: пробник с `import { createAppTheme } from '@credithub/ui'` в сборке shell → `ESModulesLinkingError: export 'tokens' (imported as 'tokens') was not found in '@credithub/design-tokens' (module has no exports)`.
- **Закрыто параллельной правкой (23:20:46, не мной):** `colors.ts`, `spacing.ts`, `typography.ts`, `tokens.ts`, `index.ts` реализованы и совпадают с формой, которую требует `create-app-theme.ts`.
- Проверено мной после этого: `yarn tsc -p libs/design-tokens/tsconfig.lib.json --noEmit` → exit 0; сборка shell с пробником на `createAppTheme` → compiled successfully, в `dist/91.js` присутствует объект `colors` (`main:"#0B5FFF"`), то есть токены доехали в бандл через alias. Пробник удалён.

### B2 (закрыт). UI-стек провайдера не шарился

- Было: `apps/mfe-credits/src/App.tsx` — заглушка `<section><h1>Hello from mfe-credits</h1></section>`, MUI/Emotion не импортировались и не были заявлены, поэтому shared в провайдере ограничивался `react`/`react-dom`.
- Стало: `src/credits-app.tsx` рендерит `PageHeader`/`WidgetShell` из `libs/ui`, зависимости `@mui/material`, `@emotion/react`, `@emotion/styled` добавлены в `apps/mfe-credits/package.json`, alias'ы `@credithub/ui`/`@credithub/design-tokens` и `extends` добавлены в его конфиги, а `SHARED_PACKAGES` расширен теми же пакетами. `react-router-dom`/`@tanstack/react-query` остаются нешаримыми — провайдер их не импортирует.
- Подтверждение корректности шаринга: вычисленные стили MUI внутри remote совпадают с токенами `libs/ui` (`h1` 24px/700, caption 12px, радиус 8px) — значит ThemeProvider shell и Emotion работают через один экземпляр, рассинхрона кэша нет.

### B4 (закрыт как невоспроизводимый). Standalone-dev провайдера больше не падает

**Итог диагностики: дефект не воспроизводится на текущем коде.** Проверено: три перезагрузки подряд, холодный старт dev-сервера, свежий профиль Chrome, отдельный прогон с `Network.setCacheDisabled` и cache-buster в URL — каждый раз standalone-страница `http://localhost:8101/` рендерит 3 карточки, **0 ошибок в консоли**, единственный 404 — `favicon.ico`. Соседние сценарии тоже чисты: shell `/credits` (3 карточки) и `/calculator` (3 инпута) без ошибок.

**Что было найдено по пути (и почему прежняя картина вводила в заблуждение):**
- Прежний `ChunkLoadError` ссылался на файл `webpack_sharing_consume_default_emotion_styled_emotion_styled-webpack_sharing_consume_default-935cce.js`, то есть **с хеш-суффиксом**. Текущая сборка такой URL сгенерировать не может: `__webpack_require__.u` в dev — это просто `chunkId + ".js"`, без хеша ни в одной ветке. Значит ошибка приходила со сборки другой конфигурации.
- Вызовы `__webpack_require__.e("webpack_sharing_consume_…")` в текущем `remoteEntry.js` **есть** (4 штуки, внутри фабрик шаренных модулей), но при standalone-загрузке эти фабрики не исполняются: грузятся только `vendors-node_modules_*` чанки, и запроса к `webpack_sharing_consume_*` не происходит вообще (`sharingRequests: []`). Тупик прошлой диагностики был в том, что я считал эти вызовы гарантированно исполняемыми.
- Сравнил два дампа dev-бандла (старый и свежий): файлы идентичны по коду, различия только в хеше сборки и во взаимном порядке двух `__webpack_require__.e(...)`. То есть рантайм не менялся — менялось состояние сборки/браузера.
- Все прежние наблюдения ошибки приходятся на период экспериментов: включённый `eager: true`, `experiments.lazyCompilation: false`, промежуточный состав `SHARED_PACKAGES` в шаге 6c. Правки откатывались, но браузер и dev-сервер держали сборку того периода.

**Что осталось верным из прошлой диагностики:** в prod-сборке ссылок на `webpack_sharing_consume` нет вовсе (`grep` = 0), и `__webpack_require__.u` там же отдаёт `e352===e?"__federation_expose_CreditsApp":e)+".js"` — именно поэтому prod standalone работал всегда.

**Обходной путь из плана B4b (standalone через prod-сборку) не понадобился.** Если дефект вернётся, первым делом проверять: (1) есть ли у запрошенного файла хеш-суффикс — это признак чужой/старой сборки; (2) делать холодный прогон с `Network.setCacheDisabled` и cache-buster, потому что тёплый браузер может показывать артефакт прошлой конфигурации.

### B3 (закрыт). Dev-ошибки `[object Event]` в консоли — побочный лог rspack dev-server

- Исходный симптом: при загрузке shell в консоли появлялись `[ dynamic-remote-type-hints-plugin ] err: [object Event]`.
- **Источник найден по коду.** `@module-federation/dts-plugin` (`dist/index.js`) в dev-режиме добавляет в рантайм браузерный плагин `dynamic-remote-type-hints-plugin`, который открывает WebSocket на **жёстко зашитый** порт общего DTS-брокера (`DEFAULT_WEB_SOCKET_PORT = 16322`) и при ошибке делает `console.error(\`[ ${PLUGIN_NAME} ] err: ${err}\`)` — шаблонная строка превращает объект события в `[object Event]`, без ретраев.
- **Ошибка не воспроизводится.** После чистки и холодного старта (свежие `@mf-types`, `.mf`, профиль Chrome, оба dev-сервера) — 5 последовательных загрузок `/credits` подряд дали **0 ошибок**. Все прежние появления совпадали с запусками под `FEDERATION_DEBUG=1`; зависимость не доказана, но симптом нестабилен и на текущем состоянии не наблюдается.
- **Что происходит при холодном старте (из логов брокера).** Первая попытка подключения к `ws://<ip>:16322` падает (`Failed to connect`, code 1006), потому что фоновый брокер стартует с задержкой ~1 с; клиент dts переподключается и со второй-третьей попытки подключается. Браузерный плагин ретраев не имеет — если он попадёт в это окно, и появится одна строка ошибки.
- **Настоящий логгер этой строки — rspack, а не MF.** При повторной проверке консоль показала `[rspack-dev-server] Event`, и это код самого dev-server (`@rspack/dev-server/dist/198.js`): `client.on('error', (err) => { this.server.logger.error(err.message); })`. У `ws`-события `message` = `"Event"`, поэтому в лог уходит бессмысленная строка. Тот же дефект форматирования, что и у плагина MF.
- **Фикс рассмотрен и отклонён.** У `ModuleFederationPlugin` есть `dev.disableDynamicRemoteTypeHints` (проверено по схеме `@module-federation/enhanced`), который не добавляет браузерный плагин. Строгий A/B (одинаковый холодный сценарий, различие только в флаге) показал: **флаг ON — `apps/shell/@mf-types` не создаётся вообще** (типы remote пропадают, ломается автодополнение), флаг OFF — `index.d.ts` и `mfe-credits/` на месте, ошибок при этом тоже нет. Оставляем дефолт (флаг OFF) — иначе теряем типы ради косметики.
- **Итог:** функционально всё в порядке (типы генерируются, `@mf-types.zip` отдаётся, DOM и тема в норме), ошибки — редкий косметический артефакт dev-режима с плохим форматированием ошибки. Чинить по-настоящему можно только апстримом: и `@module-federation/dts-plugin`, и `@rspack/dev-server` должны проверять `err instanceof Error` перед `err.message`.

### Прочие проблемы

| Проблема | Решение |
|---|---|
| `Property 'ci' does not match the schema` | `--nxCloud=skip` при создании workspace, CI-воркфлоу отдельной командой |
| `@nx/react:host is deprecated` | Использовать `@nx/react:consumer --providerNames=...` |
| `Property 'style' does not match the schema` (lib) | `--style=none`, Emotion ставим вручную |
| `Property 'bundler' does not match the schema` (lib) | `--bundler=none` для библиотек, Rspack только для apps |
| `Property 'inspect' does not match the schema` | В `project.json`: `"inspect": false`, порты только в `port` |
| `EADDRINUSE :::3000` | bff=3000, core-api=3001, вручную в project.json и main.ts |
| Nx Daemon `FOREIGN KEY constraint failed` | `yarn nx reset`; если повторяется — `"useDaemonProcess": false` в nx.json |
| `MODULE_TYPELESS_PACKAGE_JSON` warning | Добавить `"type": "module"` в package.json приложения |
| `favicon.ico 404` | Положить favicon в public/ (косметика, шаг 1) |

## Открытые вопросы

- Нет.

## Заметки на будущее

- `strict: false` в tsconfig.base.json — включим на шаге 3–4, починим ошибки.
- На шаге 7 runtime-конфиг `mfe-config.json` будет подменяться через ConfigMap
  в k8s — важно не забыть, что URL'ы должны быть относительными или
  конфигурируемыми через окружение.

- Параллельно с агентом в этом проекте кто-то правит файлы (в одном проходе изменились `PROGRESS.md` и `libs/design-tokens/*`). Перед `write`/`edit` перечитывать файл, а `ls`-размерам не доверять: они показывали `PROGRESS.md`/`PLAN.md`/`PROJECT.md` нулевыми, хотя те были заполнены.
- `git diff` и `git status` показывают незакоммиченную работу параллельной сессии (реформат `apps/shell/package.json`, `yarn.lock` +288 строк, staged-удаления `libs/*`). Отличать свои правки от чужих по `stat -f %Sm`, а не по diff.
- Запускать приложения из каталога приложения через `yarn <script>` нельзя: Yarn 4 ругается `doesn't seem to be part of the project`, т.к. в корневом `package.json` нет `workspaces`. Использовать `nx run <app>:serve` или напрямую `../../node_modules/.bin/rspack serve`.
- **Не задавать `shared: { pkg: { requiredVersion: 'auto' } }`.** В MF 2.9.2 сборка оставляет строку `'auto'` как есть, а `getRegisteredShare` в `@module-federation/runtime-core/dist/utils/share.js` сравнивает её буквально: `typeof requiredVersion === 'string' && !satisfy(version, requiredVersion)`. Для **каждого** shared-пакета в консоль летит `Version X from shell of shared singleton module Y does not satisfy the requirement of undefined which needs auto)`. Лечится подстановкой реального диапазона (`^${version}` из `node_modules/<pkg>/package.json`). В этой версии `'auto'` фактически не работает.
- Проверку федерации удобно гонять через CDP (Chrome `--remote-debugging-port` + встроенный `WebSocket` в Node 24): скрипт слушает `Runtime.consoleAPICalled`, `Runtime.exceptionThrown`, `Network.loadingFailed` и читает DOM/`getComputedStyle`. Так были пойманы и warning'и `'auto'`, и DTS-ошибки, и дублирование пунктов меню — headless-скриншот этого не показывает.
- Дубли в DOM ловятся через `document.querySelectorAll('.MuiListItemText-primary').length`. Причиной был `ModalProps={{ keepMounted: true }}` у `Drawer variant="temporary"`: закрытая мобильная панель остаётся в DOM на десктопе, и её пункты доступны фокусу и скринридеру. Не ставить `keepMounted`, если в приложении есть второй, постоянный Drawer.
- Вложенный `ThemeProvider` в remote безопасен и почти бесплатен: по коду `@mui/system/ThemeProvider/ThemeProvider.js` тема-объект **заменяет** внешнюю (`{...upperTheme, ...localTheme}`), а не мержится глубоко, и `createAppTheme()` детерминирована. Замерено: `/` без remote = 82 тега `style[data-emotion]`, `/credits` с remote = 86. При этом `CssBaseline` в remote добавлять не нужно — глобальная стилизация `body` принадлежит корню приложения (в провайдере это `src/bootstrap.tsx`), иначе она конфликтует с такой же в shell.
- Если понадобится новая тема (тёмная), а не только одинаковый дефолт: `createAppTheme()` параметров не принимает, так что remote всегда будет рисовать светлую тему независимо от темы хоста. Для тёмной темы понадобится либо передавать выбор в remote через общий контекст/`shared`, либо держать переключатель в `libs/ui` и синхронизировать его между приложениями.
- Проверка страницы в headless Chrome: `timeout` в macOS отсутствует; `--dump-dom` и `--screenshot` **не завершают процесс** из-за открытого HMR-сокета (снимок при этом успевает сохраниться). Рабочий приём — запустить Chrome фоном, дождаться появления `</html>` в файле и затем `pkill`.
- **HMR не обновляет код remote в смонтированном хосте — только перезагрузка страницы.** Контейнер провайдера новый код получает: свежий `loadRemote('mfe-credits/CreditsApp')` **вне React-фазы** возвращает обновлённый модуль и рендерит новый текст (`Кредиты PROBE`). Но `React.lazy`, который уже смонтирован, продолжает отдавать модуль от первого разрешения: пересоздание lazy по счётчику версии (и со сбросом кэша через `registerRemotes([remote], { force: true })`, и без него) новый модуль в живом приложении не подхватывало, хотя фабрика lazy вызывалась заново (видно по числу загрузок) и хеш сборки менялся. Практический вывод: правки `apps/mfe-credits/src/*` смотреть после перезагрузки. HMR собственного кода shell работает.
- **Не подключать HMR-сокет провайдера ради «живого» обновления remote.** Такая попытка (хук `useProviderVersion`, удалён) давала бесконечный цикл: сокет к 8101 закрывается, переподключение через 3 с присылает те же кадры `hash`/`ok`, каждый кадр пересоздавал `React.lazy` → размонтирование и снова «Loading ...». Замер: **80 сокетов, 79 открытий и 474 кадра за 24 секунды**, `remoteEntry` запрашивался повторно. После удаления моста — 1 сокет, 1 загрузка `remoteEntry`, 0 миганий. Если такой мост понадобится, реагировать только на *изменение* хеша и обязательно проверять, что код remote реально обновился в DOM.
- `mf.tsx` вместо `mf.ts`: в модуле появился JSX, а `.ts` rspack/swc не парсит (`Syntax Error: Expected '>', got '{'`). Импорты менять не нужно — они без расширения.
- **Генераторы Angular и `vitest`.** `nx g @nx/angular:application` падает с «The installed vitest version "5.0.1" is not compatible… packages that peer vitest 4 and below». Обход — `--unitTestRunner=none --e2eTestRunner=none` (приложение генерируется без тестового раннера). Если тесты для Angular понадобятся, сначала придётся решить вопрос версии vitest в корне, а не тянуть её вниз.
- **IDE-ошибка `TS2591: Cannot find name 'node:path'` — не ошибка сборки, и лечится структурой tsconfig.** `tsc` по `apps/*/tsconfig.json` проходил с exit 0, потому что `include` там был ограничен `src/`, и `rspack.config.ts` не попадал ни в один проект: языковой сервис IDE валидировал его по неявному конфигу без `@types/node`. Сам `@types/node` (22.20.5) в репозитории есть — дело было в покрытии файла. Контрольный опыт подтвердил: тот же файл без `types: ["node"]` даёт ровно эти ошибки, с ним — exit 0. **Первый вариант фикса не сработал:** отдельный `tsconfig.node.json` работает из CLI (`tsc -p`), но IDE его не видит — она ищет только файл с именем `tsconfig.json` в каталоге и выше. Поэтому оба приложения переведены на «solution-style» схему, как уже сделано у Angular-приложения: `tsconfig.json` стал агрегатором (`files: []` + `references`), app-конфиг переехал в `tsconfig.app.json`, а конфиг-файлы описаны в `tsconfig.node.json` (`types: ["node"]`, `include: ["rspack.config.ts"]`). Оба листовых конфига наследуют `tsconfig.base.json` напрямую, чтобы не зависеть от solution-файла. Побочно: `tsc -b` создаёт `*.tsbuildinfo` — добавлены в `.gitignore`.
- **Yarn не подтягивает peer-зависимости автоматически.** `@nx/module-federation` (peer у `@nx/angular`) после установки Angular отсутствовал — его нужно добавлять в корневой `package.json` явно, иначе генераторы федерации не заработают.
- **Не отключать `dev.disableDynamicRemoteTypeHints` ради тишины в консоли.** Проверено A/B: с этим флагом `apps/shell/@mf-types` не создаётся вообще — remote-типы пропадают, а вместе с ними автодополнение и проверка контракта `mfe-credits/CreditsApp`. Ошибка, которую так пытаются убрать, косметическая и нестабильная (см. B3).
- Диагностику конфигурации MF удобно вести через `FEDERATION_DEBUG=1`: `@module-federation/dts-plugin` начинает писать `apps/<app>/.mf/typesGenerate.log` с шагами подключения к брокеру (`ADD_PUBLISHER`, `FETCH_TYPES`, попытки реконнекта). После отладки каталоги `.mf` удалять — они не в `.gitignore`.
- **`test:all` был красным из-за отсутствия тестов, а не из-за поломки.** `libs/ui` не имеет `test`-таргета в `project.json` — его создаёт инференс Vite-плагина Nx из `vite.config.mts`, а спек-файл генератора (`ui.spec.tsx`) был удалён при разделении библиотеки на компоненты. `vitest` на «No test files found» выходит с кодом 1, и падал весь прогон. Добавлен `passWithNoTests: true` в `test`-секцию `libs/ui/vite.config.mts`. Если появятся настоящие тесты — флаг не помешает, а `test:all` перестанет врать.
- Удалённые `design-tokens.ts` и `design-tokens.spec.ts` числятся в индексе git как staged-удаления (из более ранней миграции) — не коммитить вслепую вместе со своими правками.

## Как продолжать работу

1. Открыть `PROJECT.md` — понять контекст и решения.
2. Открыть `PLAN.md` — увидеть весь маршрут.
3. Открыть `PROGRESS.md` — увидеть, где мы сейчас.
4. Продолжить с первого незакрытого пункта в PROGRESS.md.
5. После завершения шага — обновить PROGRESS.md и поставить ✅ в PLAN.md.


