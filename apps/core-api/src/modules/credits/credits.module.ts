import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Credit } from '../../db/entities/credit';
import { Installment } from '../../db/entities/installment';
import { Payment } from '../../db/entities/payment';
import { CreditsController } from './credits.controller';
import { CreditsService } from './credits.service';

@Module({
  imports: [TypeOrmModule.forFeature([Credit, Installment, Payment])],
  controllers: [CreditsController],
  providers: [CreditsService],
  // Сервис нужен модулю обзора: сводка считается из тех же кредитов, чтобы
  // значения на двух экранах не могли разойтись.
  exports: [CreditsService],
})
export class CreditsModule {}
