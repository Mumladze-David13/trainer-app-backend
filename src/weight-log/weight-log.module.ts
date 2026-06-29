import { Module } from '@nestjs/common';
import { WeightLogController } from './weight-log.controller';
import { WeightLogService } from './weight-log.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [PrismaModule, AiModule],
  controllers: [WeightLogController],
  providers: [WeightLogService],
})
export class WeightLogModule {}
