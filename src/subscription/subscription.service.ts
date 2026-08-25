// src/subscription/subscription.service.ts
import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export const SUBSCRIPTION_ROLES = ['SOLO', 'CLIENT', 'TRAINER', 'TRAINER_CLIENT'] as const;
export type SubscriptionRole = (typeof SUBSCRIPTION_ROLES)[number];

const DEFAULT_PRICES_RUB: Record<SubscriptionRole, number> = {
  SOLO: 250,
  CLIENT: 200,
  TRAINER: 2000,
  TRAINER_CLIENT: 2000,
};

@Injectable()
export class SubscriptionService {
  constructor(private readonly prisma: PrismaService) {}

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
