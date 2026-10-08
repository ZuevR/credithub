import { Global, Module } from '@nestjs/common';
import { CoreApiClient } from './core-api.client';

/**
 * Глобальный модуль: клиент к core-api нужен почти каждому маршруту BFF,
 * и импортировать его в каждый модуль было бы шумом без пользы.
 */
@Global()
@Module({
  providers: [CoreApiClient],
  exports: [CoreApiClient],
})
export class CoreApiModule {}
