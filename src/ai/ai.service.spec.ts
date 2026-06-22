import { Test, TestingModule } from '@nestjs/testing';
import { AiService } from './ai.service';
import { PrismaService } from '../prisma/prisma.service';
import { AiGateway } from './ai.gateway';
import { AnonymizerService } from './anonymizer.service';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

describe('AiService', () => {
  let service: AiService;

  const mockPrismaService = {
    trainerSettings: { upsert: jest.fn() },
    aiUsageLog: {
      aggregate: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
    },
    exercise: { findMany: jest.fn() },
    trainerClient: { findFirst: jest.fn() },
    season: { findFirst: jest.fn() },
    workout: { create: jest.fn() },
  };

  const mockAiGateway = { complete: jest.fn() };

  const mockAnonymizerService = {
    anonymizeClient: jest.fn(),
    anonymizeWorkoutHistory: jest.fn(),
  };

  const TRAINER_ID = 'trainer-1';

  const makeSettings = (plan = 'FREE') => ({
    id: 'settings-1',
    trainerId: TRAINER_ID,
    sessionsPerSeason: 30,
    plan,
  });

  const makeAiResponse = (text: string, inputTokens = 1000, outputTokens = 500) => ({
    text,
    usage: { inputTokens, outputTokens },
  });

  const validAiJson = JSON.stringify({
    workouts: [{ dayNumber: 1, notes: 'День 1', exercises: [] }],
    recommendations: 'Следите за техникой',
  });

  const trainerClient = {
    client: { id: 'client-1', firstName: 'Иван', lastName: 'Петров', email: 'ivan@example.com' },
    seasons: [
      {
        workouts: [
          {
            date: new Date('2026-06-01'),
            isCompleted: true,
            workoutExercises: [
              { exercise: { name: 'Приседания' }, sets: 3, reps: 10, weight: 100, setWeights: null },
            ],
          },
        ],
      },
    ],
  };

  const generateDto = {
    clientId: 'client-1',
    goal: 'gain_muscle',
    level: 'intermediate',
    daysPerWeek: 3,
    equipment: 'тренажёрный зал',
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AiGateway, useValue: mockAiGateway },
        { provide: AnonymizerService, useValue: mockAnonymizerService },
      ],
    }).compile();

    service = module.get<AiService>(AiService);

    // Дефолтные моки для generateProgram
    mockPrismaService.trainerSettings.upsert.mockResolvedValue(makeSettings('FREE'));
    mockPrismaService.aiUsageLog.aggregate.mockResolvedValue({ _sum: { totalTokens: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 }, _count: { id: 0 } });
    mockPrismaService.aiUsageLog.create.mockResolvedValue({});
    mockPrismaService.aiUsageLog.findMany.mockResolvedValue([]);
    mockPrismaService.exercise.findMany.mockResolvedValue([{ id: 'ex-1', name: 'Приседания' }]);
    mockPrismaService.trainerClient.findFirst.mockResolvedValue(trainerClient);
    mockAnonymizerService.anonymizeClient.mockReturnValue({ clientHash: 'CLIENT_abc12345' });
    mockAnonymizerService.anonymizeWorkoutHistory.mockReturnValue([]);
    mockAiGateway.complete.mockResolvedValue(makeAiResponse(validAiJson));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ─── generateProgram: лимиты ─────────────────────────────────────────────

  describe('generateProgram — token limit enforcement', () => {
    it('throws ForbiddenException when FREE limit (50 000) is exhausted', async () => {
      mockPrismaService.trainerSettings.upsert.mockResolvedValue(makeSettings('FREE'));
      mockPrismaService.aiUsageLog.aggregate.mockResolvedValue({ _sum: { totalTokens: 50_000 } });

      await expect(service.generateProgram(generateDto, TRAINER_ID)).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when BASIC limit (300 000) is exhausted', async () => {
      mockPrismaService.trainerSettings.upsert.mockResolvedValue(makeSettings('BASIC'));
      mockPrismaService.aiUsageLog.aggregate.mockResolvedValue({ _sum: { totalTokens: 300_000 } });

      await expect(service.generateProgram(generateDto, TRAINER_ID)).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when PRO limit (1 000 000) is exhausted', async () => {
      mockPrismaService.trainerSettings.upsert.mockResolvedValue(makeSettings('PRO'));
      mockPrismaService.aiUsageLog.aggregate.mockResolvedValue({ _sum: { totalTokens: 1_000_000 } });

      await expect(service.generateProgram(generateDto, TRAINER_ID)).rejects.toThrow(ForbiddenException);
    });

    it('includes plan name and limit in the ForbiddenException message', async () => {
      mockPrismaService.trainerSettings.upsert.mockResolvedValue(makeSettings('FREE'));
      mockPrismaService.aiUsageLog.aggregate.mockResolvedValue({ _sum: { totalTokens: 50_000 } });

      await expect(service.generateProgram(generateDto, TRAINER_ID)).rejects.toThrow(/FREE/);
    });

    it('does NOT throw when tokens used is below the limit', async () => {
      mockPrismaService.trainerSettings.upsert.mockResolvedValue(makeSettings('FREE'));
      mockPrismaService.aiUsageLog.aggregate.mockResolvedValue({ _sum: { totalTokens: 49_999 } });

      await expect(service.generateProgram(generateDto, TRAINER_ID)).resolves.toBeDefined();
    });

    it('UNLIMITED plan never throws regardless of tokens used', async () => {
      mockPrismaService.trainerSettings.upsert.mockResolvedValue(makeSettings('UNLIMITED'));
      mockPrismaService.aiUsageLog.aggregate.mockResolvedValue({ _sum: { totalTokens: 99_999_999 } });

      await expect(service.generateProgram(generateDto, TRAINER_ID)).resolves.toBeDefined();
    });

    it('treats null _sum.totalTokens as 0 (no logs yet)', async () => {
      mockPrismaService.aiUsageLog.aggregate.mockResolvedValue({ _sum: { totalTokens: null } });

      await expect(service.generateProgram(generateDto, TRAINER_ID)).resolves.toBeDefined();
    });
  });

  // ─── generateProgram: логирование ────────────────────────────────────────

  describe('generateProgram — usage logging', () => {
    it('creates an AiUsageLog record after successful API call', async () => {
      mockAiGateway.complete.mockResolvedValue(makeAiResponse(validAiJson, 1200, 800));

      await service.generateProgram(generateDto, TRAINER_ID);

      expect(mockPrismaService.aiUsageLog.create).toHaveBeenCalledTimes(1);
    });

    it('logs correct inputTokens and outputTokens', async () => {
      mockAiGateway.complete.mockResolvedValue(makeAiResponse(validAiJson, 1200, 800));

      await service.generateProgram(generateDto, TRAINER_ID);

      const logData = mockPrismaService.aiUsageLog.create.mock.calls[0][0].data;
      expect(logData.inputTokens).toBe(1200);
      expect(logData.outputTokens).toBe(800);
    });

    it('logs totalTokens as sum of input + output', async () => {
      mockAiGateway.complete.mockResolvedValue(makeAiResponse(validAiJson, 1200, 800));

      await service.generateProgram(generateDto, TRAINER_ID);

      const logData = mockPrismaService.aiUsageLog.create.mock.calls[0][0].data;
      expect(logData.totalTokens).toBe(2000);
    });

    it('logs correct costUsd: input*0.8/1M + output*4.0/1M', async () => {
      mockAiGateway.complete.mockResolvedValue(makeAiResponse(validAiJson, 1_000_000, 1_000_000));

      await service.generateProgram(generateDto, TRAINER_ID);

      const logData = mockPrismaService.aiUsageLog.create.mock.calls[0][0].data;
      // $0.80 + $4.00 = $4.80 total
      expect(logData.costUsd).toBeCloseTo(4.80, 5);
    });

    it('logs operation as "generate_program"', async () => {
      await service.generateProgram(generateDto, TRAINER_ID);

      const logData = mockPrismaService.aiUsageLog.create.mock.calls[0][0].data;
      expect(logData.operation).toBe('generate_program');
    });

    it('logs correct trainerId', async () => {
      await service.generateProgram(generateDto, TRAINER_ID);

      const logData = mockPrismaService.aiUsageLog.create.mock.calls[0][0].data;
      expect(logData.trainerId).toBe(TRAINER_ID);
    });

    it('does NOT create usage log when limit exceeded', async () => {
      mockPrismaService.aiUsageLog.aggregate.mockResolvedValue({ _sum: { totalTokens: 50_000 } });

      await expect(service.generateProgram(generateDto, TRAINER_ID)).rejects.toThrow(ForbiddenException);

      expect(mockPrismaService.aiUsageLog.create).not.toHaveBeenCalled();
    });

    it('does NOT create usage log when client not found', async () => {
      mockPrismaService.trainerClient.findFirst.mockResolvedValue(null);

      await expect(service.generateProgram(generateDto, TRAINER_ID)).rejects.toThrow(NotFoundException);

      expect(mockPrismaService.aiUsageLog.create).not.toHaveBeenCalled();
    });
  });

  // ─── generateProgram: usage в ответе ─────────────────────────────────────

  describe('generateProgram — usage in response', () => {
    it('includes usage field in the response', async () => {
      mockAiGateway.complete.mockResolvedValue(makeAiResponse(validAiJson, 1000, 500));

      const result = await service.generateProgram(generateDto, TRAINER_ID);

      expect(result.usage).toBeDefined();
    });

    it('returns correct inputTokens and outputTokens in usage', async () => {
      mockAiGateway.complete.mockResolvedValue(makeAiResponse(validAiJson, 1000, 500));

      const result = await service.generateProgram(generateDto, TRAINER_ID);

      expect(result.usage.inputTokens).toBe(1000);
      expect(result.usage.outputTokens).toBe(500);
      expect(result.usage.totalTokens).toBe(1500);
    });

    it('tokensUsedThisMonth = previously used + this request totalTokens', async () => {
      mockPrismaService.aiUsageLog.aggregate.mockResolvedValue({ _sum: { totalTokens: 10_000 } });
      mockAiGateway.complete.mockResolvedValue(makeAiResponse(validAiJson, 1000, 500));

      const result = await service.generateProgram(generateDto, TRAINER_ID);

      expect(result.usage.tokensUsedThisMonth).toBe(11_500);
    });

    it('monthlyLimit is the numeric plan limit for FREE', async () => {
      mockPrismaService.trainerSettings.upsert.mockResolvedValue(makeSettings('FREE'));

      const result = await service.generateProgram(generateDto, TRAINER_ID);

      expect(result.usage.monthlyLimit).toBe(50_000);
    });

    it('monthlyLimit is null for UNLIMITED', async () => {
      mockPrismaService.trainerSettings.upsert.mockResolvedValue(makeSettings('UNLIMITED'));

      const result = await service.generateProgram(generateDto, TRAINER_ID);

      expect(result.usage.monthlyLimit).toBeNull();
    });

    it('returns plan name in usage', async () => {
      mockPrismaService.trainerSettings.upsert.mockResolvedValue(makeSettings('PRO'));

      const result = await service.generateProgram(generateDto, TRAINER_ID);

      expect(result.usage.plan).toBe('PRO');
    });

    it('costUsd is rounded to 6 decimal places', async () => {
      mockAiGateway.complete.mockResolvedValue(makeAiResponse(validAiJson, 1000, 500));

      const result = await service.generateProgram(generateDto, TRAINER_ID);

      const decimals = result.usage.costUsd.toString().split('.')[1]?.length ?? 0;
      expect(decimals).toBeLessThanOrEqual(6);
    });
  });

  // ─── generateProgram: базовая логика (обновлённые) ───────────────────────

  describe('generateProgram — core logic', () => {
    it('throws NotFoundException when trainerClient not found', async () => {
      mockPrismaService.trainerClient.findFirst.mockResolvedValue(null);

      await expect(service.generateProgram(generateDto, TRAINER_ID)).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when AI returns invalid JSON', async () => {
      mockAiGateway.complete.mockResolvedValue(makeAiResponse('not valid json'));

      await expect(service.generateProgram(generateDto, TRAINER_ID)).rejects.toThrow(BadRequestException);
    });

    it('strips markdown code blocks from AI response', async () => {
      const wrapped = `\`\`\`json\n${validAiJson}\n\`\`\``;
      mockAiGateway.complete.mockResolvedValue(makeAiResponse(wrapped));

      const result = await service.generateProgram(generateDto, TRAINER_ID);

      expect(result.totalWorkouts).toBe(1);
    });

    it('returns workouts, recommendations and totalWorkouts', async () => {
      const result = await service.generateProgram(generateDto, TRAINER_ID);

      expect(result.workouts).toBeDefined();
      expect(result.recommendations).toBe('Следите за техникой');
      expect(result.totalWorkouts).toBe(1);
    });
  });

  // ─── getUsage ─────────────────────────────────────────────────────────────

  describe('getUsage', () => {
    const makeAgg = (tokens: number, cost: number, count: number) => ({
      _sum: { inputTokens: tokens, outputTokens: tokens, totalTokens: tokens, costUsd: cost },
      _count: { id: count },
    });

    it('returns plan from settings', async () => {
      mockPrismaService.trainerSettings.upsert.mockResolvedValue(makeSettings('BASIC'));
      mockPrismaService.aiUsageLog.aggregate.mockResolvedValue(makeAgg(0, 0, 0));

      const result = await service.getUsage(TRAINER_ID);

      expect(result.plan).toBe('BASIC');
    });

    it('returns monthlyLimit for paid plans', async () => {
      mockPrismaService.trainerSettings.upsert.mockResolvedValue(makeSettings('BASIC'));
      mockPrismaService.aiUsageLog.aggregate.mockResolvedValue(makeAgg(0, 0, 0));

      const result = await service.getUsage(TRAINER_ID);

      expect(result.monthlyLimit).toBe(300_000);
    });

    it('monthlyLimit is null for UNLIMITED', async () => {
      mockPrismaService.trainerSettings.upsert.mockResolvedValue(makeSettings('UNLIMITED'));
      mockPrismaService.aiUsageLog.aggregate.mockResolvedValue(makeAgg(0, 0, 0));

      const result = await service.getUsage(TRAINER_ID);

      expect(result.monthlyLimit).toBeNull();
    });

    it('returns tokensUsed from aggregate', async () => {
      mockPrismaService.aiUsageLog.aggregate.mockResolvedValue(makeAgg(12_500, 0.01, 5));

      const result = await service.getUsage(TRAINER_ID);

      expect(result.tokensUsed).toBe(12_500);
    });

    it('calculates tokensRemaining = limit - used', async () => {
      mockPrismaService.trainerSettings.upsert.mockResolvedValue(makeSettings('FREE'));
      mockPrismaService.aiUsageLog.aggregate.mockResolvedValue(makeAgg(10_000, 0, 0));

      const result = await service.getUsage(TRAINER_ID);

      expect(result.tokensRemaining).toBe(40_000);
    });

    it('tokensRemaining is null for UNLIMITED', async () => {
      mockPrismaService.trainerSettings.upsert.mockResolvedValue(makeSettings('UNLIMITED'));
      mockPrismaService.aiUsageLog.aggregate.mockResolvedValue(makeAgg(99_999, 0, 0));

      const result = await service.getUsage(TRAINER_ID);

      expect(result.tokensRemaining).toBeNull();
    });

    it('tokensRemaining is 0 (not negative) when over limit', async () => {
      mockPrismaService.trainerSettings.upsert.mockResolvedValue(makeSettings('FREE'));
      mockPrismaService.aiUsageLog.aggregate.mockResolvedValue(makeAgg(60_000, 0, 0));

      const result = await service.getUsage(TRAINER_ID);

      expect(result.tokensRemaining).toBe(0);
    });

    it('calculates percentUsed correctly', async () => {
      mockPrismaService.trainerSettings.upsert.mockResolvedValue(makeSettings('FREE'));
      mockPrismaService.aiUsageLog.aggregate.mockResolvedValue(makeAgg(25_000, 0, 0));

      const result = await service.getUsage(TRAINER_ID);

      expect(result.percentUsed).toBe(50.0);
    });

    it('percentUsed is 0 for UNLIMITED', async () => {
      mockPrismaService.trainerSettings.upsert.mockResolvedValue(makeSettings('UNLIMITED'));
      mockPrismaService.aiUsageLog.aggregate.mockResolvedValue(makeAgg(1_000_000, 0, 0));

      const result = await service.getUsage(TRAINER_ID);

      expect(result.percentUsed).toBe(0);
    });

    it('returns costThisMonth rounded to 4 decimal places', async () => {
      mockPrismaService.aiUsageLog.aggregate.mockResolvedValue(makeAgg(0, 0.123456789, 3));

      const result = await service.getUsage(TRAINER_ID);

      expect(result.costThisMonth).toBe(0.1235);
    });

    it('returns requestsThisMonth from aggregate count', async () => {
      mockPrismaService.aiUsageLog.aggregate.mockResolvedValue(makeAgg(0, 0, 7));

      const result = await service.getUsage(TRAINER_ID);

      expect(result.requestsThisMonth).toBe(7);
    });

    it('returns recentHistory from findMany', async () => {
      const logs = [
        { id: 'log-1', inputTokens: 100, outputTokens: 50, totalTokens: 150, costUsd: 0.0002, operation: 'generate_program', createdAt: new Date() },
      ];
      mockPrismaService.aiUsageLog.findMany.mockResolvedValue(logs);
      mockPrismaService.aiUsageLog.aggregate.mockResolvedValue(makeAgg(0, 0, 0));

      const result = await service.getUsage(TRAINER_ID);

      expect(result.recentHistory).toEqual(logs);
    });

    it('handles zero aggregate (no logs yet) gracefully', async () => {
      mockPrismaService.aiUsageLog.aggregate.mockResolvedValue({
        _sum: { inputTokens: null, outputTokens: null, totalTokens: null, costUsd: null },
        _count: { id: 0 },
      });

      const result = await service.getUsage(TRAINER_ID);

      expect(result.tokensUsed).toBe(0);
      expect(result.costThisMonth).toBe(0);
      expect(result.requestsThisMonth).toBe(0);
    });
  });
});
