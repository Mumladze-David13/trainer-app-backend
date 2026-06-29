import { IsString, IsOptional, IsArray, ValidateNested, IsNumber, IsUUID, IsInt } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class WorkoutExerciseDto {
  @ApiProperty({ example: 'uuid-упражнения' })
  @IsUUID()
  exerciseId: string;

  @ApiProperty({ example: 3 })
  @IsNumber()
  sets: number;

  @ApiProperty({ example: 10 })
  @IsNumber()
  reps: number;

  @ApiPropertyOptional({ example: 80 })
  @IsOptional()
  @IsNumber()
  weight?: number;

  @ApiPropertyOptional({ example: [70, 80, 80], description: 'Вес по каждому подходу' })
  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  setWeights?: number[];

  @ApiPropertyOptional({ example: [12, 10, 8], description: 'Повторения по каждому подходу' })
  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  setReps?: number[];

  @ApiPropertyOptional({ example: 30, description: 'Длительность упражнения в минутах (для расчёта калорий)' })
  @IsOptional()
  @IsNumber()
  durationMinutes?: number;

  @ApiPropertyOptional({ example: 1, description: 'Номер суперсета' })
  @IsOptional()
  @IsInt()
  supersetGroup?: number;

  @ApiPropertyOptional({ example: 1, description: 'Порядок в суперсете' })
  @IsOptional()
  @IsInt()
  supersetOrder?: number;

  @ApiProperty({ example: 0, description: 'Порядок упражнения в тренировке' })
  @IsNumber()
  order: number;
}

export class CreateWorkoutDto {
  @ApiProperty({ example: 'uuid-сезона' })
  @IsString()
  seasonId: string;

  @ApiPropertyOptional({ example: 'Акцент на ноги' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ type: [WorkoutExerciseDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkoutExerciseDto)
  exercises: WorkoutExerciseDto[];
}

export class UpdateWorkoutDto {
  @ApiPropertyOptional({ example: 'Акцент на грудь' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ type: [WorkoutExerciseDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkoutExerciseDto)
  exercises?: WorkoutExerciseDto[];
}

export class CompleteWorkoutDto {
  @ApiProperty({ example: ['uuid-1', 'uuid-2'], description: 'ID выполненных упражнений' })
  @IsArray()
  doneExerciseIds: string[];
}
