import { Test, TestingModule } from '@nestjs/testing';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { Server, Socket } from 'socket.io';

describe('ChatGateway', () => {
  let gateway: ChatGateway;

  const mockChatService = {
    createMessage: jest.fn(),
    markAsRead: jest.fn(),
  };

  const mockJwtService = {
    verify: jest.fn(),
  };

  const mockPrismaService = {
    conversation: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
  };

  const mockEmit = jest.fn();
  const mockTo = jest.fn().mockReturnValue({ emit: mockEmit });
  const mockServer = { to: mockTo } as unknown as Server;

  function createMockSocket(opts: {
    id?: string;
    userId?: string;
    authToken?: string;
    authHeader?: string;
  } = {}): Socket {
    return {
      id: opts.id ?? 'socket-1',
      data: { userId: opts.userId },
      handshake: {
        auth: { token: opts.authToken },
        headers: opts.authHeader ? { authorization: opts.authHeader } : {},
      },
      disconnect: jest.fn(),
      emit: jest.fn(),
      join: jest.fn(),
    } as unknown as Socket;
  }

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatGateway,
        { provide: ChatService, useValue: mockChatService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    gateway = module.get<ChatGateway>(ChatGateway);
    gateway.server = mockServer;
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });

  // ──────────────────────────────────────────────────────────
  describe('handleConnection', () => {
    it('should set userId, store socket and join conversation rooms on valid auth token', async () => {
      const client = createMockSocket({ id: 'socket-1', authToken: 'valid-token' });
      mockJwtService.verify.mockReturnValue({ sub: 'user-1' });
      mockPrismaService.conversation.findMany.mockResolvedValue([
        { id: 'conv-1' },
        { id: 'conv-2' },
      ]);

      await gateway.handleConnection(client);

      expect(mockJwtService.verify).toHaveBeenCalledWith('valid-token');
      expect(client.data.userId).toBe('user-1');
      expect(client.join).toHaveBeenCalledTimes(2);
      expect(client.join).toHaveBeenCalledWith('conversation:conv-1');
      expect(client.join).toHaveBeenCalledWith('conversation:conv-2');
      expect(client.disconnect).not.toHaveBeenCalled();
    });

    it('should extract token from Bearer Authorization header when auth.token is absent', async () => {
      const client = createMockSocket({ id: 'socket-2', authHeader: 'Bearer header-token' });
      mockJwtService.verify.mockReturnValue({ sub: 'user-2' });
      mockPrismaService.conversation.findMany.mockResolvedValue([]);

      await gateway.handleConnection(client);

      expect(mockJwtService.verify).toHaveBeenCalledWith('header-token');
      expect(client.data.userId).toBe('user-2');
    });

    it('should prefer auth.token over Authorization header when both present', async () => {
      const client = createMockSocket({
        authToken: 'auth-token',
        authHeader: 'Bearer header-token',
      });
      mockJwtService.verify.mockReturnValue({ sub: 'user-3' });
      mockPrismaService.conversation.findMany.mockResolvedValue([]);

      await gateway.handleConnection(client);

      expect(mockJwtService.verify).toHaveBeenCalledWith('auth-token');
    });

    it('should disconnect when no token is provided', async () => {
      const client = createMockSocket();

      await gateway.handleConnection(client);

      expect(client.disconnect).toHaveBeenCalled();
      expect(mockJwtService.verify).not.toHaveBeenCalled();
    });

    it('should disconnect when JWT verification throws', async () => {
      const client = createMockSocket({ authToken: 'bad-token' });
      mockJwtService.verify.mockImplementation(() => {
        throw new Error('Invalid signature');
      });

      await gateway.handleConnection(client);

      expect(client.disconnect).toHaveBeenCalled();
    });

    it('should store userId→socketId so sendToUser can target the correct socket', async () => {
      const client = createMockSocket({ id: 'socket-abc', authToken: 'tok' });
      mockJwtService.verify.mockReturnValue({ sub: 'user-4' });
      mockPrismaService.conversation.findMany.mockResolvedValue([]);

      await gateway.handleConnection(client);
      gateway.sendToUser('user-4', 'testEvent', { ok: true });

      expect(mockTo).toHaveBeenCalledWith('socket-abc');
      expect(mockEmit).toHaveBeenCalledWith('testEvent', { ok: true });
    });
  });

  // ──────────────────────────────────────────────────────────
  describe('handleDisconnect', () => {
    it('should remove user from userSockets so sendToUser no longer reaches them', async () => {
      const client = createMockSocket({ id: 'socket-1', authToken: 'tok' });
      mockJwtService.verify.mockReturnValue({ sub: 'user-1' });
      mockPrismaService.conversation.findMany.mockResolvedValue([]);
      await gateway.handleConnection(client);

      gateway.handleDisconnect(client);

      gateway.sendToUser('user-1', 'testEvent', {});
      expect(mockTo).not.toHaveBeenCalled();
    });

    it('should not throw when client has no userId (unauthenticated disconnect)', () => {
      const client = createMockSocket();
      (client.data as any).userId = undefined;

      expect(() => gateway.handleDisconnect(client)).not.toThrow();
    });
  });

  // ──────────────────────────────────────────────────────────
  describe('handleJoinConversation', () => {
    it('should join room and emit joinedConversation when user is a participant', async () => {
      const client = createMockSocket({ userId: 'user-1' });
      mockPrismaService.conversation.findFirst.mockResolvedValue({ id: 'conv-1' });

      await gateway.handleJoinConversation(client, { conversationId: 'conv-1' });

      expect(mockPrismaService.conversation.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'conv-1',
          OR: [{ trainerId: 'user-1' }, { clientId: 'user-1' }],
        },
      });
      expect(client.join).toHaveBeenCalledWith('conversation:conv-1');
      expect(client.emit).toHaveBeenCalledWith('joinedConversation', {
        conversationId: 'conv-1',
      });
    });

    it('should do nothing when client has no userId', async () => {
      const client = createMockSocket();
      (client.data as any).userId = undefined;

      await gateway.handleJoinConversation(client, { conversationId: 'conv-1' });

      expect(mockPrismaService.conversation.findFirst).not.toHaveBeenCalled();
      expect(client.join).not.toHaveBeenCalled();
    });

    it('should not join when conversation is not found or user is not a participant', async () => {
      const client = createMockSocket({ userId: 'user-1' });
      mockPrismaService.conversation.findFirst.mockResolvedValue(null);

      await gateway.handleJoinConversation(client, { conversationId: 'conv-x' });

      expect(client.join).not.toHaveBeenCalled();
      expect(client.emit).not.toHaveBeenCalled();
    });
  });

  // ──────────────────────────────────────────────────────────
  describe('handleSendMessage', () => {
    const mockMessage = {
      id: 'msg-1',
      conversationId: 'conv-1',
      senderId: 'user-1',
      text: 'Привет!',
      isRead: false,
      createdAt: new Date(),
      sender: { id: 'user-1', firstName: 'Иван', lastName: 'Иванов' },
    };

    it('should create message, broadcast newMessage to room and return message', async () => {
      const client = createMockSocket({ userId: 'user-1' });
      mockChatService.createMessage.mockResolvedValue(mockMessage);

      const result = await gateway.handleSendMessage(client, {
        conversationId: 'conv-1',
        text: '  Привет!  ',
      });

      expect(mockChatService.createMessage).toHaveBeenCalledWith('conv-1', 'user-1', 'Привет!');
      expect(mockTo).toHaveBeenCalledWith('conversation:conv-1');
      expect(mockEmit).toHaveBeenCalledWith('newMessage', mockMessage);
      expect(result).toEqual(mockMessage);
    });

    it('should trim whitespace from text before passing to createMessage', async () => {
      const client = createMockSocket({ userId: 'user-1' });
      mockChatService.createMessage.mockResolvedValue(mockMessage);

      await gateway.handleSendMessage(client, {
        conversationId: 'conv-1',
        text: '   trimmed   ',
      });

      expect(mockChatService.createMessage).toHaveBeenCalledWith('conv-1', 'user-1', 'trimmed');
    });

    it('should do nothing when client has no userId', async () => {
      const client = createMockSocket();
      (client.data as any).userId = undefined;

      const result = await gateway.handleSendMessage(client, {
        conversationId: 'conv-1',
        text: 'Hi',
      });

      expect(mockChatService.createMessage).not.toHaveBeenCalled();
      expect(result).toBeUndefined();
    });

    it('should do nothing when text is empty string', async () => {
      const client = createMockSocket({ userId: 'user-1' });

      const result = await gateway.handleSendMessage(client, {
        conversationId: 'conv-1',
        text: '',
      });

      expect(mockChatService.createMessage).not.toHaveBeenCalled();
      expect(result).toBeUndefined();
    });

    it('should do nothing when text is whitespace only', async () => {
      const client = createMockSocket({ userId: 'user-1' });

      const result = await gateway.handleSendMessage(client, {
        conversationId: 'conv-1',
        text: '   ',
      });

      expect(mockChatService.createMessage).not.toHaveBeenCalled();
      expect(result).toBeUndefined();
    });

    it('should emit error to client when createMessage throws', async () => {
      const client = createMockSocket({ userId: 'user-1' });
      mockChatService.createMessage.mockRejectedValue(new Error('DB error'));

      await gateway.handleSendMessage(client, { conversationId: 'conv-1', text: 'Привет!' });

      expect(client.emit).toHaveBeenCalledWith('error', {
        message: 'Ошибка отправки сообщения',
      });
      expect(mockTo).not.toHaveBeenCalled();
    });
  });

  // ──────────────────────────────────────────────────────────
  describe('handleMarkRead', () => {
    it('should call markAsRead and broadcast messagesRead to room', async () => {
      const client = createMockSocket({ userId: 'user-1' });
      mockChatService.markAsRead.mockResolvedValue({ updated: 3 });

      await gateway.handleMarkRead(client, { conversationId: 'conv-1' });

      expect(mockChatService.markAsRead).toHaveBeenCalledWith('conv-1', 'user-1');
      expect(mockTo).toHaveBeenCalledWith('conversation:conv-1');
      expect(mockEmit).toHaveBeenCalledWith('messagesRead', {
        conversationId: 'conv-1',
        userId: 'user-1',
      });
    });

    it('should do nothing when client has no userId', async () => {
      const client = createMockSocket();
      (client.data as any).userId = undefined;

      await gateway.handleMarkRead(client, { conversationId: 'conv-1' });

      expect(mockChatService.markAsRead).not.toHaveBeenCalled();
      expect(mockTo).not.toHaveBeenCalled();
    });
  });

  // ──────────────────────────────────────────────────────────
  describe('sendToUser', () => {
    it('should emit event to the socket of a connected user', async () => {
      const client = createMockSocket({ id: 'socket-xyz', authToken: 'tok' });
      mockJwtService.verify.mockReturnValue({ sub: 'user-5' });
      mockPrismaService.conversation.findMany.mockResolvedValue([]);
      await gateway.handleConnection(client);

      gateway.sendToUser('user-5', 'ping', { payload: 42 });

      expect(mockTo).toHaveBeenCalledWith('socket-xyz');
      expect(mockEmit).toHaveBeenCalledWith('ping', { payload: 42 });
    });

    it('should do nothing when user is not in the connected sockets map', () => {
      gateway.sendToUser('offline-user', 'ping', {});

      expect(mockTo).not.toHaveBeenCalled();
    });
  });
});
