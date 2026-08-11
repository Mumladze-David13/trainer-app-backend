import { IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class GenerateSignatureDto {
  @ApiProperty({
    example: 'progress-photos',
    description: 'Категория фото',
    enum: ['progress-photos', 'pose-analysis', 'exercise-photos'],
  })
  @IsIn(['progress-photos', 'pose-analysis', 'exercise-photos'])
  category: 'progress-photos' | 'pose-analysis' | 'exercise-photos';
}
