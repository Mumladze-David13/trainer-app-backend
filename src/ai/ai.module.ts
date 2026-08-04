import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { AiGateway } from './ai.gateway';
import { AnonymizerService } from './anonymizer.service';
import { NutritionModule } from '../nutrition/nutrition.module';

@Module({
  imports: [NutritionModule],
  controllers: [AiController],
  providers: [AiService, AiGateway, AnonymizerService],
  exports: [AiService, AiGateway],
})
export class AiModule {}
