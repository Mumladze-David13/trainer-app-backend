import { Test, TestingModule } from '@nestjs/testing';
import { PhotosController } from './photos.controller';
import { PhotosService } from './photos.service';

describe('PhotosController', () => {
  let controller: PhotosController;

  const mockPhotosService = {
    createPhoto: jest.fn(),
    getPhotos: jest.fn(),
    deletePhoto: jest.fn(),
    getClientPhotos: jest.fn(),
  };

  const CLIENT_ID = 'client-123';
  const TRAINER_ID = 'trainer-456';
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
      controllers: [PhotosController],
      providers: [{ provide: PhotosService, useValue: mockPhotosService }],
    }).compile();

    controller = module.get<PhotosController>(PhotosController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createPhoto', () => {
    const dto = {
      publicId: 'trainer-app/progress-photos/client-123/photo-new',
      secureUrl: 'https://res.cloudinary.com/test/image/upload/photo-new',
      category: 'progress-photos' as const,
    };

    it('should call service.createPhoto with authenticated user ID and dto', async () => {
      const user = { id: CLIENT_ID, email: 'client@example.com' };
      const createdPhoto = makePhoto({ ...dto });
      mockPhotosService.createPhoto.mockResolvedValue(createdPhoto);

      const result = await controller.createPhoto(user, dto);

      expect(mockPhotosService.createPhoto).toHaveBeenCalledWith(CLIENT_ID, dto);
      expect(mockPhotosService.createPhoto).toHaveBeenCalledTimes(1);
      expect(result).toEqual(createdPhoto);
    });

    it('should handle pose-analysis category', async () => {
      const user = { id: CLIENT_ID, email: 'client@example.com' };
      const poseDto = {
        publicId: 'trainer-app/pose-analysis/client-123/pose-xyz',
        secureUrl: 'https://res.cloudinary.com/test/image/upload/pose-xyz',
        category: 'pose-analysis' as const,
      };
      const createdPhoto = makePhoto({ ...poseDto, category: 'pose-analysis' });
      mockPhotosService.createPhoto.mockResolvedValue(createdPhoto);

      const result = await controller.createPhoto(user, poseDto);

      expect(mockPhotosService.createPhoto).toHaveBeenCalledWith(CLIENT_ID, poseDto);
      expect(result.category).toBe('pose-analysis');
    });
  });

  describe('getPhotos', () => {
    it('should call service.getPhotos with user ID without category filter', async () => {
      const user = { id: CLIENT_ID, email: 'client@example.com' };
      const photos = [makePhoto({ id: 'photo-1' }), makePhoto({ id: 'photo-2' })];
      mockPhotosService.getPhotos.mockResolvedValue(photos);

      const result = await controller.getPhotos(user, {});

      expect(mockPhotosService.getPhotos).toHaveBeenCalledWith(CLIENT_ID, undefined);
      expect(result).toEqual(photos);
      expect(result.length).toBe(2);
    });

    it('should pass category filter when provided', async () => {
      const user = { id: CLIENT_ID, email: 'client@example.com' };
      const photos = [makePhoto({ category: 'progress-photos' })];
      mockPhotosService.getPhotos.mockResolvedValue(photos);

      const result = await controller.getPhotos(user, { category: 'progress-photos' });

      expect(mockPhotosService.getPhotos).toHaveBeenCalledWith(CLIENT_ID, 'progress-photos');
      expect(result).toEqual(photos);
    });

    it('should handle pose-analysis category filter', async () => {
      const user = { id: CLIENT_ID, email: 'client@example.com' };
      const photos = [makePhoto({ category: 'pose-analysis' })];
      mockPhotosService.getPhotos.mockResolvedValue(photos);

      const result = await controller.getPhotos(user, { category: 'pose-analysis' });

      expect(mockPhotosService.getPhotos).toHaveBeenCalledWith(CLIENT_ID, 'pose-analysis');
      expect(result.every(p => p.category === 'pose-analysis')).toBe(true);
    });

    it('should return empty array when no photos exist', async () => {
      const user = { id: CLIENT_ID, email: 'client@example.com' };
      mockPhotosService.getPhotos.mockResolvedValue([]);

      const result = await controller.getPhotos(user, {});

      expect(result).toEqual([]);
    });
  });

  describe('deletePhoto', () => {
    it('should call service.deletePhoto with photo ID and user ID', async () => {
      const user = { id: CLIENT_ID, email: 'client@example.com' };
      const response = { message: 'Фото удалено' };
      mockPhotosService.deletePhoto.mockResolvedValue(response);

      const result = await controller.deletePhoto(user, PHOTO_ID);

      expect(mockPhotosService.deletePhoto).toHaveBeenCalledWith(PHOTO_ID, CLIENT_ID);
      expect(mockPhotosService.deletePhoto).toHaveBeenCalledTimes(1);
      expect(result).toEqual(response);
    });

    it('should return success message on deletion', async () => {
      const user = { id: CLIENT_ID, email: 'client@example.com' };
      mockPhotosService.deletePhoto.mockResolvedValue({ message: 'Фото удалено' });

      const result = await controller.deletePhoto(user, PHOTO_ID);

      expect(result.message).toBe('Фото удалено');
    });
  });

  describe('getClientPhotos', () => {
    it('should call service.getClientPhotos with clientId, trainerId, and no category', async () => {
      const trainer = { id: TRAINER_ID, email: 'trainer@example.com' };
      const photos = [makePhoto({ id: 'photo-1' }), makePhoto({ id: 'photo-2' })];
      mockPhotosService.getClientPhotos.mockResolvedValue(photos);

      const result = await controller.getClientPhotos(trainer, CLIENT_ID, {});

      expect(mockPhotosService.getClientPhotos).toHaveBeenCalledWith(
        CLIENT_ID,
        TRAINER_ID,
        undefined,
      );
      expect(result).toEqual(photos);
    });

    it('should pass category filter to service when provided', async () => {
      const trainer = { id: TRAINER_ID, email: 'trainer@example.com' };
      const photos = [makePhoto({ category: 'pose-analysis' })];
      mockPhotosService.getClientPhotos.mockResolvedValue(photos);

      const result = await controller.getClientPhotos(trainer, CLIENT_ID, {
        category: 'pose-analysis',
      });

      expect(mockPhotosService.getClientPhotos).toHaveBeenCalledWith(
        CLIENT_ID,
        TRAINER_ID,
        'pose-analysis',
      );
      expect(result).toEqual(photos);
    });

    it('should use authenticated trainer ID, not from request body', async () => {
      const authenticatedTrainer = { id: TRAINER_ID, email: 'trainer@example.com' };
      const photos = [makePhoto()];
      mockPhotosService.getClientPhotos.mockResolvedValue(photos);

      await controller.getClientPhotos(authenticatedTrainer, CLIENT_ID, {});

      // Verify that the authenticated trainer's ID is used
      expect(mockPhotosService.getClientPhotos).toHaveBeenCalledWith(
        CLIENT_ID,
        TRAINER_ID,
        undefined,
      );
      // Ensure the call was made exactly once with the correct parameters
      expect(mockPhotosService.getClientPhotos).toHaveBeenCalledTimes(1);
    });

    it('should handle progress-photos category filter', async () => {
      const trainer = { id: TRAINER_ID, email: 'trainer@example.com' };
      const photos = [makePhoto({ category: 'progress-photos' })];
      mockPhotosService.getClientPhotos.mockResolvedValue(photos);

      const result = await controller.getClientPhotos(trainer, CLIENT_ID, {
        category: 'progress-photos',
      });

      expect(mockPhotosService.getClientPhotos).toHaveBeenCalledWith(
        CLIENT_ID,
        TRAINER_ID,
        'progress-photos',
      );
      expect(result.every(p => p.category === 'progress-photos')).toBe(true);
    });

    it('should return empty array when client has no photos', async () => {
      const trainer = { id: TRAINER_ID, email: 'trainer@example.com' };
      mockPhotosService.getClientPhotos.mockResolvedValue([]);

      const result = await controller.getClientPhotos(trainer, CLIENT_ID, {});

      expect(result).toEqual([]);
    });
  });
});
