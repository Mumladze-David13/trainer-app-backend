import { Module } from '@nestjs/common';
import { PoseAnalysisController } from './pose-analysis.controller';
import { PoseAnalysisService } from './pose-analysis.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [PoseAnalysisController],
  providers: [PoseAnalysisService],
})
export class PoseAnalysisModule {}
