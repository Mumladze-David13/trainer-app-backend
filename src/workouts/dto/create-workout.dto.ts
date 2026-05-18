// src/workouts/dto/create-workout.dto.ts
import { IsString, IsOptional, IsArray, ValidateNested, IsNumber, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';

export class WorkoutExerciseDto {
  @IsUUID()
  exerciseId: string;

  @IsNumber()
  sets: number;

  @IsNumber()
  reps: number;

  @IsOptional()
  @IsNumber()
  weight?: number;

  @IsNumber()
  order: number;
}

export class CreateWorkoutDto {
  @IsString()
  seasonId: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkoutExerciseDto)
  exercises: WorkoutExerciseDto[];
}

export class UpdateWorkoutDto {
  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkoutExerciseDto)
  exercises?: WorkoutExerciseDto[];
}

export class CompleteWorkoutDto {
  @IsArray()
  doneExerciseIds: string[];
}
