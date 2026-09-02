import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ParseWorkoutDto {
  @ApiProperty({ example: 'жим лёжа три подхода по десять на восьмидесяти' })
  @IsString()
  @IsNotEmpty()
  text: string;
}
