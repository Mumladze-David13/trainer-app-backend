import { Test, TestingModule } from '@nestjs/testing';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ExecutionContext } from '@nestjs/common';

describe('ChatController', () => {
  let controller: ChatController;
  let service: ChatService;

  const mockUser = { id: 'user-1', email: 'user@example.com', role: 'TRAINER' };

  const mockChatService = {
    getConversations: jest.fn(),
    getMessages: jest.fn(),
    sendMessage: jest.fn(),
    findOrCreateConversation: jest.fn(),
    markAsRead: jest.fn(),
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
      controllers: [ChatController],
      providers: [{ provide: ChatService, useValue: mockChatService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(mockJwtAuthGuard)
      .compile();

    controller = module.get<ChatController>(ChatController);
    service = module.get<ChatService>(ChatService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getConversations', () => {
    it('should call service.getConversations with current user id', async () => {
      const conversations = [{ id: 'conv-1', trainerId: 'user-1', clientId: 'client-1' }];
      mockChatService.getConversations.mockResolvedValue(conversations);

      const result = await controller.getConversations(mockUser as any);

      expect(service.getConversations).toHaveBeenCalledWith(mockUser.id);
      expect(result).toEqual(conversations);
    });
  });

  describe('getMessages', () => {
    it('should call service.getMessages with conversationId, userId, and dto', async () => {
      const messages = [{ id: 'msg-1', text: 'Hello' }];
      mockChatService.getMessages.mockResolvedValue(messages);
      const dto = { limit: 10 };

      const result = await controller.getMessages(mockUser as any, 'conv-1', dto);

      expect(service.getMessages).toHaveBeenCalledWith('conv-1', mockUser.id, dto);
      expect(result).toEqual(messages);
    });
  });

  describe('sendMessage', () => {
    it('should call service.sendMessage with conversationId, userId, and dto', async () => {
      const message = { id: 'msg-new', text: 'Привет!', senderId: 'user-1' };
      mockChatService.sendMessage.mockResolvedValue(message);
      const dto = { text: 'Привет!' };

      const result = await controller.sendMessage(mockUser as any, 'conv-1', dto);

      expect(service.sendMessage).toHaveBeenCalledWith('conv-1', mockUser.id, dto);
      expect(result).toEqual(message);
    });
  });

  describe('findOrCreateConversation', () => {
    it('should call service.findOrCreateConversation with currentUserId and otherUserId', async () => {
      const conversation = { id: 'conv-1', trainerId: 'user-1', clientId: 'other-user' };
      mockChatService.findOrCreateConversation.mockResolvedValue(conversation);

      const result = await controller.findOrCreateConversation(mockUser as any, 'other-user');

      expect(service.findOrCreateConversation).toHaveBeenCalledWith(mockUser.id, 'other-user');
      expect(result).toEqual(conversation);
    });
  });

  describe('markAsRead', () => {
    it('should call service.markAsRead with conversationId and userId', async () => {
      mockChatService.markAsRead.mockResolvedValue({ updated: 5 });

      const result = await controller.markAsRead(mockUser as any, 'conv-1');

      expect(service.markAsRead).toHaveBeenCalledWith('conv-1', mockUser.id);
      expect(result).toEqual({ updated: 5 });
    });
  });
});
