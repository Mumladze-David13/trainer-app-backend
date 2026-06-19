import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ExecutionContext } from '@nestjs/common';

describe('NotificationsController', () => {
  let controller: NotificationsController;
  let service: NotificationsService;

  const mockUser = { id: 'user-1', email: 'user@example.com', role: 'CLIENT' };

  const mockNotificationsService = {
    saveFcmToken: jest.fn(),
  };

  const mockJwtAuthGuard = {
    canActivate: (context: ExecutionContext) => {
      const request = context.switchToHttp().getRequest();
      request.user = mockUser;
      return true;
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [
        { provide: NotificationsService, useValue: mockNotificationsService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(mockJwtAuthGuard)
      .compile();

    controller = module.get<NotificationsController>(NotificationsController);
    service = module.get<NotificationsService>(NotificationsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('saveFcmToken', () => {
    it('should call service.saveFcmToken with user id and token', async () => {
      const token = 'device-fcm-token-123';
      mockNotificationsService.saveFcmToken.mockResolvedValue({ id: mockUser.id, fcmToken: token });

      const result = await controller.saveFcmToken(mockUser as any, { token });

      expect(service.saveFcmToken).toHaveBeenCalledWith(mockUser.id, token);
      expect(service.saveFcmToken).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ id: mockUser.id, fcmToken: token });
    });
  });
});
