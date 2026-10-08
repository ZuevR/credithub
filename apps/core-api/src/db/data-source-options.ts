import { join } from 'node:path';
import type { DataSourceOptions } from 'typeorm';
import { Client, Credit, Installment, Payment, Program } from './entities';

/** Значение по умолчанию совпадает с docker-compose.yml (порт 5433). */
const DEFAULT_DATABASE_URL =
  'postgres://credithub:credithub@localhost:5433/credithub';

/**
 * Куда смотреть файлы миграций.
 *
 * Запуск бывает двух видов, и расширение файлов в них разное:
 * - приложение из собранного `dist` - это `.js` (`nx serve core-api`);
 * - CLI TypeORM из исходников через ts-node - это `.ts`.
 * Определяем по расширению файла модуля: `__filename` оканчивается на `.ts`
 * ровно тогда, когда код выполняется без компиляции.
 */
const isTypeScript = __filename.endsWith('.ts');

/**
 * Настройки подключения к PostgreSQL.
 *
 * Вынесены отдельно от Nest-модуля, потому что тот же объект нужен CLI
 * TypeORM (`nx run core-api:migration:generate` и т.п.), который работает без
 * запуска приложения.
 */
export function createDataSourceOptions(): DataSourceOptions {
  return {
    type: 'postgres',
    url: process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL,
    entities: [Client, Credit, Installment, Payment, Program],
    migrations: [join(__dirname, 'migrations', isTypeScript ? '*.ts' : '*.js')],
    // Никогда не `synchronize`: схема меняется только миграциями, иначе
    // TypeORM может молча переписать таблицы.
    synchronize: false,
    logging: process.env.TYPEORM_LOGGING === 'true',
  };
}
