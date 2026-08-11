import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateExercisePhotoDto {
  @ApiProperty({ description: 'Cloudinary public_id загруженного фото' })
  @IsString()
  @MinLength(1)
  publicId: string;

  @ApiProperty({ description: 'Secure URL загруженного фото' })
  @IsString()
  @MinLength(1)
  secureUrl: string;
}
