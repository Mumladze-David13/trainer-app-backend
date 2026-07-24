import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  ArrayMinSize,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum PoseCalibrationExercise {
  squat = 'squat',
  pushUp = 'pushUp',
  deadlift = 'deadlift',
  bicepCurl = 'bicepCurl',
  shoulderPress = 'shoulderPress',
}

export enum PoseCalibrationView {
  side = 'side',
  front = 'front',
}

export class CalibrationFrameDto {
  @ApiPropertyOptional({ example: '2026-07-24T10:15:32.123Z' })
  @IsOptional()
  @IsDateString()
  ts?: string;

  @ApiProperty({ enum: PoseCalibrationExercise })
  @IsEnum(PoseCalibrationExercise)
  exercise: PoseCalibrationExercise;

  @ApiProperty({ enum: PoseCalibrationView })
  @IsEnum(PoseCalibrationView)
  view: PoseCalibrationView;

  @ApiPropertyOptional({ example: 'down' })
  @IsOptional()
  @IsString()
  phase?: string;

  @ApiPropertyOptional({ example: 82.5 })
  @IsOptional()
  @IsNumber()
  formScore?: number;

  @ApiPropertyOptional({ example: 1280 })
  @IsOptional()
  @IsInt()
  imageWidth?: number;

  @ApiPropertyOptional({ example: 720 })
  @IsOptional()
  @IsInt()
  imageHeight?: number;

  @ApiProperty({
    description: 'Углы суставов, набор ключей не фиксирован',
    example: { knee: 97.3, hip: 101.2 },
  })
  @IsObject()
  angles: Record<string, number>;

  @ApiProperty({
    description: 'Метрики калибровки, набор ключей не фиксирован',
    example: { kneeSpreadPx: 143.2, kneeAnkleRatio: 0.848 },
  })
  @IsObject()
  calibrationMetrics: Record<string, number>;
}

export class UploadCalibrationFramesDto {
  @ApiProperty({ type: [CalibrationFrameDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CalibrationFrameDto)
  frames: CalibrationFrameDto[];
}
