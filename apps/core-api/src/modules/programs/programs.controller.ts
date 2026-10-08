import { Controller, Get } from '@nestjs/common';
import type { ProgramDto } from '@credithub/shared-types';
import { ProgramsService } from './programs.service';

/** Внутренний API core-api; наружу программы отдаёт BFF и SSR-раздел. */
@Controller('programs')
export class ProgramsController {
  constructor(private readonly programs: ProgramsService) {}

  @Get()
  findAll(): Promise<ProgramDto[]> {
    return this.programs.findAll();
  }
}
