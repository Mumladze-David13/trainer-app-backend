import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const SOLO_GOALS = ['lose_fat', 'gain_muscle', 'maintain', 'strength', 'endurance'] as const;
export const SOLO_LEVELS = ['beginner', 'intermediate', 'advanced'] as const;
export const SOLO_EQUIPMENT = ['gym', 'home_dumbbells', 'bodyweight'] as const;

export class CreateSoloProfileDto {
  @ApiProperty({ enum: SOLO_GOALS, example: 'gain_muscle' })
  @IsIn(SOLO_GOALS)
  goal: string;

  @ApiProperty({ enum: SOLO_LEVELS, example: 'beginner' })
  @IsIn(SOLO_LEVELS)
  level: string;

  @ApiProperty({ example: 3, minimum: 2, maximum: 6 })
  @IsInt()
  @Min(2)
  @Max(6)
  daysPerWeek: number;

  @ApiProperty({
    enum: SOLO_EQUIPMENT,
    example: 'home_dumbbells',
    description: 'gym — полный зал, home_dumbbells — гантели/эспандер дома, bodyweight — только свой вес',
  })
  @IsIn(SOLO_EQUIPMENT)
  equipment: string;

  @ApiPropertyOptional({ example: 'Болит правое колено, избегать глубоких приседаний' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  notes?: string;
}
