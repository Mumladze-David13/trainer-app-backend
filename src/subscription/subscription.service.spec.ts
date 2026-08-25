import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { SubscriptionService } from './subscription.service';
import { PrismaService } from '../prisma/prisma.service';

describe('SubscriptionService', () => {
  let service: SubscriptionService;

  const mockPrisma = {
    subscriptionTariff: {
      findUnique: jest.fn(),
      create: jest.fn(),
      upsert: jest.fn(),
      findMany: jest.fn(),
    },
    subscriptionPayment: {
      findFirst: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SubscriptionService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get<SubscriptionService>(SubscriptionService);
    jest.clearAllMocks();
  });

  describe('getPriceForUser', () => {
    it('charges half price, rounded, when the user has no succeeded payment', async () => {
      mockPrisma.subscriptionTariff.findUnique.mockResolvedValue({ role: 'SOLO', priceRub: 201 });
      mockPrisma.subscriptionPayment.findFirst.mockResolvedValue(null);

      const result = await service.getPriceForUser('user-1', 'SOLO');

      expect(result).toEqual({
        role: 'SOLO',
        fullPriceRub: 201,
        isFirstMonth: true,
        chargedRub: 101, // Math.round(201 / 2)
      });
      expect(mockPrisma.subscriptionPayment.findFirst).toHaveBeenCalledWith({
        where: { userId: 'user-1', status: 'succeeded' },
      });
    });

    it('charges full price when the user already has a succeeded payment', async () => {
      mockPrisma.subscriptionTariff.findUnique.mockResolvedValue({ role: 'TRAINER', priceRub: 2000 });
      mockPrisma.subscriptionPayment.findFirst.mockResolvedValue({ id: 'payment-1', status: 'succeeded' });

      const result = await service.getPriceForUser('user-2', 'TRAINER');

      expect(result).toEqual({
        role: 'TRAINER',
        fullPriceRub: 2000,
        isFirstMonth: false,
        chargedRub: 2000,
      });
    });

    it('creates the tariff with the default price when none exists yet', async () => {
      mockPrisma.subscriptionTariff.findUnique.mockResolvedValue(null);
      mockPrisma.subscriptionTariff.create.mockResolvedValue({ role: 'CLIENT', priceRub: 200 });
      mockPrisma.subscriptionPayment.findFirst.mockResolvedValue(null);

      const result = await service.getPriceForUser('user-3', 'CLIENT');

      expect(mockPrisma.subscriptionTariff.create).toHaveBeenCalledWith({
        data: { role: 'CLIENT', priceRub: 200 },
      });
      expect(result.fullPriceRub).toBe(200);
      expect(result.chargedRub).toBe(100);
    });

    it('rejects an unknown role', async () => {
      await expect(service.getPriceForUser('user-4', 'ADMIN')).rejects.toThrow(BadRequestException);
    });
  });

  describe('updateTariff', () => {
    it('upserts the price for a valid role', async () => {
      mockPrisma.subscriptionTariff.upsert.mockResolvedValue({ role: 'TRAINER', priceRub: 300 });

      const result = await service.updateTariff('TRAINER', 300);

      expect(mockPrisma.subscriptionTariff.upsert).toHaveBeenCalledWith({
        where: { role: 'TRAINER' },
        create: { role: 'TRAINER', priceRub: 300 },
        update: { priceRub: 300 },
      });
      expect(result).toEqual({ role: 'TRAINER', priceRub: 300 });
    });

    it('rejects an unknown role', async () => {
      await expect(service.updateTariff('ADMIN', 300)).rejects.toThrow(BadRequestException);
      expect(mockPrisma.subscriptionTariff.upsert).not.toHaveBeenCalled();
    });
  });
});
