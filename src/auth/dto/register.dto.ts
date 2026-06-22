import { IsEmail, IsEnum, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Role } from '@prisma/client';

export class RegisterDto {
  @ApiProperty({ example: 'trainer@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'password123', minLength: 6 })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiProperty({ example: 'Иван' })
  @IsString()
  firstName: string;

  @ApiProperty({ example: 'Петров' })
  @IsString()
  lastName: string;

  @ApiProperty({ enum: Role, example: Role.TRAINER })
  @IsEnum(Role)
  role: Role;
}
