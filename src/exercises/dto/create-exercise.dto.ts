// src/exercises/dto/create-exercise.dto.ts
import { IsString, IsOptional, MinLength } from 'class-validator';

export class CreateExerciseDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateExerciseDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;
}
