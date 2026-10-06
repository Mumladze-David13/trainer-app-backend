import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class GenerateSoloProgramDto {
  @ApiPropertyOptional({
    example: 1,
    minimum: 1,
    maximum: 7,
    description: 'Сколько тренировок сгенерировать (по умолчанию = daysPerWeek из профиля)',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(7)
  workoutsCount?: number;
}
