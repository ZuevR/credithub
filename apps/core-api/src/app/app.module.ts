import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { createDataSourceOptions } from '../db/data-source-options';
import { SeedModule } from '../db/seed.module';
import { findEnvFile } from '../config/find-env-file';
import { CreditsModule } from '../modules/credits/credits.module';
import { DashboardModule } from '../modules/dashboard/dashboard.module';
import { ProgramsModule } from '../modules/programs/programs.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: findEnvFile(),
    }),
    TypeOrmModule.forRoot(createDataSourceOptions()),
    SeedModule,
    CreditsModule,
    ProgramsModule,
    DashboardModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
