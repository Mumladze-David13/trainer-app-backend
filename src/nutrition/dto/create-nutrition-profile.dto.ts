import { IsString, IsNotEmpty, IsIn, IsNumber, Min, Max, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateNutritionProfileDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  clientId: string;

  @ApiProperty({ enum: ['male', 'female'] })
  @IsString()
  @IsIn(['male', 'female'])
  gender: string;

  @ApiProperty()
  @IsNumber()
  @Min(10)
  @Max(120)
  age: number;

  @ApiProperty()
  @IsNumber()
  @Min(20)
  @Max(300)
  weightKg: number;

  @ApiProperty()
  @IsNumber()
  @Min(50)
  @Max(250)
  heightCm: number;

  @ApiProperty({ enum: ['sedentary', 'light', 'moderate', 'active', 'very_active'] })
  @IsString()
  @IsIn(['sedentary', 'light', 'moderate', 'active', 'very_active'])
  activityLevel: string;

  @ApiProperty({ enum: ['lose_fat', 'maintain', 'gain_muscle'] })
  @IsString()
  @IsIn(['lose_fat', 'maintain', 'gain_muscle'])
  goal: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  targetWeeklyChange?: number;
}
