import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';

/** Порт из .env (`BFF_PORT`), со стандартным значением на случай его отсутствия. */
const DEFAULT_PORT = 3000;

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Без `exclude`: с ним (Nest 11 + Express 5) маршруты контроллеров перестают
  // получать префикс - `/api/credits` начинал отвечать 404, хотя в логе маршрут
  // значился как `/api/credits`. Проба живости поэтому живёт под тем же
  // префиксом: `/api/health`.
  app.setGlobalPrefix('api');

  const port = Number(process.env.BFF_PORT ?? process.env.PORT ?? DEFAULT_PORT);
  await app.listen(port);

  Logger.log(
    `BFF слушает http://localhost:${port}/api (проба: /api/health)`,
    'Bootstrap'
  );
}

bootstrap();
