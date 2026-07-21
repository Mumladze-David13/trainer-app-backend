import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class QueryGlobalExerciseDto {
  @ApiPropertyOptional({ example: 'силовые', description: 'Фильтр по категории' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ example: 'штанга', description: 'Фильтр по оборудованию' })
  @IsOptional()
  @IsString()
  equipment?: string;

  @ApiPropertyOptional({ example: 'beginner', description: 'Фильтр по уровню' })
  @IsOptional()
  @IsString()
  level?: string;

  @ApiPropertyOptional({ example: 'присед', description: 'Поиск по названию' })
  @IsOptional()
  @IsString()
  search?: string;
}
