import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsService } from './notifications.service';
import { PrismaService } from '../prisma/prisma.service';

// Mock firebase-admin modules before any imports resolve them
const mockSend = jest.fn();
const mockGetMessaging = jest.fn(() => ({ send: mockSend }));
const mockInitializeApp = jest.fn();
const mockGetApps = jest.fn(() => []);
const mockCert = jest.fn((config) => config);

jest.mock('firebase-admin/app', () => ({
  initializeApp: (...args: unknown[]) => mockInitializeApp(...args),
  getApps: () => mockGetApps(),
  cert: (config: unknown) => mockCert(config),
}));

jest.mock('firebase-admin/messaging', () => ({
  getMessaging: () => mockGetMessaging(),
}));

describe('NotificationsService', () => {
  let service: NotificationsService;

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockGetApps.mockReturnValue([]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('onModuleInit', () => {
    it('should initialize Firebase when no apps exist', () => {
      mockGetApps.mockReturnValue([]);
      service.onModuleInit();
      expect(mockInitializeApp).toHaveBeenCalledTimes(1);
    });

    it('should not initialize Firebase when an app already exists', () => {
      mockGetApps.mockReturnValue([{}]);
      service.onModuleInit();
      expect(mockInitializeApp).not.toHaveBeenCalled();
    });
  });

  describe('saveFcmToken', () => {
    it('should update user fcmToken', async () => {
      const userId = 'user-1';
      const token = 'fcm-token-abc';
      mockPrismaService.user.update.mockResolvedValue({ id: userId, fcmToken: token });

      await service.saveFcmToken(userId, token);

      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: { fcmToken: token },
      });
    });
  });

  describe('notifyWorkoutCreated', () => {
    it('should send push when client has fcmToken', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ fcmToken: 'token-xyz' });
      mockSend.mockResolvedValue('message-id');

      await service.notifyWorkoutCreated('client-1', 'Иван Иванов');

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          token: 'token-xyz',
          notification: expect.objectContaining({ body: expect.stringContaining('Иван Иванов') }),
        }),
      );
    });

    it('should do nothing when client has no fcmToken', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ fcmToken: null });

      await service.notifyWorkoutCreated('client-1', 'Иван Иванов');

      expect(mockSend).not.toHaveBeenCalled();
    });

    it('should do nothing when client not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await service.notifyWorkoutCreated('client-1', 'Иван Иванов');

      expect(mockSend).not.toHaveBeenCalled();
    });
  });

  describe('notifyNewMessage', () => {
    it('should send push with full text when under 100 chars', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ fcmToken: 'token-xyz' });
      mockSend.mockResolvedValue('message-id');
      const text = 'Привет!';

      await service.notifyNewMessage('recipient-1', 'Мария', text, 'conv-1', 'sender-1');

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          notification: expect.objectContaining({ body: text }),
          data: expect.objectContaining({
            type: 'NEW_MESSAGE',
            conversationId: 'conv-1',
            senderId: 'sender-1',
          }),
        }),
      );
    });

    it('should truncate text longer than 100 chars', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ fcmToken: 'token-xyz' });
      mockSend.mockResolvedValue('message-id');
      const longText = 'a'.repeat(150);

      await service.notifyNewMessage('recipient-1', 'Мария', longText, 'conv-1', 'sender-1');

      const call = mockSend.mock.calls[0][0];
      expect(call.notification.body).toHaveLength(103); // 100 + '...'
      expect(call.notification.body.endsWith('...')).toBe(true);
    });

    it('should do nothing when recipient has no fcmToken', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ fcmToken: null });

      await service.notifyNewMessage('recipient-1', 'Мария', 'Привет', 'conv-1', 'sender-1');

      expect(mockSend).not.toHaveBeenCalled();
    });
  });

  describe('sendPush error handling', () => {
    it('should clear invalid FCM token on messaging/invalid-registration-token', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ fcmToken: 'bad-token' });
      const error = new Error('Invalid token') as Error & { code: string };
      error.code = 'messaging/invalid-registration-token';
      mockSend.mockRejectedValue(error);
      mockPrismaService.user.updateMany.mockResolvedValue({ count: 1 });

      // Should not throw
      await expect(service.notifyWorkoutCreated('client-1', 'Trainer')).resolves.toBeUndefined();

      expect(mockPrismaService.user.updateMany).toHaveBeenCalledWith({
        where: { fcmToken: 'bad-token' },
        data: { fcmToken: null },
      });
    });

    it('should clear token on messaging/registration-token-not-registered', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ fcmToken: 'stale-token' });
      const error = new Error('Token not registered') as Error & { code: string };
      error.code = 'messaging/registration-token-not-registered';
      mockSend.mockRejectedValue(error);
      mockPrismaService.user.updateMany.mockResolvedValue({ count: 1 });

      await expect(service.notifyWorkoutCreated('client-1', 'Trainer')).resolves.toBeUndefined();

      expect(mockPrismaService.user.updateMany).toHaveBeenCalledWith({
        where: { fcmToken: 'stale-token' },
        data: { fcmToken: null },
      });
    });

    it('should not clear token on unrelated Firebase error', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ fcmToken: 'token' });
      const error = new Error('Network error') as Error & { code: string };
      error.code = 'messaging/network-error';
      mockSend.mockRejectedValue(error);

      await expect(service.notifyWorkoutCreated('client-1', 'Trainer')).resolves.toBeUndefined();

      expect(mockPrismaService.user.updateMany).not.toHaveBeenCalled();
    });
  });
});
