import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from '../app/app.module';
import { SeedService } from './seed.service';

/**
 * Точка входа seed-скрипта: `nx run core-api:seed`.
 *
 * Через полноценный Nest-контекст, а не отдельный `DataSource`:
 * - пути `@credithub/*` из `tsconfig.base.json` разрешает `ts-loader`/webpack
 *   при сборке - при отдельном запуске ts-node их пришлось бы настраивать
 *   вручную (через устаревший `baseUrl` в tsconfig-paths);
 * - конфигурация подключения и `.env` читаются ровно так же, как в работающем
 *   приложении, а не «вторым способом», который может разойтись.
 */
async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const seeded = await app.get(SeedService).run();
    Logger.log(
      seeded ? 'Демо-данные загружены' : 'Демо-данные уже есть — пропущено',
      'Seed'
    );
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  Logger.error(error, undefined, 'Seed');
  process.exit(1);
});
