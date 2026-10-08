import { Module } from '@nestjs/common';
import { CreditsModule } from '../credits/credits.module';
import { DashboardController } from './dashboard.controller';

@Module({
  imports: [CreditsModule],
  controllers: [DashboardController],
})
export class DashboardModule {}
