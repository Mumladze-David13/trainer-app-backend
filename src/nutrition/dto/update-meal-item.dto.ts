import { IsNumber, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateMealItemDto {
  @ApiProperty()
  @IsNumber()
  @Min(1)
  amountGrams: number;
}
