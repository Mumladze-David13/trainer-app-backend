import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsArray,
  Min,
  ValidateNested,
  IsIn,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class ParseMealDto {
  @ApiProperty({ example: 'гречка с курицей 250г и чай с сахаром' })
  @IsString()
  @IsNotEmpty()
  text: string;

  @ApiPropertyOptional({ enum: ['breakfast', 'lunch', 'dinner', 'snack'] })
  @IsOptional()
  @IsString()
  @IsIn(['breakfast', 'lunch', 'dinner', 'snack'])
  mealType?: string;
}

export class FoodItemAiDto {
  @ApiProperty({ example: 'Гречка отварная' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 150 })
  @IsNumber()
  @Min(0)
  amountGrams: number;

  @ApiProperty({ example: 110 })
  @IsNumber()
  @Min(0)
  caloriesPer100g: number;

  @ApiProperty({ example: 4.2 })
  @IsNumber()
  @Min(0)
  proteinPer100g: number;

  @ApiProperty({ example: 21.3 })
  @IsNumber()
  @Min(0)
  carbsPer100g: number;

  @ApiProperty({ example: 1.1 })
  @IsNumber()
  @Min(0)
  fatPer100g: number;
}

export class LogMealDto {
  @ApiProperty({ example: 'uuid-клиента' })
  @IsString()
  @IsNotEmpty()
  clientId: string;

  @ApiProperty({ example: '2026-08-04' })
  @IsString()
  @IsNotEmpty()
  date: string;

  @ApiProperty({ enum: ['breakfast', 'lunch', 'dinner', 'snack'] })
  @IsString()
  @IsIn(['breakfast', 'lunch', 'dinner', 'snack'])
  mealType: string;

  @ApiPropertyOptional({ example: '13:30' })
  @IsOptional()
  @IsString()
  time?: string;

  @ApiProperty({ type: [FoodItemAiDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FoodItemAiDto)
  items: FoodItemAiDto[];
}

export class GenerateMealPlanDto {
  @ApiProperty({ example: 'uuid-клиента' })
  @IsString()
  @IsNotEmpty()
  clientId: string;

  @ApiPropertyOptional({ example: 'не ем рыбу, люблю острое' })
  @IsOptional()
  @IsString()
  preferences?: string;
}

class MealAiDto {
  @ApiProperty({ enum: ['breakfast', 'lunch', 'dinner', 'snack'] })
  @IsString()
  @IsIn(['breakfast', 'lunch', 'dinner', 'snack'])
  type: string;

  @ApiPropertyOptional({ example: '08:00' })
  @IsOptional()
  @IsString()
  time?: string;

  @ApiProperty({ type: [FoodItemAiDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FoodItemAiDto)
  items: FoodItemAiDto[];
}

export class SaveMealPlanDto {
  @ApiProperty({ example: 'uuid-клиента' })
  @IsString()
  @IsNotEmpty()
  clientId: string;

  @ApiProperty({ example: '2026-08-04' })
  @IsString()
  @IsNotEmpty()
  date: string;

  @ApiProperty({ type: [MealAiDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MealAiDto)
  meals: MealAiDto[];
}
