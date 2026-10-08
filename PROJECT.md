# CreditHub — кредитный портал банка (pet-проект)

## 1. Цель

Pet-проект для практики и подготовки к собеседованиям.
Фокус — микрофронтенды, Docker/k3s/Helm/CI-CD, BFF-архитектура.
Работаем без упрощений: делаем так, как делали бы в проде.

## 2. Домен

Кредитный раздел банка для клиентов: кредиты, рассрочки, программы, калькулятор,
личный кабинет, заявки, поддержка.

## 3. Ключевые технические решения (зафиксированы)

| Область | Решение | Почему |
|---|---|---|
| Монорепо | Nx 23.3.0 | Лучшие генераторы для MFE, гетерогенного стека (React + Angular + NestJS) |
| Пакетный менеджер | Yarn 4 (Berry) + nodeLinker: node-modules | Без PnP-граблей с Angular/NestJS/MF |
| Фронт (shell + React MFE) | React + TypeScript + Rspack (Rsbuild для SSR-раздела) | Официальная поддержка MF 2.0 в Nx |
| Angular MFE | Angular + @angular-architects/module-federation | Отдельный MFE на Angular для практики гетерогенности |
| SSR | Гибрид: SSR для публичных разделов, CSR для авторизованных | SSR + MF — тяжёлая комбинация, полный SSR не оправдан |
| Module Federation | MF 2.0 (dynamic), @module-federation/enhanced | Независимый деплой, runtime-конфиг URL'ов |
| UI | MUI + Emotion, общая дизайн-система в libs/ui + libs/design-tokens | Единый интерфейс, тема прокидывается в remote через ThemeProvider |
| Состояние | TanStack Query + Zustand | Серверное / клиентское |
| Бэкенд | NestJS (BFF + Core API раздельно) + TypeORM + PostgreSQL | Чёткая граница BFF↔Core, лёгкое выделение микросервисов позже. TypeORM вместо Prisma: он нативен для NestJS (`@nestjs/typeorm`), не требует отдельного codegen-шага и лишней зависимости |
| Auth | Keycloak (OIDC) — с самого начала | Ближе к реальности банка |
| Локальная инфра | docker-compose | Простота на старте |
| Прод-инфра | k3s на домашнем сервере (i7-8700K, 16GB RAM) | Лёгкий, сертифицированный k8s |
| Ingress | Traefik (встроен в k3s) | Zero-config |
| Helm | Helm-чарты на каждый сервис | Стандарт индустрии |
| Registry | GHCR | Бесплатно для публичных реп |
| CI | GitHub Actions | Публичный репо |
| CD | ArgoCD (GitOps) | Практика GitOps |
| Observability (позже) | OpenTelemetry + Prometheus + Grafana + Loki | Финальный polish |

## 4. Архитектура

    ┌──────────────────────────────┐
    │  Traefik Ingress (k3s)       │
    └──────────────┬───────────────┘
                   │
    ┌──────────────┼────────────┬────────────────────┐
    ▼              ▼            ▼                    ▼
    /          /mfe/programs/*  /api/*              /auth/*
    Shell      Programs MFE     BFF (NestJS)        Keycloak
    (SSR+CSR)  (React, SSR)         │
        │                            ▼
        │ MF 2.0 remotes         Core API (NestJS)
        ├──▶ mfe-credits (React)      │
        ├──▶ mfe-installments         ▼
        ├──▶ mfe-programs (SSR)    PostgreSQL
        └──▶ mfe-calculator (Angular)

### Структура монорепо

    credithub/
    ├── apps/
    │   ├── shell/              # React host (consumer), MF 2.0, Rspack
    │   ├── mfe-credits/        # React remote (provider), MF 2.0, Rspack
    │   ├── mfe-installments/   # React remote (планируется)
    │   ├── mfe-programs/       # React remote + SSR (планируется)
    │   ├── mfe-calculator/     # Angular remote (планируется)
    │   ├── bff/                # NestJS — точка входа для фронта
    │   └── core-api/           # NestJS + TypeORM — доменная логика
    ├── libs/
    │   ├── shared-types/       # DTO, общие типы (tsc)
    │   ├── design-tokens/      # цвета, отступы, типографика (tsc)
    │   └── ui/                 # MUI-обёртки, тема (bundler: none)
    ├── .github/workflows/ci.yml
    ├── .yarn/releases/yarn-4.5.0.cjs   # коммитим
    ├── .yarnrc.yml                     # nodeLinker: node-modules
    ├── nx.json
    ├── package.json
    ├── tsconfig.base.json
    └── yarn.lock

### Алиасы TypeScript (tsconfig.base.json)

    "paths": {
      "@credithub/shared-types": ["./libs/shared-types/src/index.ts"],
      "@credithub/design-tokens": ["./libs/design-tokens/src/index.ts"],
      "@credithub/ui": ["./libs/ui/src/index.ts"]
    }

### Порты (dev)

| Приложение | Порт |
|---|---|
| shell | 8100 |
| mfe-credits | 8101 |
| mfe-installments | 8102 (план) |
| mfe-programs | 8103 (план) |
| mfe-calculator | 8104 (план) |
| bff | 3000 |
| core-api | 3001 |
| Keycloak | 8080 (план) |
| PostgreSQL | 5432 |

### Shared-зависимости MF

react, react-dom, react-router-dom, @mui/material, @emotion/react,
@emotion/styled, @tanstack/react-query — все singleton, strictVersion: false,
requiredVersion: auto.

libs/ui и libs/design-tokens НЕ кладём в shared — они собираются внутрь
бандла каждого приложения.

## 5. Что НЕ делаем (границы)

- Не используем Nx Cloud.
- Не используем Yarn PnP.
- Не делаем полный SSR всего приложения — только гибрид.
- Не плодим микросервисы на бэкенде на старте — модульный монолит в core-api.
- Не воюем с @nx/react:host — используем новый @nx/react:consumer / provider.

## 6. Ключевые грабли (проверено на практике)

- Nx 23: --ci и --nxCloud — одно поле. skip вместо false.
- Nx 23: @nx/react:host deprecated → используем @nx/react:consumer (флаг --providerNames=, не --remotes=).
- Nx 23: генераторы lib не принимают --style=@emotion/styled и --bundler=rspack. Используем --style=none --bundler=none, Emotion ставим вручную.
- Nx 23: inspect в project.json — только boolean или "inspect"/"inspect-brk". Никаких портов.
- Nx 23: баг FOREIGN KEY constraint failed в Daemon с Yarn 4 + node-modules. Лечится nx reset или useDaemonProcess: false.
- NestJS-генераторы ставят всем приложениям порт 3000 и inspector 9229 — правим вручную.
- Rspack отдаёт статику shell на 8100, provider на 8101.
