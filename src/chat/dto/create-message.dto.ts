import { IsString, IsNotEmpty, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateMessageDto {
  @ApiProperty({ example: 'Привет! Как прошла тренировка?', maxLength: 2000 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  text: string;
}
