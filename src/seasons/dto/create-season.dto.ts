// src/seasons/dto/create-season.dto.ts
import { IsDateString, IsOptional, IsString } from 'class-validator';

export class CreateSeasonDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsDateString()
  startDate: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}
