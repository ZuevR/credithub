import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import type { CreditDto } from '@credithub/shared-types';
import { CreditsService } from './credits.service';

/** Внутренний API core-api. Наружу его отдаёт BFF, а не этот контроллер. */
@Controller('credits')
export class CreditsController {
  constructor(private readonly credits: CreditsService) {}

  @Get()
  findAll(): Promise<CreditDto[]> {
    return this.credits.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<CreditDto> {
    const credit = await this.credits.findOne(id);
    // 404, а не пустой объект: клиенту важно отличать «нет такого кредита» от
    // «кредит есть, но без данных».
    if (!credit) throw new NotFoundException(`Кредит ${id} не найден`);
    return credit;
  }
}
