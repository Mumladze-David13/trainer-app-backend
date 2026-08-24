// src/solo/solo.module.ts
import { Module } from '@nestjs/common';
import { SoloController } from './solo.controller';
import { SoloService } from './solo.service';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [AiModule],
  controllers: [SoloController],
  providers: [SoloService],
})
export class SoloModule {}
