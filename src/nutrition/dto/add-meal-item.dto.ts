import { IsString, IsNotEmpty, IsNumber, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AddMealItemDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  foodItemId: string;

  @ApiProperty()
  @IsNumber()
  @Min(1)
  amountGrams: number;
}
