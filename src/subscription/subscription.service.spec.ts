import { Test, TestingModule } from '@nestjs/testing';
import { BadGatewayException, BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { SubscriptionService } from './subscription.service';
import { PrismaService } from '../prisma/prisma.service';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

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
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockConfig = {
    get: jest.fn((key: string) => {
      const values: Record<string, string> = {
        YOOKASSA_SHOP_ID: 'shop-1',
        YOOKASSA_SECRET_KEY: 'secret-1',
        YOOKASSA_RETURN_URL_MOBILE: 'trainerapp://payment-callback',
        YOOKASSA_RETURN_URL_WEB: 'https://trainer-app-2026.web.app',
      };
      return values[key];
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: mockConfig },
      ],
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

  describe('createPayment', () => {
    beforeEach(() => {
      mockPrisma.subscriptionTariff.findUnique.mockResolvedValue({ role: 'SOLO', priceRub: 250 });
      mockPrisma.subscriptionPayment.findFirst.mockResolvedValue(null); // first month
      mockPrisma.subscriptionPayment.create.mockResolvedValue({ id: 'payment-1' });
      mockPrisma.subscriptionPayment.update.mockResolvedValue({});
    });

    it('creates a pending payment, calls YooKassa and stores the returned id', async () => {
      mockedAxios.post.mockResolvedValue({
        data: { id: 'yk-123', confirmation: { confirmation_url: 'https://yookassa.ru/pay/yk-123' } },
      });

      const result = await service.createPayment('user-1', 'SOLO', 'mobile');

      expect(mockPrisma.subscriptionPayment.create).toHaveBeenCalledWith({
        data: { userId: 'user-1', role: 'SOLO', fullPriceRub: 250, chargedRub: 125, isFirstMonth: true, status: 'pending' },
      });
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://api.yookassa.ru/v3/payments',
        expect.objectContaining({
          amount: { value: '125.00', currency: 'RUB' },
          confirmation: { type: 'redirect', return_url: 'trainerapp://payment-callback' },
          metadata: { subscriptionPaymentId: 'payment-1' },
        }),
        expect.objectContaining({ headers: expect.objectContaining({ 'Idempotence-Key': expect.any(String) }) }),
      );
      expect(mockPrisma.subscriptionPayment.update).toHaveBeenCalledWith({
        where: { id: 'payment-1' },
        data: { yookassaPaymentId: 'yk-123' },
      });
      expect(result).toEqual({ paymentId: 'payment-1', confirmationUrl: 'https://yookassa.ru/pay/yk-123' });
    });

    it('uses the web return url for platform "web"', async () => {
      mockedAxios.post.mockResolvedValue({ data: { id: 'yk-1', confirmation: { confirmation_url: 'https://x' } } });

      await service.createPayment('user-1', 'SOLO', 'web');

      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ confirmation: { type: 'redirect', return_url: 'https://trainer-app-2026.web.app' } }),
        expect.anything(),
      );
    });

    it('marks the payment failed and throws 502 when YooKassa call fails', async () => {
      mockedAxios.post.mockRejectedValue(new Error('network error'));

      await expect(service.createPayment('user-1', 'SOLO', 'mobile')).rejects.toThrow(BadGatewayException);

      expect(mockPrisma.subscriptionPayment.update).toHaveBeenCalledWith({
        where: { id: 'payment-1' },
        data: { status: 'failed' },
      });
    });
  });

  describe('getPaymentStatus', () => {
    it('returns the status when the payment belongs to the user', async () => {
      mockPrisma.subscriptionPayment.findUnique.mockResolvedValue({ id: 'p1', userId: 'user-1', status: 'pending' });

      const result = await service.getPaymentStatus('p1', 'user-1');

      expect(result).toEqual({ status: 'pending' });
    });

    it('throws 404 when the payment does not exist', async () => {
      mockPrisma.subscriptionPayment.findUnique.mockResolvedValue(null);

      await expect(service.getPaymentStatus('missing', 'user-1')).rejects.toThrow(NotFoundException);
    });

    it('throws 404 when the payment belongs to a different user', async () => {
      mockPrisma.subscriptionPayment.findUnique.mockResolvedValue({ id: 'p1', userId: 'other-user', status: 'pending' });

      await expect(service.getPaymentStatus('p1', 'user-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('handleYookassaWebhook', () => {
    it('does nothing when the notification has no object id', async () => {
      await service.handleYookassaWebhook({ event: 'payment.succeeded' });

      expect(mockPrisma.subscriptionPayment.findUnique).not.toHaveBeenCalled();
      expect(mockedAxios.get).not.toHaveBeenCalled();
    });

    it('does nothing (still 200) when no matching payment is found', async () => {
      mockPrisma.subscriptionPayment.findUnique.mockResolvedValue(null);

      await service.handleYookassaWebhook({ object: { id: 'yk-404' } });

      expect(mockedAxios.get).not.toHaveBeenCalled();
      expect(mockPrisma.subscriptionPayment.update).not.toHaveBeenCalled();
    });

    it('re-fetches the real status from YooKassa and updates succeeded payments', async () => {
      mockPrisma.subscriptionPayment.findUnique.mockResolvedValue({ id: 'p1', status: 'pending', yookassaPaymentId: 'yk-1' });
      mockedAxios.get.mockResolvedValue({ data: { status: 'succeeded' } });

      await service.handleYookassaWebhook({ object: { id: 'yk-1' } });

      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://api.yookassa.ru/v3/payments/yk-1',
        expect.objectContaining({ headers: expect.objectContaining({ Authorization: expect.any(String) }) }),
      );
      expect(mockPrisma.subscriptionPayment.update).toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: { status: 'succeeded' },
      });
    });

    it('maps canceled status', async () => {
      mockPrisma.subscriptionPayment.findUnique.mockResolvedValue({ id: 'p1', status: 'pending', yookassaPaymentId: 'yk-1' });
      mockedAxios.get.mockResolvedValue({ data: { status: 'canceled' } });

      await service.handleYookassaWebhook({ object: { id: 'yk-1' } });

      expect(mockPrisma.subscriptionPayment.update).toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: { status: 'canceled' },
      });
    });

    it('does not change status for a still-pending real status', async () => {
      mockPrisma.subscriptionPayment.findUnique.mockResolvedValue({ id: 'p1', status: 'pending', yookassaPaymentId: 'yk-1' });
      mockedAxios.get.mockResolvedValue({ data: { status: 'pending' } });

      await service.handleYookassaWebhook({ object: { id: 'yk-1' } });

      expect(mockPrisma.subscriptionPayment.update).not.toHaveBeenCalled();
    });

    it('is idempotent — a repeated succeeded notification does not update again', async () => {
      mockPrisma.subscriptionPayment.findUnique.mockResolvedValue({ id: 'p1', status: 'succeeded', yookassaPaymentId: 'yk-1' });
      mockedAxios.get.mockResolvedValue({ data: { status: 'succeeded' } });

      await service.handleYookassaWebhook({ object: { id: 'yk-1' } });

      expect(mockPrisma.subscriptionPayment.update).not.toHaveBeenCalled();
    });
  });
});
