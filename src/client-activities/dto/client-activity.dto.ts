import { IsString, IsOptional, IsNumber, IsEnum, IsDateString, Min, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ActivityUnit } from '@prisma/client';

export class CreateClientActivityDto {
  @ApiProperty({ example: 'Бег', description: 'Название активности' })
  @IsString()
  @MinLength(1)
  name: string;

  @ApiPropertyOptional({ example: 8.0, description: 'MET-коэффициент для расчёта калорий' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  metValue?: number;

  @ApiPropertyOptional({ example: 'Бег в умеренном темпе' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: ActivityUnit, example: 'KM', description: 'В чём считать выполнение: разы или километры' })
  @IsOptional()
  @IsEnum(ActivityUnit)
  unit?: ActivityUnit;
}

export class UpdateClientActivityDto {
  @ApiPropertyOptional({ example: 'Ходьба' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @ApiPropertyOptional({ example: 3.5 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  metValue?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: ActivityUnit, example: 'KM' })
  @IsOptional()
  @IsEnum(ActivityUnit)
  unit?: ActivityUnit;
}

export class CreateClientActivityLogDto {
  @ApiProperty({ example: 5, description: 'Значение в единицах активности (разы или км)' })
  @IsNumber()
  @Min(0)
  value: number;

  @ApiPropertyOptional({ example: '2026-09-16', description: 'Дата выполнения, по умолчанию — сейчас' })
  @IsOptional()
  @IsDateString()
  date?: string;
}
