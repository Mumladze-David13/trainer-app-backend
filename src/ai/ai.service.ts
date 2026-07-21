import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { SubscriptionPlan } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AiGateway } from './ai.gateway';
import { AnonymizerService } from './anonymizer.service';
import { GenerateProgramDto, SaveGeneratedProgramDto } from './dto/generate-program.dto';

const PLAN_TOKEN_LIMITS: Record<SubscriptionPlan, number> = {
  FREE: 50_000,
  BASIC: 300_000,
  PRO: 1_000_000,
  UNLIMITED: Infinity,
};

// claude-haiku-4-5 pricing: $0.80/1M input, $4.00/1M output
const COST_PER_INPUT_TOKEN = 0.80 / 1_000_000;
const COST_PER_OUTPUT_TOKEN = 4.00 / 1_000_000;

@Injectable()
export class AiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: AiGateway,
    private readonly anonymizer: AnonymizerService,
  ) {}

  private async getOrCreateSettings(trainerId: string) {
    return this.prisma.trainerSettings.upsert({
      where: { trainerId },
      create: { trainerId },
      update: {},
    });
  }

  private async getMonthlyTokensUsed(trainerId: string): Promise<number> {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const result = await this.prisma.aiUsageLog.aggregate({
      where: { trainerId, createdAt: { gte: startOfMonth } },
      _sum: { totalTokens: true },
    });

    return result._sum.totalTokens ?? 0;
  }

  async generateProgram(dto: GenerateProgramDto, trainerId: string) {
    const settings = await this.getOrCreateSettings(trainerId);
    const limit = PLAN_TOKEN_LIMITS[settings.plan];
    const used = await this.getMonthlyTokensUsed(trainerId);

    if (used >= limit) {
      throw new ForbiddenException(
        `Исчерпан лимит токенов для тарифа ${settings.plan} (${limit.toLocaleString()} токенов/месяц). Перейдите на более высокий тариф.`,
      );
    }

    const exercises = await this.prisma.trainerExercise.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });

    const trainerClient = await this.prisma.trainerClient.findFirst({
      where: { trainerId, clientId: dto.clientId },
      include: {
        client: true,
        seasons: {
          take: 2,
          orderBy: { startDate: 'desc' },
          include: {
            workouts: {
              where: { isCompleted: true },
              take: 10,
              include: { workoutExercises: { include: { exercise: true } } },
            },
          },
        },
      },
    });

    if (!trainerClient) throw new NotFoundException('Клиент не найден');

    const { clientHash } = this.anonymizer.anonymizeClient(trainerClient.client);
    const history = trainerClient.seasons?.flatMap((s) => s.workouts) ?? [];
    const anonymizedHistory = this.anonymizer.anonymizeWorkoutHistory(history);
    const exerciseList = exercises.map((e) => `- ${e.name} (id: ${e.id})`).join('\n');

    const systemPrompt = `Ты опытный персональный тренер составляющий программы тренировок.
Ты должен использовать ТОЛЬКО упражнения из предоставленного списка — не придумывай новые.
Отвечай строго в JSON формате без лишнего текста, markdown или пояснений.
Формат ответа:
{
  "workouts": [
    {
      "dayNumber": 1,
      "notes": "описание занятия",
      "exercises": [
        {
          "exerciseId": "id из списка",
          "exerciseName": "название",
          "sets": 3,
          "reps": 10,
          "weight": 50,
          "setWeights": null,
          "supersetGroup": null,
          "supersetOrder": null,
          "order": 0
        }
      ]
    }
  ],
  "recommendations": "общие рекомендации тренеру"
}`;

    const userMessage = `Составь программу тренировок для клиента ${clientHash}.

Параметры:
- Цель: ${dto.goal}
- Уровень подготовки: ${dto.level}
- Занятий в неделю: ${dto.daysPerWeek}
- Доступное оборудование: ${dto.equipment}
- Дополнительные пожелания: ${dto.notes ?? 'нет'}

История тренировок (последние занятия):
${JSON.stringify(anonymizedHistory, null, 2)}

Доступные упражнения (используй ТОЛЬКО эти):
${exerciseList}

Создай программу на ${dto.daysPerWeek} занятий.`;

    const { text, usage } = await this.gateway.complete(systemPrompt, userMessage);

    const totalTokens = usage.inputTokens + usage.outputTokens;
    const costUsd =
      usage.inputTokens * COST_PER_INPUT_TOKEN +
      usage.outputTokens * COST_PER_OUTPUT_TOKEN;

    await this.prisma.aiUsageLog.create({
      data: {
        trainerId,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        totalTokens,
        costUsd,
        operation: 'generate_program',
      },
    });

    let parsed: any;
    try {
      const clean = text.replace(/```json/g, '').replace(/```/g, '').trim();
      parsed = JSON.parse(clean);
    } catch {
      throw new BadRequestException(
        'AI вернул некорректный формат. Попробуйте ещё раз.',
      );
    }

    return {
      workouts: parsed.workouts,
      recommendations: parsed.recommendations,
      totalWorkouts: parsed.workouts.length,
      usage: {
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        totalTokens,
        costUsd: parseFloat(costUsd.toFixed(6)),
        tokensUsedThisMonth: used + totalTokens,
        monthlyLimit: limit === Infinity ? null : limit,
        plan: settings.plan,
      },
    };
  }

  async saveGeneratedProgram(dto: SaveGeneratedProgramDto, trainerId: string) {
    const season = await this.prisma.season.findFirst({
      where: { id: dto.seasonId, trainerClient: { trainerId } },
    });
    if (!season) throw new NotFoundException('Сезон не найден');

    const created = [];
    for (const workout of dto.workouts) {
      const w = await this.prisma.workout.create({
        data: {
          seasonId: dto.seasonId,
          date: new Date(workout.date),
          notes: workout.notes,
          isCompleted: false,
          workoutExercises: {
            create: workout.exercises.map((e: any) => ({
              exerciseId: e.exerciseId,
              sets: e.sets,
              reps: e.reps,
              weight: e.weight ?? null,
              setWeights: e.setWeights ? JSON.stringify(e.setWeights) : null,
              supersetGroup: e.supersetGroup ?? null,
              supersetOrder: e.supersetOrder ?? null,
              order: e.order,
            })),
          },
        },
      });
      created.push(w);
    }

    return { created: created.length, seasonId: dto.seasonId };
  }

  async getUsage(trainerId: string) {
    const settings = await this.getOrCreateSettings(trainerId);
    const limit = PLAN_TOKEN_LIMITS[settings.plan];

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const [monthlyAgg, history] = await Promise.all([
      this.prisma.aiUsageLog.aggregate({
        where: { trainerId, createdAt: { gte: startOfMonth } },
        _sum: { inputTokens: true, outputTokens: true, totalTokens: true, costUsd: true },
        _count: { id: true },
      }),
      this.prisma.aiUsageLog.findMany({
        where: { trainerId },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
          id: true,
          inputTokens: true,
          outputTokens: true,
          totalTokens: true,
          costUsd: true,
          operation: true,
          createdAt: true,
        },
      }),
    ]);

    const tokensUsed = monthlyAgg._sum.totalTokens ?? 0;
    const costThisMonth = monthlyAgg._sum.costUsd ?? 0;

    return {
      plan: settings.plan,
      monthlyLimit: limit === Infinity ? null : limit,
      tokensUsed,
      tokensRemaining: limit === Infinity ? null : Math.max(0, limit - tokensUsed),
      percentUsed: limit === Infinity ? 0 : parseFloat(((tokensUsed / limit) * 100).toFixed(1)),
      costThisMonth: parseFloat(costThisMonth.toFixed(4)),
      requestsThisMonth: monthlyAgg._count.id,
      recentHistory: history,
    };
  }
}
