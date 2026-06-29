import {
  IsString, IsOptional, IsArray, ValidateNested, IsNumber, IsUUID, IsInt, Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class ClientSessionExerciseDto {
  @ApiPropertyOptional({ example: 'uuid-упражнения', description: 'ID упражнения из библиотеки тренера (если есть)' })
  @IsOptional()
  @IsUUID()
  exerciseId?: string;

  @ApiPropertyOptional({ example: 'Бег', description: 'Название активности (если нет в библиотеке)' })
  @IsOptional()
  @IsString()
  activityName?: string;

  @ApiPropertyOptional({ example: 3 })
  @IsOptional()
  @IsInt()
  sets?: number;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @IsInt()
  reps?: number;

  @ApiPropertyOptional({ example: 80 })
  @IsOptional()
  @IsNumber()
  weight?: number;

  @ApiPropertyOptional({ example: 30, description: 'Длительность в минутах' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  durationMinutes?: number;

  @ApiProperty({ example: 0 })
  @IsInt()
  order: number;
}

export class CreateClientSessionDto {
  @ApiPropertyOptional({ example: 'Самостоятельная тренировка' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ type: [ClientSessionExerciseDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ClientSessionExerciseDto)
  exercises: ClientSessionExerciseDto[];
}

export class UpdateClientSessionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ type: [ClientSessionExerciseDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ClientSessionExerciseDto)
  exercises?: ClientSessionExerciseDto[];
}
