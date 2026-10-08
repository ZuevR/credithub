import { BadRequestException, Controller, Get, Param } from '@nestjs/common';
import type { CreditDto } from '@credithub/shared-types';
import { CoreApiClient } from '../../core-api/core-api.client';

/** UUID: проверяем до похода в core-api, чтобы не гонять заведомо плохой id. */
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Controller('credits')
export class CreditsController {
  constructor(private readonly coreApi: CoreApiClient) {}

  @Get()
  findAll(): Promise<CreditDto[]> {
    return this.coreApi.get<CreditDto[]>('/credits');
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<CreditDto> {
    if (!UUID_PATTERN.test(id)) {
      throw new BadRequestException('Идентификатор кредита должен быть UUID');
    }
    return this.coreApi.get<CreditDto>(`/credits/${id}`);
  }
}
