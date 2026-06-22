import { IsString, IsOptional, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateExerciseDto {
  @ApiProperty({ example: 'Приседания со штангой', minLength: 2 })
  @IsString()
  @MinLength(2)
  name: string;

  @ApiPropertyOptional({ example: 'Базовое упражнение на квадрицепсы' })
  @IsOptional()
  @IsString()
  description?: string;
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
}
