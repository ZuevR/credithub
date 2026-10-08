import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Program } from '../../db/entities/program';
import { ProgramsController } from './programs.controller';
import { ProgramsService } from './programs.service';

@Module({
  imports: [TypeOrmModule.forFeature([Program])],
  controllers: [ProgramsController],
  providers: [ProgramsService],
})
export class ProgramsModule {}
