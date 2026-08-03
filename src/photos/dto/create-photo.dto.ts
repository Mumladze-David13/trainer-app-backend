import { IsString, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreatePhotoDto {
  @ApiProperty({ example: 'trainer-app/progress-photos/user-id/photo123' })
  @IsString()
  publicId: string;

  @ApiProperty({ example: 'https://res.cloudinary.com/...' })
  @IsString()
  secureUrl: string;

  @ApiProperty({
    example: 'progress-photos',
    enum: ['progress-photos', 'pose-analysis'],
  })
  @IsIn(['progress-photos', 'pose-analysis'])
  category: 'progress-photos' | 'pose-analysis';
}
