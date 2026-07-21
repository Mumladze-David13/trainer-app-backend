import { Module } from '@nestjs/common';
import { GlobalExercisesController } from './global-exercises.controller';
import { GlobalExercisesService } from './global-exercises.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [GlobalExercisesController],
  providers: [GlobalExercisesService],
})
export class GlobalExercisesModule {}
