import { IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateWeightLogDto {
  @ApiProperty({ example: 82.5, description: 'Вес в кг' })
  @IsNumber()
  @Min(1)
  weightKg: number;

  @ApiPropertyOptional({ example: 'После тренировки' })
  @IsOptional()
  @IsString()
  notes?: string;
}
