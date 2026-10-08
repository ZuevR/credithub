import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';

/** Порт по умолчанию, если не задан ни одной переменной. */
const DEFAULT_PORT = 3000;

/**
 * Разбирает порт из окружения и падает с понятным сообщением, если значение
 * не число.
 *
 * Почему не просто `Number(...)`: Kubernetes сам создаёт переменные окружения
 * для сервисов namespace в стиле docker-links. Для сервиса с именем `bff`
 * появляется `BFF_PORT=tcp://10.43.x.x:3000`, и если приложение читает
 * переменную с таким именем, `Number('tcp://...')` даёт `NaN`. Дальше
 * `app.listen(NaN)` падает с `ERR_SOCKET_BAD_PORT`, из которого причина не
 * видна вовсе.
 *
 * Поэтому: (1) имя переменной выбираем так, чтобы оно не могло совпасть с
 * `<ИМЯ_СЕРВИСА>_PORT` - отсюда `BFF_HTTP_PORT`; (2) значение проверяем и
 * сообщаем, что именно пришло.
 */
function resolvePort(): number {
  const raw = process.env.BFF_HTTP_PORT ?? process.env.PORT;
  if (raw === undefined || raw === '') return DEFAULT_PORT;

  const port = Number(raw);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(
      `Некорректный порт BFF: BFF_HTTP_PORT/PORT = ${JSON.stringify(raw)}. ` +
        'Ожидается целое число от 1 до 65535.'
    );
  }
  return port;
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Без `exclude`: с ним (Nest 11 + Express 5) маршруты контроллеров перестают
  // получать префикс - `/api/credits` начинал отвечать 404, хотя в логе маршрут
  // значился как `/api/credits`. Проба живости поэтому живёт под тем же
  // префиксом: `/api/health`.
  app.setGlobalPrefix('api');

  const port = resolvePort();
  await app.listen(port);

  Logger.log(
    `BFF слушает http://localhost:${port}/api (проба: /api/health)`,
    'Bootstrap'
  );
}

bootstrap();
