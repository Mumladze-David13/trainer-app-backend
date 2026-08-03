import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/roles.decorator';
import { CloudinaryService } from './cloudinary.service';
import { GenerateSignatureDto } from './dto/generate-signature.dto';

@ApiTags('Cloudinary')
@ApiBearerAuth('JWT')
@Controller('cloudinary')
@UseGuards(JwtAuthGuard)
export class CloudinaryController {
  constructor(private readonly cloudinaryService: CloudinaryService) {}

  @Post('signature')
  @ApiOperation({ summary: 'Получить подпись для загрузки фото в Cloudinary' })
  @ApiResponse({ status: 200, description: 'Подпись сгенерирована' })
  generateSignature(@CurrentUser() user: any, @Body() dto: GenerateSignatureDto) {
    const folder = `trainer-app/${dto.category}/${user.id}`;
    return this.cloudinaryService.generateUploadSignature(folder);
  }
}
