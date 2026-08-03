import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';

@Injectable()
export class CloudinaryService {
  constructor(private readonly configService: ConfigService) {
    cloudinary.config({
      cloud_name: this.configService.get<string>('CLOUDINARY_CLOUD_NAME'),
      api_key: this.configService.get<string>('CLOUDINARY_API_KEY'),
      api_secret: this.configService.get<string>('CLOUDINARY_API_SECRET'),
    });
  }

  generateUploadSignature(
    folder: string,
    publicId?: string,
  ): { timestamp: number; signature: string; apiKey: string; cloudName: string; folder: string } {
    const timestamp = Math.round(Date.now() / 1000);
    const paramsToSign: Record<string, string | number> = {
      timestamp,
      folder,
    };

    if (publicId) {
      paramsToSign.public_id = publicId;
    }

    const signature = cloudinary.utils.api_sign_request(
      paramsToSign,
      this.configService.get<string>('CLOUDINARY_API_SECRET'),
    );

    return {
      timestamp,
      signature,
      apiKey: this.configService.get<string>('CLOUDINARY_API_KEY'),
      cloudName: this.configService.get<string>('CLOUDINARY_CLOUD_NAME'),
      folder,
    };
  }

  buildDeliveryUrl(publicId: string, transformation?: string): string {
    return cloudinary.url(publicId, {
      secure: true,
      ...(transformation && { transformation }),
    });
  }

  async deleteAsset(publicId: string): Promise<void> {
    await cloudinary.uploader.destroy(publicId);
  }
}
