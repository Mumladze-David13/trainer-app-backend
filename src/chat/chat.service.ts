import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { GetMessagesDto } from './dto/get-messages.dto';
import { Role } from '@prisma/client';

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  private async verifyParticipant(conversationId: string, userId: string) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });
    if (!conversation) throw new NotFoundException('Conversation not found');
    if (conversation.trainerId !== userId && conversation.clientId !== userId) {
      throw new ForbiddenException();
    }
    return conversation;
  }

  async getConversations(userId: string) {
    const conversations = await this.prisma.conversation.findMany({
      where: { OR: [{ trainerId: userId }, { clientId: userId }] },
      include: {
        trainer: { select: { id: true, firstName: true, lastName: true } },
        client: { select: { id: true, firstName: true, lastName: true } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return Promise.all(
      conversations.map(async (conv) => {
        const unreadCount = await this.prisma.message.count({
          where: {
            conversationId: conv.id,
            senderId: { not: userId },
            isRead: false,
          },
        });
        return {
          id: conv.id,
          trainerId: conv.trainerId,
          clientId: conv.clientId,
          trainer: conv.trainer,
          client: conv.client,
          lastMessage: conv.messages[0] ?? null,
          unreadCount,
        };
      }),
    );
  }

  async getMessages(conversationId: string, userId: string, dto: GetMessagesDto) {
    await this.verifyParticipant(conversationId, userId);

    const limit = dto.limit ?? 30;
    const messages = await this.prisma.message.findMany({
      where: {
        conversationId,
        ...(dto.before ? { createdAt: { lt: new Date(dto.before) } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    await this.prisma.message.updateMany({
      where: { conversationId, senderId: { not: userId }, isRead: false },
      data: { isRead: true },
    });

    return messages;
  }

  async sendMessage(conversationId: string, userId: string, dto: CreateMessageDto) {
    const conversation = await this.verifyParticipant(conversationId, userId);

    const message = await this.prisma.message.create({
      data: { conversationId, senderId: userId, text: dto.text },
    });

    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    const recipientId =
      conversation.trainerId === userId ? conversation.clientId : conversation.trainerId;

    const sender = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true, lastName: true },
    });
    const senderName = sender ? `${sender.firstName} ${sender.lastName}` : '';

    await this.notificationsService.notifyNewMessage(
      recipientId,
      senderName,
      dto.text,
      conversationId,
    );

    return message;
  }

  async findOrCreateConversation(currentUserId: string, otherUserId: string) {
    // Search in both directions to avoid duplicates regardless of who initiates
    const existing = await this.prisma.conversation.findFirst({
      where: {
        OR: [
          { trainerId: currentUserId, clientId: otherUserId },
          { trainerId: otherUserId, clientId: currentUserId },
        ],
      },
    });
    if (existing) return existing;

    const [currentUser, otherUser] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: currentUserId }, select: { role: true } }),
      this.prisma.user.findUnique({ where: { id: otherUserId }, select: { role: true } }),
    ]);

    if (!currentUser || !otherUser) throw new NotFoundException('User not found');

    let trainerId: string;
    let clientId: string;

    if (currentUser.role === Role.TRAINER && otherUser.role === Role.CLIENT) {
      trainerId = currentUserId;
      clientId = otherUserId;
    } else if (currentUser.role === Role.CLIENT && otherUser.role === Role.TRAINER) {
      trainerId = otherUserId;
      clientId = currentUserId;
    } else if (
      currentUser.role === Role.TRAINER_CLIENT &&
      otherUser.role === Role.TRAINER_CLIENT
    ) {
      // Determine trainer by existing TrainerClient relation
      const link = await this.prisma.trainerClient.findFirst({
        where: {
          OR: [
            { trainerId: currentUserId, clientId: otherUserId },
            { trainerId: otherUserId, clientId: currentUserId },
          ],
        },
      });
      if (link) {
        trainerId = link.trainerId;
        clientId = link.clientId;
      } else {
        // No explicit relation — initiator becomes trainer
        trainerId = currentUserId;
        clientId = otherUserId;
      }
    } else if (
      currentUser.role === Role.TRAINER ||
      currentUser.role === Role.TRAINER_CLIENT
    ) {
      trainerId = currentUserId;
      clientId = otherUserId;
    } else {
      trainerId = otherUserId;
      clientId = currentUserId;
    }

    try {
      return await this.prisma.conversation.create({ data: { trainerId, clientId } });
    } catch (error) {
      if (error.code === 'P2002') {
        return this.prisma.conversation.findFirst({
          where: {
            OR: [
              { trainerId, clientId },
              { trainerId: clientId, clientId: trainerId },
            ],
          },
        });
      }
      throw error;
    }
  }

  async markAsRead(conversationId: string, userId: string) {
    await this.verifyParticipant(conversationId, userId);

    const result = await this.prisma.message.updateMany({
      where: { conversationId, senderId: { not: userId }, isRead: false },
      data: { isRead: true },
    });

    return { updated: result.count };
  }
}
