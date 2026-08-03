import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { CloudinaryService } from './cloudinary.service';

// Mock the cloudinary module
jest.mock('cloudinary', () => ({
  v2: {
    config: jest.fn(),
    utils: {
      api_sign_request: jest.fn(),
    },
    url: jest.fn(),
    uploader: {
      destroy: jest.fn(),
    },
  },
}));

import { v2 as cloudinary } from 'cloudinary';

describe('CloudinaryService', () => {
  let service: CloudinaryService;

  const mockConfigService = {
    get: jest.fn((key: string) => {
      const config: Record<string, string> = {
        CLOUDINARY_CLOUD_NAME: 'test-cloud',
        CLOUDINARY_API_KEY: 'test-api-key',
        CLOUDINARY_API_SECRET: 'test-api-secret',
      };
      return config[key];
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CloudinaryService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<CloudinaryService>(CloudinaryService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should configure cloudinary on initialization', () => {
    expect(cloudinary.config).toHaveBeenCalledWith({
      cloud_name: 'test-cloud',
      api_key: 'test-api-key',
      api_secret: 'test-api-secret',
    });
  });

  describe('generateUploadSignature', () => {
    beforeEach(() => {
      jest.spyOn(Date, 'now').mockReturnValue(1234567890000);
      (cloudinary.utils.api_sign_request as jest.Mock).mockReturnValue('mocked-signature');
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should generate signature with folder only', () => {
      const folder = 'trainer-app/progress-photos/user-123';

      const result = service.generateUploadSignature(folder);

      expect(cloudinary.utils.api_sign_request).toHaveBeenCalledWith(
        { timestamp: 1234567890, folder: 'trainer-app/progress-photos/user-123' },
        'test-api-secret',
      );
      expect(result).toEqual({
        timestamp: 1234567890,
        signature: 'mocked-signature',
        apiKey: 'test-api-key',
        cloudName: 'test-cloud',
        folder: 'trainer-app/progress-photos/user-123',
      });
    });

    it('should include public_id in signature when provided', () => {
      const folder = 'trainer-app/pose-analysis/user-456';
      const publicId = 'custom-photo-id';

      const result = service.generateUploadSignature(folder, publicId);

      expect(cloudinary.utils.api_sign_request).toHaveBeenCalledWith(
        {
          timestamp: 1234567890,
          folder: 'trainer-app/pose-analysis/user-456',
          public_id: 'custom-photo-id',
        },
        'test-api-secret',
      );
      expect(result).toEqual({
        timestamp: 1234567890,
        signature: 'mocked-signature',
        apiKey: 'test-api-key',
        cloudName: 'test-cloud',
        folder: 'trainer-app/pose-analysis/user-456',
      });
    });

    it('should generate unique timestamp for each call', () => {
      jest.spyOn(Date, 'now').mockReturnValueOnce(1000000000000).mockReturnValueOnce(2000000000000);

      const result1 = service.generateUploadSignature('folder1');
      const result2 = service.generateUploadSignature('folder2');

      expect(result1.timestamp).toBe(1000000000);
      expect(result2.timestamp).toBe(2000000000);
    });
  });

  describe('buildDeliveryUrl', () => {
    beforeEach(() => {
      (cloudinary.url as jest.Mock).mockReturnValue('https://res.cloudinary.com/test-cloud/image/upload/photo-123');
    });

    it('should build URL without transformation', () => {
      const publicId = 'trainer-app/progress-photos/user-123/photo-123';

      const result = service.buildDeliveryUrl(publicId);

      expect(cloudinary.url).toHaveBeenCalledWith(publicId, { secure: true });
      expect(result).toBe('https://res.cloudinary.com/test-cloud/image/upload/photo-123');
    });

    it('should build URL with transformation', () => {
      const publicId = 'trainer-app/pose-analysis/user-456/pose-abc';
      const transformation = 'w_500,h_500,c_fill';

      const result = service.buildDeliveryUrl(publicId, transformation);

      expect(cloudinary.url).toHaveBeenCalledWith(publicId, {
        secure: true,
        transformation: 'w_500,h_500,c_fill',
      });
      expect(result).toBe('https://res.cloudinary.com/test-cloud/image/upload/photo-123');
    });

    it('should not include transformation key when transformation is undefined', () => {
      const publicId = 'photo-id';

      service.buildDeliveryUrl(publicId, undefined);

      expect(cloudinary.url).toHaveBeenCalledWith(publicId, { secure: true });
    });

    it('should not include transformation key when transformation is empty string', () => {
      const publicId = 'photo-id';

      service.buildDeliveryUrl(publicId, '');

      expect(cloudinary.url).toHaveBeenCalledWith(publicId, { secure: true });
    });
  });

  describe('deleteAsset', () => {
    beforeEach(() => {
      (cloudinary.uploader.destroy as jest.Mock).mockResolvedValue({ result: 'ok' });
    });

    it('should call cloudinary.uploader.destroy with publicId', async () => {
      const publicId = 'trainer-app/progress-photos/user-123/photo-xyz';

      await service.deleteAsset(publicId);

      expect(cloudinary.uploader.destroy).toHaveBeenCalledWith(publicId);
      expect(cloudinary.uploader.destroy).toHaveBeenCalledTimes(1);
    });

    it('should handle successful deletion', async () => {
      (cloudinary.uploader.destroy as jest.Mock).mockResolvedValue({ result: 'ok' });

      await expect(service.deleteAsset('some-photo-id')).resolves.not.toThrow();
    });

    it('should propagate errors from cloudinary API', async () => {
      const error = new Error('Cloudinary API error');
      (cloudinary.uploader.destroy as jest.Mock).mockRejectedValue(error);

      await expect(service.deleteAsset('invalid-id')).rejects.toThrow('Cloudinary API error');
    });
  });
});
