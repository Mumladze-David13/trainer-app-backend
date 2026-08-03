import { Test, TestingModule } from '@nestjs/testing';
import { CloudinaryController } from './cloudinary.controller';
import { CloudinaryService } from './cloudinary.service';

describe('CloudinaryController', () => {
  let controller: CloudinaryController;

  const mockCloudinaryService = {
    generateUploadSignature: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CloudinaryController],
      providers: [{ provide: CloudinaryService, useValue: mockCloudinaryService }],
    }).compile();

    controller = module.get<CloudinaryController>(CloudinaryController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('generateSignature', () => {
    const mockSignatureResponse = {
      timestamp: 1234567890,
      signature: 'test-signature',
      apiKey: 'test-api-key',
      cloudName: 'test-cloud',
      folder: 'trainer-app/progress-photos/user-123',
    };

    it('should generate signature using authenticated user ID, not request body', () => {
      const authenticatedUser = { id: 'user-123', email: 'user@example.com' };
      const dto = { category: 'progress-photos' as const };

      mockCloudinaryService.generateUploadSignature.mockReturnValue(mockSignatureResponse);

      const result = controller.generateSignature(authenticatedUser, dto);

      expect(mockCloudinaryService.generateUploadSignature).toHaveBeenCalledWith(
        'trainer-app/progress-photos/user-123',
      );
      expect(result).toEqual(mockSignatureResponse);
    });

    it('should ignore userId field in request body (security fix)', () => {
      const authenticatedUser = { id: 'real-user-123', email: 'real@example.com' };
      const dtoWithMaliciousUserId = {
        category: 'progress-photos' as const,
        userId: 'attacker-user-456', // This should be ignored
      } as any;

      mockCloudinaryService.generateUploadSignature.mockReturnValue({
        ...mockSignatureResponse,
        folder: 'trainer-app/progress-photos/real-user-123',
      });

      controller.generateSignature(authenticatedUser, dtoWithMaliciousUserId);

      // Verify that the folder uses the authenticated user's ID, NOT the userId from body
      expect(mockCloudinaryService.generateUploadSignature).toHaveBeenCalledWith(
        'trainer-app/progress-photos/real-user-123',
      );
      // Verify the malicious userId was NOT used
      expect(mockCloudinaryService.generateUploadSignature).not.toHaveBeenCalledWith(
        expect.stringContaining('attacker-user-456'),
      );
    });

    it('should build folder path with pose-analysis category', () => {
      const authenticatedUser = { id: 'user-456', email: 'user@example.com' };
      const dto = { category: 'pose-analysis' as const };

      mockCloudinaryService.generateUploadSignature.mockReturnValue({
        ...mockSignatureResponse,
        folder: 'trainer-app/pose-analysis/user-456',
      });

      controller.generateSignature(authenticatedUser, dto);

      expect(mockCloudinaryService.generateUploadSignature).toHaveBeenCalledWith(
        'trainer-app/pose-analysis/user-456',
      );
    });

    it('should use correct folder format: trainer-app/{category}/{userId}', () => {
      const authenticatedUser = { id: 'abc-123-xyz', email: 'test@example.com' };
      const dto = { category: 'progress-photos' as const };

      mockCloudinaryService.generateUploadSignature.mockReturnValue(mockSignatureResponse);

      controller.generateSignature(authenticatedUser, dto);

      const expectedFolder = `trainer-app/${dto.category}/${authenticatedUser.id}`;
      expect(mockCloudinaryService.generateUploadSignature).toHaveBeenCalledWith(expectedFolder);
    });

    it('should return signature response from service', () => {
      const authenticatedUser = { id: 'user-789', email: 'user@example.com' };
      const dto = { category: 'progress-photos' as const };

      mockCloudinaryService.generateUploadSignature.mockReturnValue(mockSignatureResponse);

      const result = controller.generateSignature(authenticatedUser, dto);

      expect(result).toEqual(mockSignatureResponse);
      expect(result.timestamp).toBe(1234567890);
      expect(result.signature).toBe('test-signature');
      expect(result.apiKey).toBe('test-api-key');
      expect(result.cloudName).toBe('test-cloud');
    });
  });
});
