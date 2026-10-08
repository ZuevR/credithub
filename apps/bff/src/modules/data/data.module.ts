import { Module } from '@nestjs/common';
import { CoreApiModule } from '../../core-api/core-api.module';
import { DataController } from './data.controller';

@Module({
  imports: [CoreApiModule],
  controllers: [DataController],
})
export class DataModule {}
