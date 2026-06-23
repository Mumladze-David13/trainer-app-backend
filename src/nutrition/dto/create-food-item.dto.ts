import { IsString, IsNotEmpty, IsNumber, Min, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateFoodItemDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  caloriesPer100g: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  proteinPer100g: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  carbsPer100g: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  fatPer100g: number;

  @ApiPropertyOptional({ enum: ['meat', 'dairy', 'grains', 'vegetables', 'fruits', 'nuts', 'other'] })
  @IsOptional()
  @IsString()
  category?: string;
}
