import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  /**
   * Проба живости для ingress.
   *
   * Проверяет только сам процесс: если сюда добавить поход в core-api, то
   * недоступность доменного сервиса начнёт «ронять» BFF в глазах ingress'а, и
   * он перестанет слать трафик туда, где он на самом деле работает.
   */
  @Get()
  check(): { status: 'ok' } {
    return { status: 'ok' };
  }
}
