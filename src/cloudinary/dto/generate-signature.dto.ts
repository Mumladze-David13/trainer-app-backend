import { IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class GenerateSignatureDto {
  @ApiProperty({
    example: 'progress-photos',
    description: 'Категория фото',
    enum: ['progress-photos', 'pose-analysis'],
  })
  @IsIn(['progress-photos', 'pose-analysis'])
  category: 'progress-photos' | 'pose-analysis';
}
