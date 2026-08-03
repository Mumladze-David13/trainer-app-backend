import { IsOptional, IsIn } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class GetPhotosQueryDto {
  @ApiPropertyOptional({
    example: 'progress-photos',
    enum: ['progress-photos', 'pose-analysis'],
  })
  @IsOptional()
  @IsIn(['progress-photos', 'pose-analysis'])
  category?: 'progress-photos' | 'pose-analysis';
}
