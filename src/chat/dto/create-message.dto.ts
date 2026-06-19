import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class CreateMessageDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  text: string;
}
