import { IsString, IsOptional, MinLength, IsEnum, IsNumber, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { WeightType } from '@prisma/client';

export class CreateExerciseDto {
  @ApiProperty({ example: 'Приседания со штангой', minLength: 2 })
  @IsString()
  @MinLength(2)
  name: string;

  @ApiPropertyOptional({ example: 'Базовое упражнение на квадрицепсы' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: WeightType, default: WeightType.WEIGHT_KG, description: 'Тип веса: с весом (кг) или без веса (плитки/собственный вес)' })
  @IsOptional()
  @IsEnum(WeightType)
  weightType?: WeightType;

  @ApiPropertyOptional({ example: 3.5, description: 'MET-коэффициент для расчёта калорий (для кардио-упражнений)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  metValue?: number;

  @ApiPropertyOptional({ example: 'штанга', description: 'Оборудование, необходимое для упражнения' })
  @IsOptional()
  @IsString()
  equipment?: string;
}

export class UpdateExerciseDto {
  @ApiPropertyOptional({ example: 'Жим лёжа', minLength: 2 })
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @ApiPropertyOptional({ example: 'Грудные мышцы, трицепс' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: WeightType })
  @IsOptional()
  @IsEnum(WeightType)
  weightType?: WeightType;

  @ApiPropertyOptional({ example: 3.5 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  metValue?: number;

  @ApiPropertyOptional({ example: 'штанга', description: 'Оборудование, необходимое для упражнения' })
  @IsOptional()
  @IsString()
  equipment?: string;
}
