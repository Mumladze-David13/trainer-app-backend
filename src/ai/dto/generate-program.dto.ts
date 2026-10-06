import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsInt,
  IsOptional,
  ValidateIf,
  IsArray,
  Min,
  Max,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class GenerateProgramDto {
  @ApiProperty({ example: 'uuid-клиента' })
  @IsString()
  @IsNotEmpty()
  clientId: string;

  @ApiProperty({
    example: 'gain_muscle',
    description: 'lose_fat | gain_muscle | maintain | strength | endurance',
  })
  @IsString()
  @IsNotEmpty()
  goal: string;

  @ApiProperty({
    example: 'intermediate',
    description: 'beginner | intermediate | advanced',
  })
  @IsString()
  @IsNotEmpty()
  level: string;

  @ApiProperty({ example: 3, minimum: 1, maximum: 7 })
  @IsNumber()
  @Min(1)
  @Max(7)
  daysPerWeek: number;

  @ApiPropertyOptional({
    example: 1,
    minimum: 1,
    maximum: 7,
    description: 'Сколько тренировок сгенерировать (по умолчанию = daysPerWeek)',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(7)
  workoutsCount?: number;

  @ApiProperty({
    example: 'тренажёрный зал',
    description: 'штанга и гантели | тренажёрный зал | только собственный вес | дома с гантелями',
  })
  @IsString()
  @IsNotEmpty()
  equipment: string;

  @ApiPropertyOptional({ example: 'болит левое плечо, избегать жимов' })
  @IsOptional()
  @IsString()
  notes?: string;
}

class SaveWorkoutExerciseDto {
  @ApiProperty({ example: 'uuid-упражнения' })
  @IsString()
  @IsNotEmpty()
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

  @ApiPropertyOptional({ example: [70, 80, 80] })
  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  setWeights?: number[];

  @ApiPropertyOptional({ example: [12, 10, 8] })
  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  setReps?: number[];

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsNumber()
  supersetGroup?: number;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsNumber()
  supersetOrder?: number;

  @ApiProperty({ example: 0 })
  @IsNumber()
  order: number;
}

class SaveWorkoutDto {
  @ApiProperty({ example: '2026-07-01' })
  @IsString()
  @IsNotEmpty()
  date: string;

  @ApiPropertyOptional({ example: 'День 1 — ноги' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ type: [SaveWorkoutExerciseDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SaveWorkoutExerciseDto)
  exercises: SaveWorkoutExerciseDto[];
}

export class SaveGeneratedProgramDto {
  @ApiPropertyOptional({
    example: 'uuid-клиента',
    description: 'Клиент; сезон подбирается автоматически (текущий активный или новый)',
  })
  @ValidateIf((o) => !o.seasonId)
  @IsString()
  @IsNotEmpty()
  clientId?: string;

  @ApiPropertyOptional({
    example: 'uuid-сезона',
    description: 'Явный сезон; если в нём не хватает места — остаток уходит в новый сезон',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  seasonId?: string;

  @ApiProperty({ type: [SaveWorkoutDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SaveWorkoutDto)
  workouts: SaveWorkoutDto[];
}
