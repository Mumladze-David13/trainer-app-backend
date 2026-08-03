import { Test, TestingModule } from '@nestjs/testing';
import { PhotosService } from './photos.service';
import { PrismaService } from '../prisma/prisma.service';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { NotFoundException } from '@nestjs/common';

describe('PhotosService', () => {
  let service: PhotosService;

  const mockPrismaService = {
    progressPhoto: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
    trainerClient: {
      findFirst: jest.fn(),
    },
  };

  const mockCloudinaryService = {
    deleteAsset: jest.fn(),
  };

  const CLIENT_ID = 'client-123';
  const TRAINER_ID = 'trainer-456';
  const OTHER_CLIENT_ID = 'other-client-789';
  const PHOTO_ID = 'photo-abc';

  const makePhoto = (overrides = {}) => ({
    id: PHOTO_ID,
    clientId: CLIENT_ID,
    publicId: 'trainer-app/progress-photos/client-123/photo-abc',
    secureUrl: 'https://res.cloudinary.com/test/image/upload/photo-abc',
    category: 'progress-photos' as const,
    takenAt: new Date('2026-06-20T10:00:00Z'),
    ...overrides,
  });

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PhotosService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: CloudinaryService, useValue: mockCloudinaryService },
      ],
    }).compile();

    service = module.get<PhotosService>(PhotosService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createPhoto', () => {
    const dto = {
      publicId: 'trainer-app/progress-photos/client-123/photo-new',
      secureUrl: 'https://res.cloudinary.com/test/image/upload/photo-new',
      category: 'progress-photos' as const,
    };

    it('should create photo with correct data', async () => {
      const createdPhoto = makePhoto({ id: 'photo-new', ...dto });
      mockPrismaService.progressPhoto.create.mockResolvedValue(createdPhoto);

      const result = await service.createPhoto(CLIENT_ID, dto);

      expect(mockPrismaService.progressPhoto.create).toHaveBeenCalledWith({
        data: {
          clientId: CLIENT_ID,
          publicId: dto.publicId,
          secureUrl: dto.secureUrl,
          category: dto.category,
        },
      });
      expect(result).toEqual(createdPhoto);
    });

    it('should handle pose-analysis category', async () => {
      const poseDto = {
        publicId: 'trainer-app/pose-analysis/client-123/pose-xyz',
        secureUrl: 'https://res.cloudinary.com/test/image/upload/pose-xyz',
        category: 'pose-analysis' as const,
      };
      const createdPhoto = makePhoto({ ...poseDto, category: 'pose-analysis' });
      mockPrismaService.progressPhoto.create.mockResolvedValue(createdPhoto);

      const result = await service.createPhoto(CLIENT_ID, poseDto);

      expect(mockPrismaService.progressPhoto.create).toHaveBeenCalledWith({
        data: {
          clientId: CLIENT_ID,
          publicId: poseDto.publicId,
          secureUrl: poseDto.secureUrl,
          category: 'pose-analysis',
        },
      });
      expect(result.category).toBe('pose-analysis');
    });
  });

  describe('getPhotos', () => {
    it('should return all photos for client without category filter', async () => {
      const photos = [
        makePhoto({ id: 'photo-1', category: 'progress-photos' }),
        makePhoto({ id: 'photo-2', category: 'pose-analysis' }),
      ];
      mockPrismaService.progressPhoto.findMany.mockResolvedValue(photos);

      const result = await service.getPhotos(CLIENT_ID);

      expect(mockPrismaService.progressPhoto.findMany).toHaveBeenCalledWith({
        where: { clientId: CLIENT_ID },
        orderBy: { takenAt: 'desc' },
      });
      expect(result).toEqual(photos);
      expect(result.length).toBe(2);
    });

    it('should filter photos by category when provided', async () => {
      const photos = [makePhoto({ id: 'photo-1', category: 'progress-photos' })];
      mockPrismaService.progressPhoto.findMany.mockResolvedValue(photos);

      const result = await service.getPhotos(CLIENT_ID, 'progress-photos');

      expect(mockPrismaService.progressPhoto.findMany).toHaveBeenCalledWith({
        where: { clientId: CLIENT_ID, category: 'progress-photos' },
        orderBy: { takenAt: 'desc' },
      });
      expect(result).toEqual(photos);
      expect(result.every(p => p.category === 'progress-photos')).toBe(true);
    });

    it('should filter by pose-analysis category', async () => {
      const photos = [makePhoto({ id: 'photo-1', category: 'pose-analysis' })];
      mockPrismaService.progressPhoto.findMany.mockResolvedValue(photos);

      const result = await service.getPhotos(CLIENT_ID, 'pose-analysis');

      expect(mockPrismaService.progressPhoto.findMany).toHaveBeenCalledWith({
        where: { clientId: CLIENT_ID, category: 'pose-analysis' },
        orderBy: { takenAt: 'desc' },
      });
      expect(result.every(p => p.category === 'pose-analysis')).toBe(true);
    });

    it('should return empty array when no photos exist', async () => {
      mockPrismaService.progressPhoto.findMany.mockResolvedValue([]);

      const result = await service.getPhotos(CLIENT_ID);

      expect(result).toEqual([]);
    });

    it('should order photos by takenAt descending', async () => {
      await service.getPhotos(CLIENT_ID);

      const call = mockPrismaService.progressPhoto.findMany.mock.calls[0][0];
      expect(call.orderBy).toEqual({ takenAt: 'desc' });
    });
  });

  describe('deletePhoto', () => {
    it('should delete photo and cloudinary asset when photo exists and client owns it', async () => {
      const photo = makePhoto();
      mockPrismaService.progressPhoto.findUnique.mockResolvedValue(photo);
      mockPrismaService.progressPhoto.delete.mockResolvedValue(photo);
      mockCloudinaryService.deleteAsset.mockResolvedValue(undefined);

      const result = await service.deletePhoto(PHOTO_ID, CLIENT_ID);

      expect(mockPrismaService.progressPhoto.findUnique).toHaveBeenCalledWith({
        where: { id: PHOTO_ID },
      });
      expect(mockCloudinaryService.deleteAsset).toHaveBeenCalledWith(photo.publicId);
      expect(mockPrismaService.progressPhoto.delete).toHaveBeenCalledWith({
        where: { id: PHOTO_ID },
      });
      expect(result).toEqual({ message: 'Фото удалено' });
    });

    it('should delete cloudinary asset before deleting DB record', async () => {
      const photo = makePhoto();
      mockPrismaService.progressPhoto.findUnique.mockResolvedValue(photo);
      const callOrder: string[] = [];

      mockCloudinaryService.deleteAsset.mockImplementation(async () => {
        callOrder.push('cloudinary');
      });
      mockPrismaService.progressPhoto.delete.mockImplementation(async () => {
        callOrder.push('db');
        return photo;
      });

      await service.deletePhoto(PHOTO_ID, CLIENT_ID);

      expect(callOrder).toEqual(['cloudinary', 'db']);
    });

    it('should throw NotFoundException when photo does not exist', async () => {
      mockPrismaService.progressPhoto.findUnique.mockResolvedValue(null);

      await expect(service.deletePhoto(PHOTO_ID, CLIENT_ID)).rejects.toThrow(NotFoundException);
      await expect(service.deletePhoto(PHOTO_ID, CLIENT_ID)).rejects.toThrow('Фото не найдено');
      expect(mockCloudinaryService.deleteAsset).not.toHaveBeenCalled();
      expect(mockPrismaService.progressPhoto.delete).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when photo belongs to different client', async () => {
      const photo = makePhoto({ clientId: OTHER_CLIENT_ID });
      mockPrismaService.progressPhoto.findUnique.mockResolvedValue(photo);

      await expect(service.deletePhoto(PHOTO_ID, CLIENT_ID)).rejects.toThrow(NotFoundException);
      await expect(service.deletePhoto(PHOTO_ID, CLIENT_ID)).rejects.toThrow('Фото не найдено');
      expect(mockCloudinaryService.deleteAsset).not.toHaveBeenCalled();
      expect(mockPrismaService.progressPhoto.delete).not.toHaveBeenCalled();
    });

    it('should not call delete methods when ownership check fails', async () => {
      const photo = makePhoto({ clientId: 'wrong-client' });
      mockPrismaService.progressPhoto.findUnique.mockResolvedValue(photo);

      try {
        await service.deletePhoto(PHOTO_ID, CLIENT_ID);
      } catch (e) {
        // Expected
      }

      expect(mockCloudinaryService.deleteAsset).not.toHaveBeenCalled();
      expect(mockPrismaService.progressPhoto.delete).not.toHaveBeenCalled();
    });
  });

  describe('getClientPhotos', () => {
    it('should return photos when trainer-client relation exists', async () => {
      mockPrismaService.trainerClient.findFirst.mockResolvedValue({
        trainerId: TRAINER_ID,
        clientId: CLIENT_ID,
      });
      const photos = [makePhoto({ id: 'photo-1' }), makePhoto({ id: 'photo-2' })];
      mockPrismaService.progressPhoto.findMany.mockResolvedValue(photos);

      const result = await service.getClientPhotos(CLIENT_ID, TRAINER_ID);

      expect(mockPrismaService.trainerClient.findFirst).toHaveBeenCalledWith({
        where: { trainerId: TRAINER_ID, clientId: CLIENT_ID },
      });
      expect(mockPrismaService.progressPhoto.findMany).toHaveBeenCalledWith({
        where: { clientId: CLIENT_ID },
        orderBy: { takenAt: 'desc' },
      });
      expect(result).toEqual(photos);
    });

    it('should pass category filter to getPhotos when provided', async () => {
      mockPrismaService.trainerClient.findFirst.mockResolvedValue({
        trainerId: TRAINER_ID,
        clientId: CLIENT_ID,
      });
      const photos = [makePhoto({ category: 'pose-analysis' })];
      mockPrismaService.progressPhoto.findMany.mockResolvedValue(photos);

      const result = await service.getClientPhotos(CLIENT_ID, TRAINER_ID, 'pose-analysis');

      expect(mockPrismaService.progressPhoto.findMany).toHaveBeenCalledWith({
        where: { clientId: CLIENT_ID, category: 'pose-analysis' },
        orderBy: { takenAt: 'desc' },
      });
      expect(result).toEqual(photos);
    });

    it('should throw NotFoundException when trainer-client relation does not exist', async () => {
      mockPrismaService.trainerClient.findFirst.mockResolvedValue(null);

      await expect(service.getClientPhotos(CLIENT_ID, TRAINER_ID)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.getClientPhotos(CLIENT_ID, TRAINER_ID)).rejects.toThrow(
        'Клиент не найден',
      );
      expect(mockPrismaService.progressPhoto.findMany).not.toHaveBeenCalled();
    });

    it('should not query photos when relation check fails', async () => {
      mockPrismaService.trainerClient.findFirst.mockResolvedValue(null);

      try {
        await service.getClientPhotos(CLIENT_ID, 'wrong-trainer-id');
      } catch (e) {
        // Expected
      }

      expect(mockPrismaService.progressPhoto.findMany).not.toHaveBeenCalled();
    });

    it('should verify relation before retrieving photos', async () => {
      mockPrismaService.trainerClient.findFirst.mockResolvedValue({
        trainerId: TRAINER_ID,
        clientId: CLIENT_ID,
      });
      mockPrismaService.progressPhoto.findMany.mockResolvedValue([]);

      await service.getClientPhotos(CLIENT_ID, TRAINER_ID);

      const trainerClientCall = mockPrismaService.trainerClient.findFirst.mock.invocationCallOrder[0];
      const findManyCall = mockPrismaService.progressPhoto.findMany.mock.invocationCallOrder[0];

      expect(trainerClientCall).toBeLessThan(findManyCall);
    });
  });
});
