import { Controller, Get } from '@nestjs/common';
import type { PortfolioSummaryDto } from '@credithub/shared-types';
import { CreditsService } from '../credits/credits.service';

/**
 * Сводка для экрана «Обзор».
 *
 * Отдельный контроллер, но сервис берётся из `CreditsModule`: сводка - это
 * агрегат по тем же кредитам, и считать её вторым независимым запросом значит
 * допустить расхождение с экраном кредитов.
 */
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly credits: CreditsService) {}

  @Get()
  summary(): Promise<PortfolioSummaryDto> {
    return this.credits.portfolioSummary();
  }
}
