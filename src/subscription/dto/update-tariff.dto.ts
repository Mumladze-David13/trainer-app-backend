import { IsInt, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateTariffDto {
  @ApiProperty({ example: 300, minimum: 1 })
  @IsInt()
  @Min(1)
  priceRub: number;
}
