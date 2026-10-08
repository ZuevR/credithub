import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthController } from './health.controller';
import { CoreApiModule } from '../core-api/core-api.module';
import { CreditsModule } from '../modules/credits/credits.module';
import { DataModule } from '../modules/data/data.module';
import { findEnvFile } from '../config/find-env-file';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: findEnvFile(),
    }),
    // Клиент к core-api глобальный: его используют почти все маршруты.
    CoreApiModule,
    CreditsModule,
    DataModule,
  ],
  controllers: [AppController, HealthController],
  providers: [AppService],
})
export class AppModule {}
