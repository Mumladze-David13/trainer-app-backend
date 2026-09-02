// src/subscription/subscription.service.ts
import { BadGatewayException, BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { SubscriptionPaymentPlatform } from './dto/create-payment.dto';

export const SUBSCRIPTION_ROLES = ['SOLO', 'CLIENT', 'TRAINER', 'TRAINER_CLIENT'] as const;
export type SubscriptionRole = (typeof SUBSCRIPTION_ROLES)[number];

const DEFAULT_PRICES_RUB: Record<SubscriptionRole, number> = {
  SOLO: 250,
  CLIENT: 200,
  TRAINER: 2000,
  TRAINER_CLIENT: 2000,
};

const YOOKASSA_API_URL = 'https://api.yookassa.ru/v3';

@Injectable()
export class SubscriptionService {
  private readonly logger = new Logger(SubscriptionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async getPriceForUser(userId: string, role: string) {
    const tariff = await this.getOrCreateTariff(role);

    const previousSuccessfulPayment = await this.prisma.subscriptionPayment.findFirst({
      where: { userId, status: 'succeeded' },
    });
    const isFirstMonth = !previousSuccessfulPayment;
    const chargedRub = isFirstMonth ? Math.round(tariff.priceRub / 2) : tariff.priceRub;

    return {
      role: tariff.role,
      fullPriceRub: tariff.priceRub,
      isFirstMonth,
      chargedRub,
    };
  }

  async listTariffs() {
    await Promise.all(SUBSCRIPTION_ROLES.map((role) => this.getOrCreateTariff(role)));
    return this.prisma.subscriptionTariff.findMany({ orderBy: { role: 'asc' } });
  }

  async updateTariff(role: string, priceRub: number) {
    this.assertValidRole(role);

    return this.prisma.subscriptionTariff.upsert({
      where: { role },
      create: { role, priceRub },
      update: { priceRub },
    });
  }

  async createPayment(userId: string, role: string, platform: SubscriptionPaymentPlatform) {
    const { fullPriceRub, chargedRub, isFirstMonth } = await this.getPriceForUser(userId, role);

    const payment = await this.prisma.subscriptionPayment.create({
      data: { userId, role, fullPriceRub, chargedRub, isFirstMonth, status: 'pending' },
    });

    const returnUrl =
      platform === 'mobile'
        ? this.config.get<string>('YOOKASSA_RETURN_URL_MOBILE')
        : this.config.get<string>('YOOKASSA_RETURN_URL_WEB');

    let confirmationUrl: string;
    let yookassaPaymentId: string;
    try {
      const response = await axios.post(
        `${YOOKASSA_API_URL}/payments`,
        {
          amount: { value: `${chargedRub}.00`, currency: 'RUB' },
          capture: true,
          confirmation: { type: 'redirect', return_url: returnUrl },
          description: `Подписка ${role}`,
          metadata: { subscriptionPaymentId: payment.id },
        },
        {
          headers: {
            'Idempotence-Key': randomUUID(),
            Authorization: this.yookassaAuthHeader(),
            'Content-Type': 'application/json',
          },
        },
      );
      yookassaPaymentId = response.data.id;
      confirmationUrl = response.data.confirmation?.confirmation_url;
    } catch (error) {
      this.logger.error('Failed to create YooKassa payment', error instanceof Error ? error.stack : error);
      await this.prisma.subscriptionPayment.update({
        where: { id: payment.id },
        data: { status: 'failed' },
      });
      throw new BadGatewayException('Не удалось создать платёж в ЮKassa');
    }

    await this.prisma.subscriptionPayment.update({
      where: { id: payment.id },
      data: { yookassaPaymentId },
    });

    return { paymentId: payment.id, confirmationUrl };
  }

  async getPaymentStatus(paymentId: string, userId: string) {
    const payment = await this.prisma.subscriptionPayment.findUnique({ where: { id: paymentId } });
    if (!payment || payment.userId !== userId) {
      throw new NotFoundException('Payment not found');
    }
    return { status: payment.status };
  }

  async handleYookassaWebhook(body: { event?: string; object?: { id?: string } }) {
    const yookassaPaymentId = body?.object?.id;
    if (!yookassaPaymentId) return;

    const payment = await this.prisma.subscriptionPayment.findUnique({
      where: { yookassaPaymentId },
    });
    if (!payment) return;

    // Не доверяем статусу из тела уведомления — перезапрашиваем у ЮKassa напрямую.
    const response = await axios.get(`${YOOKASSA_API_URL}/payments/${yookassaPaymentId}`, {
      headers: { Authorization: this.yookassaAuthHeader() },
    });
    const realStatus: string = response.data.status;

    const mappedStatus = realStatus === 'succeeded' ? 'succeeded' : realStatus === 'canceled' ? 'canceled' : null;
    if (!mappedStatus || mappedStatus === payment.status) return;

    await this.prisma.subscriptionPayment.update({
      where: { id: payment.id },
      data: { status: mappedStatus },
    });
  }

  private yookassaAuthHeader(): string {
    const shopId = this.config.get<string>('YOOKASSA_SHOP_ID');
    const secretKey = this.config.get<string>('YOOKASSA_SECRET_KEY');
    return `Basic ${Buffer.from(`${shopId}:${secretKey}`).toString('base64')}`;
  }

  private async getOrCreateTariff(role: string) {
    this.assertValidRole(role);

    const existing = await this.prisma.subscriptionTariff.findUnique({ where: { role } });
    if (existing) return existing;

    return this.prisma.subscriptionTariff.create({
      data: { role, priceRub: DEFAULT_PRICES_RUB[role as SubscriptionRole] },
    });
  }

  private assertValidRole(role: string): asserts role is SubscriptionRole {
    if (!SUBSCRIPTION_ROLES.includes(role as SubscriptionRole)) {
      throw new BadRequestException(`Unknown role: ${role}`);
    }
  }
}
