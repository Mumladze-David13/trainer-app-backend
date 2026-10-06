import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { SoloService } from './solo.service';
import { PrismaService } from '../prisma/prisma.service';
import { AiGateway } from '../ai/ai.gateway';
import { AnonymizerService } from '../ai/anonymizer.service';

describe('SoloService', () => {
  beforeAll(() => {
    process.env.AI_TOKEN_LIMITS_ENABLED = 'true';
  });
  afterAll(() => {
    delete process.env.AI_TOKEN_LIMITS_ENABLED;
  });

  let service: SoloService;

  const mockPrisma = {
    user: { findUnique: jest.fn() },
    soloProfile: { upsert: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    trainerClient: { upsert: jest.fn(), findUnique: jest.fn() },
    clientSettings: { upsert: jest.fn() },
    trainerSettings: { upsert: jest.fn(), findUnique: jest.fn() },
    aiUsageLog: { aggregate: jest.fn(), create: jest.fn() },
    globalExercise: { findMany: jest.fn() },
    trainerExercise: { findUnique: jest.fn(), create: jest.fn() },
    season: { count: jest.fn(), create: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(), findFirst: jest.fn() },
    workout: { create: jest.fn(), count: jest.fn(), findMany: jest.fn(), findFirst: jest.fn() },
    nutritionProfile: { findUnique: jest.fn() },
    weightLog: { findFirst: jest.fn() },
  };

  const mockGateway = { completeJson: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SoloService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AiGateway, useValue: mockGateway },
        AnonymizerService,
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
    const profile = {
      userId: 'u1',
      agreedToTermsAt: new Date(),
      equipment: 'bodyweight',
      goal: 'maintain',
      level: 'beginner',
      daysPerWeek: 2,
      notes: null,
      currentSeasonId: null,
    };
    const day = (n: number) => ({
      dayNumber: n,
      notes: `День ${n}`,
      exercises: [{ exercise: 1, sets: 3, reps: 10, weight: null, order: 0 }],
    });
    const aiReply = (workouts: unknown[]) => ({
      text: JSON.stringify({ workouts, recommendations: 'Пей воду' }),
      usage: { inputTokens: 100, outputTokens: 50 },
    });

    beforeEach(() => {
      mockPrisma.soloProfile.findUnique.mockResolvedValue(profile);
      mockPrisma.trainerSettings.upsert.mockResolvedValue({ trainerId: 'u1', plan: 'FREE' });
      mockPrisma.trainerSettings.findUnique.mockResolvedValue({ sessionsPerSeason: 30 });
      mockPrisma.aiUsageLog.aggregate.mockResolvedValue({ _sum: { totalTokens: 0 } });
      mockPrisma.globalExercise.findMany.mockResolvedValue([
        { id: 'g1', name: 'Push Up', nameRus: 'Отжимания', equipment: 'собственный вес', primaryMuscles: ['chest'] },
      ]);
      mockPrisma.trainerClient.findUnique.mockResolvedValue({ id: 'rel1' });
      mockPrisma.workout.findMany.mockResolvedValue([]);
      mockPrisma.workout.findFirst.mockResolvedValue(null);
      mockPrisma.workout.count.mockResolvedValue(0);
      mockPrisma.workout.create.mockResolvedValue({ id: 'w1' });
      mockPrisma.nutritionProfile.findUnique.mockResolvedValue(null);
      mockPrisma.weightLog.findFirst.mockResolvedValue(null);
      mockPrisma.trainerExercise.findUnique.mockResolvedValue(null);
      mockPrisma.trainerExercise.create.mockResolvedValue({ id: 'te1' });
      mockPrisma.season.findFirst.mockResolvedValue(null);
      mockPrisma.season.count.mockResolvedValue(0);
      mockPrisma.season.create.mockResolvedValue({ id: 'season1', name: 'Сезон 1' });
      mockPrisma.season.findUnique.mockImplementation(({ where }) => Promise.resolve({ id: where.id }));
      mockPrisma.soloProfile.update.mockResolvedValue({});
      mockGateway.completeJson.mockResolvedValue(aiReply([day(1), day(2)]));
    });

    it('throws NotFoundException when profile is missing', async () => {
      mockPrisma.soloProfile.findUnique.mockResolvedValue(null);

      await expect(service.generateInitialProgram('u1')).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when terms not agreed', async () => {
      mockPrisma.soloProfile.findUnique.mockResolvedValue({ ...profile, agreedToTermsAt: null });

      await expect(service.generateInitialProgram('u1')).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when monthly token limit is exhausted', async () => {
      mockPrisma.aiUsageLog.aggregate.mockResolvedValue({ _sum: { totalTokens: 999_999_999 } });

      await expect(service.generateInitialProgram('u1')).rejects.toThrow(ForbiddenException);
      expect(mockGateway.completeJson).not.toHaveBeenCalled();
    });

    it('loads all strength exercises for the chosen equipment without a random cap', async () => {
      await service.generateInitialProgram('u1');

      const args = mockPrisma.globalExercise.findMany.mock.calls[0][0];
      expect(args.where).toEqual({ category: 'силовые', equipment: { in: ['собственный вес'] } });
      expect(args.take).toBeUndefined();
      expect(args.orderBy).toEqual({ name: 'asc' });
    });

    it('creates a new season with materialized TrainerExercise rows when there is no active season', async () => {
      const result = await service.generateInitialProgram('u1');

      expect(mockPrisma.trainerExercise.create).toHaveBeenCalledWith({
        data: {
          name: 'Отжимания',
          trainerId: 'u1',
          equipment: 'собственный вес',
          globalExerciseId: 'g1',
        },
      });
      expect(mockPrisma.season.create).toHaveBeenCalledTimes(1);
      expect(mockPrisma.workout.create).toHaveBeenCalledTimes(2);
      expect(mockPrisma.soloProfile.update).toHaveBeenCalledWith({
        where: { userId: 'u1' },
        data: { currentSeasonId: 'season1' },
      });
      expect(result.workoutsCreated).toBe(2);
      expect(result.recommendations).toBe('Пей воду');
    });

    it('adds workouts to the current season after its last planned workout', async () => {
      mockPrisma.soloProfile.findUnique.mockResolvedValue({ ...profile, currentSeasonId: 'cur' });
      mockPrisma.season.findFirst.mockResolvedValue({ id: 'cur', trainerClientId: 'rel1', endDate: null });
      mockPrisma.workout.count.mockResolvedValue(4);
      const lastPlanned = new Date();
      lastPlanned.setDate(lastPlanned.getDate() + 10);
      mockPrisma.workout.findFirst.mockResolvedValue({ date: lastPlanned });

      const result = await service.generateInitialProgram('u1');

      expect(mockPrisma.season.create).not.toHaveBeenCalled();
      const created = mockPrisma.workout.create.mock.calls.map(([a]) => a.data);
      expect(created.every((d) => d.seasonId === 'cur')).toBe(true);
      expect(created[0].date.getTime()).toBeGreaterThan(lastPlanned.getTime());
      expect(mockPrisma.soloProfile.update).not.toHaveBeenCalled();
      expect(result.season).toEqual({ id: 'cur' });
      expect(result.newSeason).toBeNull();
    });

    it('splits the program between the full current season and a new one', async () => {
      mockPrisma.soloProfile.findUnique.mockResolvedValue({ ...profile, currentSeasonId: 'cur' });
      mockPrisma.season.findFirst.mockResolvedValue({ id: 'cur', trainerClientId: 'rel1', endDate: null });
      mockPrisma.workout.count.mockResolvedValue(29);
      mockPrisma.season.count.mockResolvedValue(1);
      mockPrisma.season.create.mockResolvedValue({ id: 'new', name: 'Сезон 2' });

      const result = await service.generateInitialProgram('u1');

      const seasons = mockPrisma.workout.create.mock.calls.map(([a]) => a.data.seasonId);
      expect(seasons).toEqual(['cur', 'new']);
      expect(mockPrisma.season.create.mock.calls[0][0].data.name).toBe('Сезон 2');
      expect(mockPrisma.soloProfile.update).toHaveBeenCalledWith({
        where: { userId: 'u1' },
        data: { currentSeasonId: 'new' },
      });
      expect(result.newSeason).toEqual({ id: 'new', name: 'Сезон 2' });
    });

    it('generates the requested number of workouts', async () => {
      mockGateway.completeJson.mockResolvedValue(aiReply([day(1), day(2), day(3)]));

      const result = await service.generateInitialProgram('u1', { workoutsCount: 1 });

      const [, userMessage] = mockGateway.completeJson.mock.calls[0];
      expect(userMessage).toContain('Создай ровно 1 тренировку');
      expect(result.workoutsCreated).toBe(1);
    });

    it('tells the AI there is no history for a new user', async () => {
      await service.generateInitialProgram('u1');

      const [, userMessage] = mockGateway.completeJson.mock.calls[0];
      expect(userMessage).toContain('это первая программа');
      expect(userMessage).toContain('#1 Отжимания [грудь]');
    });

    it('throws BadRequestException when AI returns unparseable JSON', async () => {
      mockGateway.completeJson.mockResolvedValue({ text: 'not json', usage: { inputTokens: 1, outputTokens: 1 } });

      await expect(service.generateInitialProgram('u1')).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException and creates nothing when no exercise is recognized', async () => {
      mockGateway.completeJson.mockResolvedValue(aiReply([{ exercises: [{ exercise: 77 }] }]));

      await expect(service.generateInitialProgram('u1')).rejects.toThrow(BadRequestException);
      expect(mockPrisma.season.create).not.toHaveBeenCalled();
      expect(mockPrisma.workout.create).not.toHaveBeenCalled();
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
