import { Controller, Get } from '@nestjs/common';
import type { PortfolioSummaryDto, ProgramDto } from '@credithub/shared-types';
import { CoreApiClient } from '../../core-api/core-api.client';

/**
 * Обзор и каталог программ.
 *
 * Контроллер без сервиса намеренно: BFF здесь ничего не считает, а только
 * проксирует доменные данные. Логика появится, когда понадобится собрать ответ
 * из нескольких источников (например, портфель + профиль клиента).
 */
@Controller()
export class DataController {
  constructor(private readonly coreApi: CoreApiClient) {}

  @Get('dashboard')
  summary(): Promise<PortfolioSummaryDto> {
    return this.coreApi.get<PortfolioSummaryDto>('/dashboard');
  }

  @Get('programs')
  programs(): Promise<ProgramDto[]> {
    return this.coreApi.get<ProgramDto[]>('/programs');
  }
}
