import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { CreatePhotoDto } from './dto/create-photo.dto';

@Injectable()
export class PhotosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  async createPhoto(clientId: string, dto: CreatePhotoDto) {
    return this.prisma.progressPhoto.create({
      data: {
        clientId,
        publicId: dto.publicId,
        secureUrl: dto.secureUrl,
        category: dto.category,
      },
    });
  }

  async getPhotos(clientId: string, category?: string) {
    return this.prisma.progressPhoto.findMany({
      where: {
        clientId,
        ...(category && { category }),
      },
      orderBy: { takenAt: 'desc' },
    });
  }

  async deletePhoto(id: string, clientId: string) {
    const photo = await this.prisma.progressPhoto.findUnique({ where: { id } });
    if (!photo) throw new NotFoundException('Фото не найдено');
    if (photo.clientId !== clientId) throw new NotFoundException('Фото не найдено');

    await this.cloudinaryService.deleteAsset(photo.publicId);
    await this.prisma.progressPhoto.delete({ where: { id } });
    return { message: 'Фото удалено' };
  }

  async getClientPhotos(clientId: string, trainerId: string, category?: string) {
    const relation = await this.prisma.trainerClient.findFirst({
      where: { trainerId, clientId },
    });
    if (!relation) throw new NotFoundException('Клиент не найден');
    return this.getPhotos(clientId, category);
  }
}
