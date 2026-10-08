# CreditHub

Учебный проект: личный кабинет банковского клиента с портфелем кредитов, собранный
на микрофронтендах.

Смысл проекта — потренироваться на честной гетерогенности: **три remote-приложения
на разных фреймворках и разных сборщиках** живут в одном интерфейсе, публичный
раздел отдаётся серверным рендером, а данные приходят из PostgreSQL через BFF и
доменный сервис. Ничего из этого не «понарошку»: у каждого сервиса свой стек,
своя сборка и свой деплой.

---

## Содержание

- [Как это устроено](#как-это-устроено)
- [Технологии](#технологии)
- [Модули](#модули)
- [Требования](#требования)
- [Запуск](#запуск)
- [База данных](#база-данных)
- [Проверки и разработка](#проверки-и-разработка)
- [Развёртывание: инфраструктура](#развёртывание-инфраструктура)
- [Известные особенности](#известные-особенности)
- [Документация проекта](#документация-проекта)

---

## Как это устроено

Вход один — ingress на `:8080`. Он повторяет прод-схему маршрутизации (в k3s её
играет Traefik):

```
                        ┌──────────────────────┐
                        │  ingress  :8080      │
                        └──────────┬───────────┘
             ┌─────────────────────┼──────────────────────┐
             ▼                     ▼                      ▼
     /programs,            /api/*                  всё остальное
     /mfe/programs/*          │                         │
             │                ▼                         ▼
             ▼          BFF  :3000  ──HTTP──▶   shell  :8100
   mfe-programs SSR              │              (SPA + оркестрация)
        :8106                    ▼
                          core-api  :3001
                                │
                                ▼
                        PostgreSQL  :5433
```

Ключевые решения:

- **Shell не знает адресов remote'ов на этапе сборки.** Провайдеры перечислены в
  `apps/shell/public/mfe-config.json` и регистрируются в рантайме
  (`registerRemotes` / `loadRemote`). Один и тот же бандл shell работает в любом
  окружении — меняется только конфиг.
- **Граница между BFF и core-api настоящая:** BFF ходит в core-api по HTTP, а не
  в общую базу. Наружу через ingress выставлен только BFF — фронт не имеет
  доступа к доменному сервису.
- **Публичный раздел — отдельный сервис, а не remote.** «Программы» отдаются
  серверным рендером со своего документа и своей темы, поэтому в меню shell это
  обычная ссылка, а не переход внутри SPA.
- **Тема одна на разные фреймворки.** Shell публикует дизайн-токены как
  CSS-переменные (`--ch-*`), а React- и Angular-приложения только ссылаются на
  них — ни одно из них не владеет стилями другого.

---

## Технологии

| Слой | Технология | Версия |
|---|---|---|
| Монорепозиторий | Nx | 23.3.0 |
| Пакетный менеджер | Yarn (Berry, `node-modules`) | 4.5.0 |
| Язык | TypeScript | 6.0.3 |
| UI-библиотека | React | 19 |
| Компоненты | MUI + Emotion | 9.4 / 11.14 |
| Второй фреймворк | Angular (zoneless) | 22.2.1 |
| Микрофронтенды | Module Federation (`@module-federation/enhanced`) | 2.9.2 |
| Сборка React | Rspack | 2.2.8 |
| Сборка SSR-раздела | Rsbuild | 2.2.12 |
| Сборка Angular | webpack (`@nx/angular`) | — |
| Серверный рендер | `react-dom/server` + Express | 5 |
| Бэкенд | NestJS | 11 |
| ORM | TypeORM | 1.1.2 |
| БД | PostgreSQL | 17.5 |
| Серверное состояние | TanStack Query | 5 |

---

## Модули

| Модуль | Стек | Порт | Что делает |
|---|---|---|---|
| `apps/shell` | React + Rspack | 8100 | Каркас приложения: меню, маршруты, тема, рантайм-реестр провайдеров |
| `apps/mfe-credits` | React + Rspack | 8101 | Портфель кредитов клиента, данные из BFF через TanStack Query |
| `apps/mfe-calculator` | Angular + webpack | 8104 | Калькулятор аннуитетного платежа. Монтируется в React через контракт `mount(element)` |
| `apps/mfe-programs` | React + Rsbuild + Express | 8105 (dev) / **8106** (SSR) | Публичный каталог программ с серверным рендером и гидратацией |
| `apps/bff` | NestJS | 3000 | Единственная точка API для фронта: `/api/*`. Проксирует доменные данные |
| `apps/core-api` | NestJS + TypeORM | 3001 | Доменная логика и доступ к PostgreSQL |
| `libs/ui` | React + MUI | — | Общие компоненты (`PageHeader`, `WidgetShell`), тема, настройки запросов |
| `libs/design-tokens` | TypeScript | — | Цвета, отступы, типографика и генерация CSS-переменных |
| `libs/shared-types` | TypeScript | — | Контракты API (`CreditDto`, `ProgramDto`), деньги, общий расчёт аннуитета |
| `tools` | Node + Express | 8080 | Локальный ingress: маршрутизация как в проде |

**Про деньги.** Все суммы передаются в минорных единицах (копейках) целым числом
— так же, как хранятся в базе. Дробные рубли в `float` дают ошибки округления при
суммировании портфеля, а конвертация «рубли ↔ копейки» на каждом слое — источник
расхождений. Форматирование в `1 250 000 ₽` — задача UI.

---

## Требования

- **Node.js 24** (проверено на 24.21)
- **Yarn 4.5** — поставляется через `packageManager` в `package.json`, ставить
  глобально не нужно
- **Docker** с запущенным демоном — для PostgreSQL

---

## Запуск

### 1. Зависимости

```sh
yarn install
```

### 2. Переменные окружения

```sh
cp .env.example .env
```

В `.env` уже прописаны рабочие значения для локального запуска. Важная деталь:
`CORE_API_URL` **обязан включать префикс `/api`** (`http://localhost:3001/api`) —
core-api регистрирует все маршруты под ним. Без префикса BFF получает 404 на
каждом запросе.

### 3. База данных

```sh
docker compose up -d
```

Поднимается PostgreSQL 17 на порту **5433**. Дождитесь статуса `healthy`:

```sh
docker compose ps
```

### 4. Схема и демо-данные

```sh
yarn nx run core-api:migration:run   # создать таблицы
yarn nx run core-api:seed            # загрузить демо-данные
```

Seed идемпотентен: повторный запуск ничего не сделает, если данные уже есть.
Загружается клиент, три кредитные программы и три кредита с графиками платежей
(312 платежей, 42 из них внесены).

### 5. Приложения

**Вариант «одной командой»** — поднимает всё сразу: shell, оба remote'а, BFF,
core-api, SSR-сервис и ingress.

```sh
yarn dev:all
```

Останавливается одним `Ctrl+C`: сигнал гасит и сервисы, и ingress, лишних
процессов не остаётся.

**Вариант «по частям»** — удобнее, когда нужно перезапускать что-то одно:

```sh
yarn dev:front     # shell (:8100), mfe-credits (:8101), mfe-calculator (:8104)
yarn dev:back      # BFF (:3000), core-api (:3001)
yarn dev:ssr       # SSR-раздел: сборка + Express (:8106)
yarn dev:ingress   # ingress (:8080)
```

Публичный SSR-раздел собирается дольше остальных: перед запуском Express
Rsbuild делает клиентскую и серверную сборки.

**Открывайте приложение через ingress: <http://localhost:8080>.** Прямые порты
тоже работают (например, <http://localhost:8100> для shell), но именно ingress
повторяет прод-схему: `/programs` уходит в SSR-сервис, `/api/*` — в BFF.

---

## База данных

| Команда | Что делает |
|---|---|
| `docker compose up -d` | Поднять PostgreSQL |
| `docker compose ps` | Проверить статус (`healthy`) |
| `docker compose down` | Остановить (данные сохранятся в томе) |
| `docker compose down -v` | Остановить и **удалить данные** |
| `yarn nx run core-api:migration:run` | Применить миграции |
| `yarn nx run core-api:migration:revert` | Откатить последнюю миграцию |
| `yarn nx run core-api:migration:show` | Показать статус миграций |
| `yarn nx run core-api:migration:generate --name=Имя` | Сгенерировать миграцию по изменениям сущностей |
| `yarn nx run core-api:seed` | Загрузить демо-данные |

Подключиться к базе напрямую:

```sh
docker compose exec postgres psql -U credithub -d credithub
```

Команды работы с базой помечены как некэшируемые (`cache: false`). Это важно для
`migration:show`: это запрос состояния, и с кэшем Nx он мог бы показать статус
на момент предыдущего запуска. По той же причине `migration:run` не может
«пройти успешно», не тронув базу.

**Почему порт 5433, а не 5432.** 5432 — стандартный порт PostgreSQL, и на машине
разработчика почти всегда уже что-то на нём висит. Проект занимает 5433, чтобы не
конфликтовать с локальной установкой или другим контейнером. Если меняете порт —
поправьте `DATABASE_URL` в `.env`.

Данные лежат в именованном томе `credithub-pgdata` и переживают перезапуск
контейнера. Схема меняется **только миграциями**: `synchronize` выключен, чтобы
TypeORM не переписывал таблицы молча.

---

## Проверки и разработка

```sh
yarn build:all    # сборка всех шести проектов
yarn lint:all     # линт семи проектов
yarn test:all     # тесты
yarn nx graph     # граф зависимостей проектов
```

Запуск отдельного проекта:

```sh
yarn dev:all                      # всё сразу + ingress, Ctrl+C останавливает
yarn nx run mfe-programs:dev      # dev-сервер Rsbuild (:8105), отладка CSR-версии
yarn nx run <project>:serve       # любой проект
yarn nx <target> <project>        # произвольная цель
```

### Полная таблица портов

| Порт | Сервис | Команда запуска |
|---|---|---|
| 8080 | ingress — точка входа | `yarn dev:ingress` |
| 8100 | shell | `yarn dev:front` |
| 8101 | mfe-credits | `yarn dev:front` |
| 8104 | mfe-calculator | `yarn dev:front` |
| 8105 | mfe-programs, dev-сервер Rsbuild | `yarn nx run mfe-programs:dev` |
| 8106 | mfe-programs, SSR-сервер | `yarn dev:ssr` |
| 3000 | BFF | `yarn dev:back` |
| 3001 | core-api | `yarn dev:back` |
| 5433 | PostgreSQL | `docker compose up -d` |

Все семь сервисов, кроме опционального `:8105`, поднимаются одной командой
`yarn dev:all`.

### Быстрая проверка, что всё живо

```sh
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:8080/credits
curl -s http://localhost:8080/api/credits | head -c 200
curl -s http://localhost:8080/programs | grep -c 'programs-section'   # SSR: разметка в исходном HTML
```

---

## Развёртывание: инфраструктура

Прод-инфраструктура — **k3s на домашнем ПК** (в [PROJECT.md](PROJECT.md) под неё
заложен именно k3s; манифесты и чарты появятся на следующих шагах).

Подготовка Linux-машины выполняется скриптом:

```sh
bash infra/setup-k3s.sh
```

Скрипт идемпотентен и ставит:

| Компонент | Версия | Примечание |
|---|---|---|
| k3s | 1.36.x | с `--disable traefik`: Traefik ставим сами через Helm |
| kubectl | 1.37.x | настоящий клиент, не симлинк k3s |
| Helm | 3.x | намеренно не 4.x — мажор в фундаменте не нужен |
| Traefik | 3.x | чарт в namespace `traefik`, `LoadBalancer` через ServiceLB k3s |

Требуется passwordless sudo у пользователя, который запускает скрипт.

Проверка после установки: `curl http://<IP-машины>/` отвечает **404 от Traefik** —
это нормально, значит ingress слушает, но маршрутов ещё нет.

### Доступ к кластеру с рабочей машины

На самой машине kubeconfig лежит в `~/.kube/config` (создаётся скриптом
`infra/setup-k3s.sh`, с адресом API по IP, а не по `127.0.0.1`). Чтобы работать с
кластером со своей машины, скопируйте его и укажите путь:

```sh
scp <user>@<host>:~/.kube/config ~/.kube/credithub.yaml
chmod 600 ~/.kube/credithub.yaml
export KUBECONFIG=$HOME/.kube/credithub.yaml
```

**Это cluster-admin доступ** — файл содержит клиентский сертификат администратора,
поэтому он не должен попадать ни в git, ни в чужие руки.

Helm должен быть **той же мажорной версии, что в кластере** (там сейчас 3.22.0):
разные мажоры управляют одними релизами по-разному. Для установки ровно 3.x:

```sh
brew install helm@3          # формула keg-only
ln -sf /opt/homebrew/opt/helm@3/bin/helm /opt/homebrew/bin/helm
helm version --short         # v3.22.0
```

С этим kubeconfig работают и GUI-клиенты (Lens, Freelens, Headlamp, k9s): им нужен
тот же файл.

### Сборка образов

Образы описываются в `infra/docker/`, контекст сборки — **корень репозитория**
(приложению нужны корневой `yarn.lock` и yarn-релиз из `.yarn/releases`):

```sh
docker build -f infra/docker/core-api.Dockerfile -t credithub/core-api:dev .
```

**Собирать нужно нативно на целевой архитектуре.** Кросс-сборка под эмуляцией
QEMU падает на `nx build` с `Segmentation fault`, хотя обычный Node под той же
эмуляцией работает. То есть образ для x86_64-хоста собирается на самом хосте,
а не на arm64-машине разработчика.

`node_modules` в образ переносится целиком, а не ставится по сгенерированному
`dist/package.json`: в нём **отсутствует `pg`**, и установка по списку оставила бы
рантайм без драйвера базы. Плата — размер образа.

### Реестр образов (GHCR)

k3s использует containerd, поэтому образ, собранный в Docker на хосте, кластеру не
виден — образы публикуются в GHCR.

```sh
# 1) токен GitHub с правом write:packages (классический PAT)
echo "<TOKEN>" | docker login ghcr.io -u <username> --password-stdin

# 2) владелец в имени образа — в НИЖНЕМ регистре, это требование GHCR
docker tag credithub/core-api:dev ghcr.io/<username>/credithub-core-api:dev
docker push ghcr.io/<username>/credithub-core-api:dev

# 3) доступ кластера к приватному реестру
kubectl -n credithub create secret docker-registry ghcr-pull \
  --docker-server=ghcr.io --docker-username=<username> --docker-password=<TOKEN>
```

`imagePullSecrets` в чарте должен быть **списком объектов** (`- name: ghcr-pull`), а не
строк: `helm template` список строк пропускает, а API-сервер отвергает манифест.

### Сервисы в кластере

Сервисы разворачиваются чартами из `infra/charts/`. Namespace — **отдельный чарт**:
это ресурс кластерного уровня, и если бы им владел чарт сервиса, то удаление сервиса
сносило бы namespace вместе со всем остальным.

```sh
# один раз: namespace под управление Helm
helm upgrade --install namespace infra/charts/namespace --namespace credithub

# секрет с паролем (в git не хранится)
kubectl -n credithub create secret generic postgres-credentials \
  --from-literal=POSTGRES_USER=credithub \
  --from-literal=POSTGRES_DB=credithub \
  --from-literal=POSTGRES_PASSWORD="$(openssl rand -base64 24)" \
  --dry-run=client -o yaml | kubectl apply -f -

# база
helm upgrade --install postgres infra/charts/postgres --namespace credithub --wait
```

База доступна внутри кластера как `postgres.credithub.svc.cluster.local:5432` и **не
выставлена наружу**. Схема и демо-данные применяются к ней теми же командами, что и к
локальной базе, но через туннель.

**Доступ с рабочей машины — двухступенчатый**, потому что на хосте порт базы не слушает:

```sh
# 1) на машине с кластером: проброс из кластера на её localhost
#    (setsid - иначе проброс умрёт вместе с SSH-сессией)
setsid nohup kubectl -n credithub port-forward svc/postgres 15433:5432 \
  >/tmp/pf.log 2>&1 < /dev/null &

# 2) со своей машины: туннель до этого проброса
ssh -N -L 15433:127.0.0.1:15433 romanzuev@192.168.1.187

# 3) схема и данные
DATABASE_URL="postgres://credithub:<пароль>@127.0.0.1:15433/credithub" \
  yarn nx run core-api:migration:run
DATABASE_URL="postgres://credithub:<пароль>@127.0.0.1:15433/credithub" \
  yarn nx run core-api:seed
```

Пароль:

```sh
kubectl -n credithub get secret postgres-credentials \
  -o jsonpath='{.data.POSTGRES_PASSWORD}' | base64 -d
```

Проверка состояния:

```sh
kubectl -n credithub get pods,pvc,svc
kubectl -n credithub exec postgres-0 -- psql -U credithub -d credithub -c '\l'
```

**Грабли, найденные при настройке:**

- `kubectl` в k3s — симлинк на сам `k3s`, и он читает
  `/etc/rancher/k3s/k3s.yaml` мимо `~/.kube/config`, поэтому нужен отдельный клиент.
- Порты 80/443 не видны в `ss` как слушатели: ServiceLB в k3s проксирует их через
  iptables, а не биндится процессом.

## Известные особенности

- **Авторизации пока нет.** Владелец портфеля определяется константой
  `DEMO_CLIENT_ID` в `core-api`. Когда появится Keycloak/OIDC, идентификатор
  придёт из токена, а форма вызова сервиса не изменится.
- **HMR не обновляет код remote в смонтированном хосте** — после правок в remote
  нужна перезагрузка страницы. Собственный HMR shell работает.
- **Относительные пути к API.** Фронт обращается к `/api/*` без хоста: в dev его
  проксирует дев-сервер, в проде — ingress. Адреса бэкенда в приложениях нет
  намеренно.
- **SSR-раздел не использует федерацию.** Публичный раздел — самостоятельный
  сервис со своим документом; кросс-бандлерная загрузка Rsbuild-remote была
  проверена и задокументирована, но в текущей архитектуре не нужна.
- **`uuid-ossp`** уже включён в образе PostgreSQL, поэтому миграции работают без
  отдельного `CREATE EXTENSION`. Для «голого» Postgres этот шаг понадобится.

---

## Документация проекта

| Файл | О чём |
|---|---|
| [PROJECT.md](PROJECT.md) | Архитектурные решения и их обоснование, схема инфраструктуры |
| [PLAN.md](PLAN.md) | Маршрут разработки по шагам с критериями приёмки |
| [PROGRESS.md](PROGRESS.md) | Журнал работы: что сделано, что проверено, какие грабли найдены |
| [AGENTS.md](AGENTS.md) | Правила работы агента в этом репозитории |
