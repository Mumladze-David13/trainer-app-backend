import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ExchangeOAuthDto {
  @ApiProperty({ example: 'a3f0b6f0-3f2e-4c9a-9c9e-6f2b0e9a1234' })
  @IsString()
  @IsNotEmpty()
  code: string;
}
