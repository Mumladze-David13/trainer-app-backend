import { IsString, IsOptional, IsNumber, Min, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

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
}
