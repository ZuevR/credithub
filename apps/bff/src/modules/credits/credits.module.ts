import { Module } from '@nestjs/common';
import { CoreApiModule } from '../../core-api/core-api.module';
import { CreditsController } from './credits.controller';

@Module({
  // Импорт явный: полагаться на `@Global` в CoreApiModule оказалось
  // недостаточно - контроллер с внедрённым клиентом не монтировался вовсе
  // (маршрут значился в логе, но отвечал 404, без ошибки DI).
  imports: [CoreApiModule],
  controllers: [CreditsController],
})
export class CreditsModule {}
