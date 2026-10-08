import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { ProgramDto } from '@credithub/shared-types';
import { Program } from '../../db/entities/program';
import { toProgramDto } from '../../db/mappers';

@Injectable()
export class ProgramsService {
  constructor(
    @InjectRepository(Program)
    private readonly programs: Repository<Program>
  ) {}

  /**
   * Публичный каталог программ.
   *
   * Отдаём только `published`: черновики не должны попадать в публичный
   * SSR-раздел, и фильтр стоит на источнике данных, а не на клиенте.
   */
  async findAll(): Promise<ProgramDto[]> {
    const programs = await this.programs.find({
      where: { published: true },
      order: { ratePercent: 'ASC' },
    });
    return programs.map(toProgramDto);
  }
}
