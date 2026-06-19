import { Injectable, OnModuleInit } from '@nestjs/common';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationsService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    if (!getApps().length) {
      initializeApp({
        credential: cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        }),
      });
    }
  }

  async saveFcmToken(userId: string, token: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { fcmToken: token },
    });
  }

  async notifyWorkoutCreated(clientId: string, trainerName: string) {
    const client = await this.prisma.user.findUnique({
      where: { id: clientId },
      select: { fcmToken: true },
    });
    if (!client?.fcmToken) return;
    await this.sendPush(client.fcmToken, {
      title: 'Новое занятие',
      body: `Тренер ${trainerName} добавил вам новое занятие`,
      data: { type: 'NEW_WORKOUT' },
    });
  }

  async notifyNewMessage(
    recipientId: string,
    senderName: string,
    text: string,
    conversationId: string,
  ) {
    const recipient = await this.prisma.user.findUnique({
      where: { id: recipientId },
      select: { fcmToken: true },
    });
    if (!recipient?.fcmToken) return;
    await this.sendPush(recipient.fcmToken, {
      title: senderName,
      body: text.length > 100 ? text.substring(0, 100) + '...' : text,
      data: { type: 'NEW_MESSAGE', conversationId },
    });
  }

  private async sendPush(
    token: string,
    payload: { title: string; body: string; data?: Record<string, string> },
  ) {
    try {
      await getMessaging().send({
        token,
        notification: { title: payload.title, body: payload.body },
        data: payload.data ?? {},
        android: {
          priority: 'high',
          notification: { sound: 'default' },
        },
        apns: {
          payload: { aps: { sound: 'default' } },
        },
      });
    } catch (error) {
      if (
        error.code === 'messaging/invalid-registration-token' ||
        error.code === 'messaging/registration-token-not-registered'
      ) {
        await this.prisma.user.updateMany({
          where: { fcmToken: token },
          data: { fcmToken: null },
        });
      }
      console.error('Push notification error:', error.message);
    }
  }
}
