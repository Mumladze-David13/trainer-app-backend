import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsArray,
  Min,
  Max,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class GenerateProgramDto {
  @IsString()
  @IsNotEmpty()
  clientId: string;

  @IsString()
  @IsNotEmpty()
  goal: string;

  @IsString()
  @IsNotEmpty()
  level: string;

  @IsNumber()
  @Min(1)
  @Max(7)
  daysPerWeek: number;

  @IsString()
  @IsNotEmpty()
  equipment: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

class SaveWorkoutExerciseDto {
  @IsString()
  @IsNotEmpty()
  exerciseId: string;

  @IsNumber()
  sets: number;

  @IsNumber()
  reps: number;

  @IsOptional()
  @IsNumber()
  weight?: number;

  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  setWeights?: number[];

  @IsOptional()
  @IsNumber()
  supersetGroup?: number;

  @IsOptional()
  @IsNumber()
  supersetOrder?: number;

  @IsNumber()
  order: number;
}

class SaveWorkoutDto {
  @IsString()
  @IsNotEmpty()
  date: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SaveWorkoutExerciseDto)
  exercises: SaveWorkoutExerciseDto[];
}

export class SaveGeneratedProgramDto {
  @IsString()
  @IsNotEmpty()
  seasonId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SaveWorkoutDto)
  workouts: SaveWorkoutDto[];
}
