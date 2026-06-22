import { IsOptional, IsDateString, IsInt, Min, Max } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class GetMessagesDto {
  @ApiPropertyOptional({ example: '2026-06-22T10:00:00.000Z', description: 'Загрузить сообщения старше этой даты (пагинация)' })
  @IsOptional()
  @IsDateString()
  before?: string;

  @ApiPropertyOptional({ example: 20, minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
