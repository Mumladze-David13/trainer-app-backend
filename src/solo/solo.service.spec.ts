import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { SoloService } from './solo.service';
import { PrismaService } from '../prisma/prisma.service';
import { AiGateway } from '../ai/ai.gateway';

describe('SoloService', () => {
  let service: SoloService;

  const mockPrisma = {
    user: { findUnique: jest.fn() },
    soloProfile: { upsert: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    trainerClient: { upsert: jest.fn(), findUnique: jest.fn() },
    clientSettings: { upsert: jest.fn() },
    trainerSettings: { upsert: jest.fn() },
    aiUsageLog: { aggregate: jest.fn(), create: jest.fn() },
    globalExercise: { findMany: jest.fn() },
    trainerExercise: { findUnique: jest.fn(), create: jest.fn() },
    season: { count: jest.fn(), create: jest.fn(), findMany: jest.fn(), findUnique: jest.fn() },
    workout: { create: jest.fn() },
  };

  const mockGateway = { complete: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SoloService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AiGateway, useValue: mockGateway },
      ],
    }).compile();

    service = module.get<SoloService>(SoloService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createProfile', () => {
    const dto = { goal: 'maintain', level: 'beginner', daysPerWeek: 3, equipment: 'gym' };

    it('throws ForbiddenException when user role is not SOLO', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1', role: Role.CLIENT });

      await expect(service.createProfile('u1', dto as any)).rejects.toThrow(ForbiddenException);
      expect(mockPrisma.soloProfile.upsert).not.toHaveBeenCalled();
    });

    it('upserts the profile and bootstraps self trainer/client relations', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1', role: Role.SOLO });
      mockPrisma.soloProfile.upsert.mockResolvedValue({ userId: 'u1', ...dto });

      const result = await service.createProfile('u1', dto as any);

      expect(mockPrisma.soloProfile.upsert).toHaveBeenCalledWith({
        where: { userId: 'u1' },
        create: { userId: 'u1', ...dto },
        update: { ...dto },
      });
      expect(mockPrisma.trainerClient.upsert).toHaveBeenCalledWith({
        where: { trainerId_clientId: { trainerId: 'u1', clientId: 'u1' } },
        create: { trainerId: 'u1', clientId: 'u1' },
        update: {},
      });
      expect(mockPrisma.clientSettings.upsert).toHaveBeenCalledWith({
        where: { clientId: 'u1' },
        create: { clientId: 'u1', trainerId: 'u1' },
        update: { trainerId: 'u1' },
      });
      expect(mockPrisma.trainerSettings.upsert).toHaveBeenCalled();
      expect(result).toEqual({ userId: 'u1', ...dto });
    });
  });

  describe('agreeToTerms', () => {
    it('throws NotFoundException when profile does not exist', async () => {
      mockPrisma.soloProfile.findUnique.mockResolvedValue(null);

      await expect(service.agreeToTerms('u1')).rejects.toThrow(NotFoundException);
      expect(mockPrisma.soloProfile.update).not.toHaveBeenCalled();
    });

    it('sets agreedToTermsAt when profile exists', async () => {
      mockPrisma.soloProfile.findUnique.mockResolvedValue({ userId: 'u1' });
      mockPrisma.soloProfile.update.mockResolvedValue({ userId: 'u1', agreedToTermsAt: new Date() });

      await service.agreeToTerms('u1');

      expect(mockPrisma.soloProfile.update).toHaveBeenCalledWith({
        where: { userId: 'u1' },
        data: { agreedToTermsAt: expect.any(Date) },
      });
    });
  });

  describe('generateInitialProgram', () => {
    it('throws NotFoundException when profile is missing', async () => {
      mockPrisma.soloProfile.findUnique.mockResolvedValue(null);

      await expect(service.generateInitialProgram('u1')).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when terms not agreed', async () => {
      mockPrisma.soloProfile.findUnique.mockResolvedValue({
        userId: 'u1',
        agreedToTermsAt: null,
      });

      await expect(service.generateInitialProgram('u1')).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when monthly token limit is exhausted', async () => {
      mockPrisma.soloProfile.findUnique.mockResolvedValue({
        userId: 'u1',
        agreedToTermsAt: new Date(),
        equipment: 'gym',
        goal: 'maintain',
        level: 'beginner',
        daysPerWeek: 3,
        notes: null,
      });
      mockPrisma.trainerSettings.upsert.mockResolvedValue({ trainerId: 'u1', plan: 'FREE' });
      mockPrisma.aiUsageLog.aggregate.mockResolvedValue({ _sum: { totalTokens: 999_999_999 } });

      await expect(service.generateInitialProgram('u1')).rejects.toThrow(ForbiddenException);
      expect(mockGateway.complete).not.toHaveBeenCalled();
    });

    it('creates a season with materialized TrainerExercise rows from the AI response', async () => {
      mockPrisma.soloProfile.findUnique.mockResolvedValue({
        userId: 'u1',
        agreedToTermsAt: new Date(),
        equipment: 'bodyweight',
        goal: 'maintain',
        level: 'beginner',
        daysPerWeek: 2,
        notes: null,
      });
      mockPrisma.trainerSettings.upsert.mockResolvedValue({ trainerId: 'u1', plan: 'FREE' });
      mockPrisma.aiUsageLog.aggregate.mockResolvedValue({ _sum: { totalTokens: 0 } });
      mockPrisma.globalExercise.findMany.mockResolvedValue([
        { id: 'g1', name: 'Push Up', nameRus: 'Отжимания', equipment: 'собственный вес' },
      ]);
      mockGateway.complete.mockResolvedValue({
        text: JSON.stringify({
          workouts: [
            {
              dayNumber: 1,
              notes: 'День 1',
              exercises: [{ globalExerciseId: 'g1', sets: 3, reps: 10, weight: null, order: 0 }],
            },
          ],
          recommendations: 'Пей воду',
        }),
        usage: { inputTokens: 100, outputTokens: 50 },
      });
      mockPrisma.trainerExercise.findUnique.mockResolvedValue(null);
      mockPrisma.trainerExercise.create.mockResolvedValue({ id: 'te1' });
      mockPrisma.trainerClient.findUnique.mockResolvedValue({ id: 'rel1' });
      mockPrisma.season.count.mockResolvedValue(0);
      mockPrisma.season.create.mockResolvedValue({ id: 'season1', name: 'AI Программа 1' });
      mockPrisma.workout.create.mockResolvedValue({ id: 'w1' });
      mockPrisma.soloProfile.update.mockResolvedValue({});

      const result = await service.generateInitialProgram('u1');

      expect(mockPrisma.trainerExercise.create).toHaveBeenCalledWith({
        data: {
          name: 'Push Up',
          trainerId: 'u1',
          equipment: 'собственный вес',
          globalExerciseId: 'g1',
        },
      });
      expect(mockPrisma.workout.create).toHaveBeenCalledTimes(1);
      expect(mockPrisma.soloProfile.update).toHaveBeenCalledWith({
        where: { userId: 'u1' },
        data: { currentSeasonId: 'season1' },
      });
      expect(result.workoutsCreated).toBe(1);
      expect(result.recommendations).toBe('Пей воду');
    });

    it('throws BadRequestException when AI returns unparseable JSON', async () => {
      mockPrisma.soloProfile.findUnique.mockResolvedValue({
        userId: 'u1',
        agreedToTermsAt: new Date(),
        equipment: 'gym',
        goal: 'maintain',
        level: 'beginner',
        daysPerWeek: 3,
        notes: null,
      });
      mockPrisma.trainerSettings.upsert.mockResolvedValue({ trainerId: 'u1', plan: 'FREE' });
      mockPrisma.aiUsageLog.aggregate.mockResolvedValue({ _sum: { totalTokens: 0 } });
      mockPrisma.globalExercise.findMany.mockResolvedValue([{ id: 'g1', name: 'Push Up', equipment: null }]);
      mockGateway.complete.mockResolvedValue({ text: 'not json', usage: { inputTokens: 1, outputTokens: 1 } });

      await expect(service.generateInitialProgram('u1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('getCurrentSeason', () => {
    it('returns null when profile has no currentSeasonId', async () => {
      mockPrisma.soloProfile.findUnique.mockResolvedValue({ userId: 'u1', currentSeasonId: null });

      const result = await service.getCurrentSeason('u1');

      expect(result).toBeNull();
      expect(mockPrisma.season.findUnique).not.toHaveBeenCalled();
    });
  });
});
