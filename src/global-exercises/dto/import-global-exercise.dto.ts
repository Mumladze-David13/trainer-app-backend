import { IsOptional, IsArray, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ImportGlobalExerciseDto {
  @ApiPropertyOptional({
    type: [String],
    description: 'ID упражнений из справочника для импорта. Если не указано — импортируется весь справочник',
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  ids?: string[];
}
