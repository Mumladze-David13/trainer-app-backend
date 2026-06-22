import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { AiGateway } from './ai.gateway';
import { AnonymizerService } from './anonymizer.service';

@Module({
  controllers: [AiController],
  providers: [AiService, AiGateway, AnonymizerService],
  exports: [AiService],
})
export class AiModule {}
