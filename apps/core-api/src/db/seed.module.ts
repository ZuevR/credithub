import { Module } from '@nestjs/common';
import { SeedService } from './seed.service';

/**
 * Модуль демо-данных.
 *
 * Отдельный модуль, а не провайдер в `AppModule`: seed нужен только для
 * локальной разработки, и держать его явной границей честнее, чем подмешивать
 * в основной состав приложения. `TypeOrmModule` уже глобальный (подключён в
 * `AppModule`), поэтому `DataSource` доступен тут без дополнительных импортов.
 */
@Module({
  providers: [SeedService],
  exports: [SeedService],
})
export class SeedModule {}
