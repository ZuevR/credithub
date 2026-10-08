import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { createDataSourceOptions } from './data-source-options';

/**
 * DataSource для CLI TypeORM.
 *
 * Приложение подключается к базе через `TypeOrmModule.forRoot(...)` с теми же
 * опциями, а этот файл нужен утилите `typeorm` - она работает без NestJS и
 * иначе не знает, где искать сущности и миграции.
 *
 * Примеры:
 *   yarn nx run core-api:migration:generate --name=Init
 *   yarn nx run core-api:migration:run
 *   yarn nx run core-api:migration:revert
 */
export default new DataSource(createDataSourceOptions());
