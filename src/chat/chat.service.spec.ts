import { Test, TestingModule } from '@nestjs/testing';
import { ChatService } from './chat.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';

describe('ChatService', () => {
  let service: ChatService;

  const mockPrismaService = {
    conversation: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    message: {
      findMany: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
      count: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    trainerClient: {
      findFirst: jest.fn(),
    },
  };

  const mockNotificationsService = {
    notifyNewMessage: jest.fn(),
  };

  const mockConversation = {
    id: 'conv-1',
    trainerId: 'trainer-1',
    clientId: 'client-1',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: NotificationsService, useValue: mockNotificationsService },
      ],
    }).compile();

    service = module.get<ChatService>(ChatService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ──────────────────────────────────────────────────────────
  describe('getConversations', () => {
    it('should return conversations with lastMessage and unreadCount', async () => {
      const message = {
        id: 'msg-1',
        text: 'Привет',
        senderId: 'trainer-1',
        isRead: false,
        createdAt: new Date(),
      };
      mockPrismaService.conversation.findMany.mockResolvedValue([
        {
          ...mockConversation,
          trainer: { id: 'trainer-1', firstName: 'Иван', lastName: 'Иванов' },
          client: { id: 'client-1', firstName: 'Мария', lastName: 'Петрова' },
          messages: [message],
        },
      ]);
      mockPrismaService.message.count.mockResolvedValue(2);

      const result = await service.getConversations('client-1');

      expect(mockPrismaService.conversation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { OR: [{ trainerId: 'client-1' }, { clientId: 'client-1' }] },
        }),
      );
      expect(result).toHaveLength(1);
      expect(result[0].lastMessage).toEqual(message);
      expect(result[0].unreadCount).toBe(2);
    });

    it('should set lastMessage to null when conversation has no messages', async () => {
      mockPrismaService.conversation.findMany.mockResolvedValue([
        {
          ...mockConversation,
          trainer: { id: 'trainer-1', firstName: 'Иван', lastName: 'Иванов' },
          client: { id: 'client-1', firstName: 'Мария', lastName: 'Петрова' },
          messages: [],
        },
      ]);
      mockPrismaService.message.count.mockResolvedValue(0);

      const result = await service.getConversations('client-1');

      expect(result[0].lastMessage).toBeNull();
      expect(result[0].unreadCount).toBe(0);
    });
  });

  // ──────────────────────────────────────────────────────────
  describe('getMessages', () => {
    it('should return messages and mark unread as read', async () => {
      mockPrismaService.conversation.findUnique.mockResolvedValue(mockConversation);
      const messages = [
        { id: 'msg-1', text: 'Hello', senderId: 'trainer-1', isRead: false, createdAt: new Date() },
      ];
      mockPrismaService.message.findMany.mockResolvedValue(messages);
      mockPrismaService.message.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.getMessages('conv-1', 'client-1', {});

      expect(mockPrismaService.message.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { conversationId: 'conv-1' }, take: 30 }),
      );
      expect(mockPrismaService.message.updateMany).toHaveBeenCalledWith({
        where: { conversationId: 'conv-1', senderId: { not: 'client-1' }, isRead: false },
        data: { isRead: true },
      });
      expect(result).toEqual(messages);
    });

    it('should apply before cursor when provided', async () => {
      mockPrismaService.conversation.findUnique.mockResolvedValue(mockConversation);
      mockPrismaService.message.findMany.mockResolvedValue([]);
      mockPrismaService.message.updateMany.mockResolvedValue({ count: 0 });

      const before = '2026-06-19T10:00:00.000Z';
      await service.getMessages('conv-1', 'client-1', { before, limit: 10 });

      expect(mockPrismaService.message.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { conversationId: 'conv-1', createdAt: { lt: new Date(before) } },
          take: 10,
        }),
      );
    });

    it('should throw ForbiddenException when user is not a participant', async () => {
      mockPrismaService.conversation.findUnique.mockResolvedValue(mockConversation);

      await expect(service.getMessages('conv-1', 'outsider-id', {})).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw NotFoundException when conversation does not exist', async () => {
      mockPrismaService.conversation.findUnique.mockResolvedValue(null);

      await expect(service.getMessages('bad-conv', 'client-1', {})).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ──────────────────────────────────────────────────────────
  describe('sendMessage', () => {
    const createdMessage = {
      id: 'msg-new',
      conversationId: 'conv-1',
      senderId: 'trainer-1',
      text: 'Привет!',
      isRead: false,
      createdAt: new Date(),
    };

    beforeEach(() => {
      mockPrismaService.conversation.findUnique.mockResolvedValue(mockConversation);
      mockPrismaService.message.create.mockResolvedValue(createdMessage);
      mockPrismaService.conversation.update.mockResolvedValue(mockConversation);
      mockPrismaService.user.findUnique.mockResolvedValue({ firstName: 'Иван', lastName: 'Иванов' });
      mockNotificationsService.notifyNewMessage.mockResolvedValue(undefined);
    });

    it('should create message and notify recipient', async () => {
      const result = await service.sendMessage('conv-1', 'trainer-1', { text: 'Привет!' });

      expect(mockPrismaService.message.create).toHaveBeenCalledWith({
        data: { conversationId: 'conv-1', senderId: 'trainer-1', text: 'Привет!' },
      });
      expect(mockPrismaService.conversation.update).toHaveBeenCalledWith({
        where: { id: 'conv-1' },
        data: { updatedAt: expect.any(Date) },
      });
      expect(mockNotificationsService.notifyNewMessage).toHaveBeenCalledWith(
        'client-1',
        'Иван Иванов',
        'Привет!',
        'conv-1',
      );
      expect(result).toEqual(createdMessage);
    });

    it('should send notification to trainer when client sends message', async () => {
      await service.sendMessage('conv-1', 'client-1', { text: 'Ок' });

      expect(mockNotificationsService.notifyNewMessage).toHaveBeenCalledWith(
        'trainer-1',
        expect.any(String),
        'Ок',
        'conv-1',
      );
    });

    it('should throw ForbiddenException when user is not a participant', async () => {
      mockPrismaService.conversation.findUnique.mockResolvedValue(mockConversation);

      await expect(service.sendMessage('conv-1', 'stranger-id', { text: 'Hi' })).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  // ──────────────────────────────────────────────────────────
  describe('findOrCreateConversation', () => {
    it('should return existing conversation found in direct direction', async () => {
      mockPrismaService.conversation.findFirst.mockResolvedValue(mockConversation);

      const result = await service.findOrCreateConversation('trainer-1', 'client-1');

      expect(mockPrismaService.conversation.findFirst).toHaveBeenCalledWith({
        where: {
          OR: [
            { trainerId: 'trainer-1', clientId: 'client-1' },
            { trainerId: 'client-1', clientId: 'trainer-1' },
          ],
        },
      });
      expect(mockPrismaService.user.findUnique).not.toHaveBeenCalled();
      expect(mockPrismaService.conversation.create).not.toHaveBeenCalled();
      expect(result).toEqual(mockConversation);
    });

    it('should return existing conversation found in reverse direction', async () => {
      const reversedConv = { ...mockConversation, trainerId: 'client-1', clientId: 'trainer-1' };
      mockPrismaService.conversation.findFirst.mockResolvedValue(reversedConv);

      const result = await service.findOrCreateConversation('trainer-1', 'client-1');

      expect(mockPrismaService.conversation.create).not.toHaveBeenCalled();
      expect(result).toEqual(reversedConv);
    });

    it('should create conversation when it does not exist (TRAINER + CLIENT)', async () => {
      mockPrismaService.conversation.findFirst.mockResolvedValue(null);
      mockPrismaService.user.findUnique
        .mockResolvedValueOnce({ role: Role.TRAINER })
        .mockResolvedValueOnce({ role: Role.CLIENT });
      mockPrismaService.conversation.create.mockResolvedValue(mockConversation);

      const result = await service.findOrCreateConversation('trainer-1', 'client-1');

      expect(mockPrismaService.conversation.create).toHaveBeenCalledWith({
        data: { trainerId: 'trainer-1', clientId: 'client-1' },
      });
      expect(result).toEqual(mockConversation);
    });

    it('should swap roles when CLIENT initiates with TRAINER', async () => {
      mockPrismaService.conversation.findFirst.mockResolvedValue(null);
      mockPrismaService.user.findUnique
        .mockResolvedValueOnce({ role: Role.CLIENT })
        .mockResolvedValueOnce({ role: Role.TRAINER });
      mockPrismaService.conversation.create.mockResolvedValue({
        ...mockConversation,
        trainerId: 'other-user-id',
        clientId: 'current-user-id',
      });

      await service.findOrCreateConversation('current-user-id', 'other-user-id');

      expect(mockPrismaService.conversation.create).toHaveBeenCalledWith({
        data: { trainerId: 'other-user-id', clientId: 'current-user-id' },
      });
    });

    it('should use TrainerClient relation when both users are TRAINER_CLIENT', async () => {
      mockPrismaService.conversation.findFirst.mockResolvedValue(null);
      mockPrismaService.user.findUnique
        .mockResolvedValueOnce({ role: Role.TRAINER_CLIENT })
        .mockResolvedValueOnce({ role: Role.TRAINER_CLIENT });
      mockPrismaService.trainerClient.findFirst.mockResolvedValue({
        trainerId: 'user-b',
        clientId: 'user-a',
      });
      mockPrismaService.conversation.create.mockResolvedValue({
        ...mockConversation,
        trainerId: 'user-b',
        clientId: 'user-a',
      });

      await service.findOrCreateConversation('user-a', 'user-b');

      expect(mockPrismaService.conversation.create).toHaveBeenCalledWith({
        data: { trainerId: 'user-b', clientId: 'user-a' },
      });
    });

    it('should treat initiator as trainer when both TRAINER_CLIENT and no TrainerClient link', async () => {
      mockPrismaService.conversation.findFirst.mockResolvedValue(null);
      mockPrismaService.user.findUnique
        .mockResolvedValueOnce({ role: Role.TRAINER_CLIENT })
        .mockResolvedValueOnce({ role: Role.TRAINER_CLIENT });
      mockPrismaService.trainerClient.findFirst.mockResolvedValue(null);
      mockPrismaService.conversation.create.mockResolvedValue(mockConversation);

      await service.findOrCreateConversation('user-a', 'user-b');

      expect(mockPrismaService.conversation.create).toHaveBeenCalledWith({
        data: { trainerId: 'user-a', clientId: 'user-b' },
      });
    });

    it('should handle P2002 race condition by re-fetching with findFirst', async () => {
      mockPrismaService.conversation.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(mockConversation);
      mockPrismaService.user.findUnique
        .mockResolvedValueOnce({ role: Role.TRAINER })
        .mockResolvedValueOnce({ role: Role.CLIENT });
      const p2002Error = Object.assign(new Error('Unique constraint'), { code: 'P2002' });
      mockPrismaService.conversation.create.mockRejectedValue(p2002Error);

      const result = await service.findOrCreateConversation('trainer-1', 'client-1');

      expect(result).toEqual(mockConversation);
    });

    it('should throw NotFoundException when a user does not exist', async () => {
      mockPrismaService.conversation.findFirst.mockResolvedValue(null);
      mockPrismaService.user.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ role: Role.CLIENT });

      await expect(service.findOrCreateConversation('ghost-id', 'client-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ──────────────────────────────────────────────────────────
  describe('markAsRead', () => {
    it('should mark messages from the other participant as read', async () => {
      mockPrismaService.conversation.findUnique.mockResolvedValue(mockConversation);
      mockPrismaService.message.updateMany.mockResolvedValue({ count: 3 });

      const result = await service.markAsRead('conv-1', 'client-1');

      expect(mockPrismaService.message.updateMany).toHaveBeenCalledWith({
        where: { conversationId: 'conv-1', senderId: { not: 'client-1' }, isRead: false },
        data: { isRead: true },
      });
      expect(result).toEqual({ updated: 3 });
    });

    it('should throw ForbiddenException when user is not a participant', async () => {
      mockPrismaService.conversation.findUnique.mockResolvedValue(mockConversation);

      await expect(service.markAsRead('conv-1', 'outsider-id')).rejects.toThrow(ForbiddenException);
    });
  });
});
