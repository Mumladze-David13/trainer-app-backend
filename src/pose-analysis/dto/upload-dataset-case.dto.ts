import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  ArrayMinSize,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum PoseDatasetCaseLabel {
  correct = 'correct',
  incorrect = 'incorrect',
}

export class DatasetCaseFrameDto {
  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsInt()
  frameIndex?: number;

  @ApiPropertyOptional({ example: '2026-07-24T10:15:32.123Z' })
  @IsOptional()
  @IsDateString()
  ts?: string;

  @ApiPropertyOptional({ example: 1280 })
  @IsOptional()
  @IsInt()
  imageWidth?: number;

  @ApiPropertyOptional({ example: 720 })
  @IsOptional()
  @IsInt()
  imageHeight?: number;

  @ApiProperty({
    description: 'Точки скелета BlazePose (33 точки), набор ключей может отличаться от кадра к кадру',
    example: { leftShoulder: { x: 412.5, y: 210.3, z: -30.1, likelihood: 0.98 } },
  })
  @IsObject()
  landmarks: Record<string, { x: number; y: number; z: number; likelihood: number }>;
}

export class UploadDatasetCaseDto {
  @ApiProperty({ example: 'squat_correct_1721816132123' })
  @IsString()
  caseId: string;

  @ApiProperty({ example: 'Приседания со штангой' })
  @IsString()
  exercise: string;

  @ApiProperty({ example: 'side' })
  @IsString()
  viewMode: string;

  @ApiProperty({ enum: PoseDatasetCaseLabel })
  @IsEnum(PoseDatasetCaseLabel)
  label: PoseDatasetCaseLabel;

  @ApiPropertyOptional({ example: 'колени уходят внутрь на подъёме' })
  @IsOptional()
  @IsString()
  comment?: string;

  @ApiProperty({ type: [DatasetCaseFrameDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => DatasetCaseFrameDto)
  frames: DatasetCaseFrameDto[];
}
