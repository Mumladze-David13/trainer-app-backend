// src/solo/solo.service.ts
import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AiGateway } from '../ai/ai.gateway';
import { PLAN_TOKEN_LIMITS, COST_PER_INPUT_TOKEN, COST_PER_OUTPUT_TOKEN } from '../ai/ai.service';
import { CreateSoloProfileDto } from './dto/create-solo-profile.dto';

// Соответствие онбординг-выбора оборудования реальным значениям
// GlobalExercise.equipment (см. prisma/seed-global-exercises.ts EQUIPMENT_MAP).
// null = не фильтровать (полный зал — доступно всё).
const EQUIPMENT_FILTER: Record<string, string[] | null> = {
  gym: null,
  home_dumbbells: ['гантели', 'собственный вес', 'эспандер'],
  bodyweight: ['собственный вес'],
};

@Injectable()
export class SoloService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: AiGateway,
  ) {}

  private async assertSoloUser(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Пользователь не найден');
    if (user.role !== Role.SOLO) {
      throw new ForbiddenException('Доступно только для пользователей в режиме SOLO');
    }
  }

  // Заводит self-referencing TrainerClient + ClientSettings + TrainerSettings,
  // чтобы SOLO-пользователь мог переиспользовать существующие сезоны/тренировки/
  // клиентские эндпоинты как "сам себе тренер и клиент" (тот же паттерн, что
  // ClientsService.addClient уже поддерживает для self-add).
  private async ensureSelfRelations(userId: string) {
    await this.prisma.trainerClient.upsert({
      where: { trainerId_clientId: { trainerId: userId, clientId: userId } },
      create: { trainerId: userId, clientId: userId },
      update: {},
    });

    await this.prisma.clientSettings.upsert({
      where: { clientId: userId },
      create: { clientId: userId, trainerId: userId },
      update: { trainerId: userId },
    });

    await this.prisma.trainerSettings.upsert({
      where: { trainerId: userId },
      create: { trainerId: userId },
      update: {},
    });
  }

  private async getSelfRelationId(userId: string) {
    const relation = await this.prisma.trainerClient.findUnique({
      where: { trainerId_clientId: { trainerId: userId, clientId: userId } },
    });
    if (!relation) throw new NotFoundException('Профиль SOLO не настроен');
    return relation.id;
  }

  public async createProfile(userId: string, dto: CreateSoloProfileDto) {
    await this.assertSoloUser(userId);

    const profile = await this.prisma.soloProfile.upsert({
      where: { userId },
      create: { userId, ...dto },
      update: { ...dto },
    });

    await this.ensureSelfRelations(userId);

    return profile;
  }

  public async getProfile(userId: string) {
    return this.prisma.soloProfile.findUnique({ where: { userId } });
  }

  public async agreeToTerms(userId: string) {
    const profile = await this.prisma.soloProfile.findUnique({ where: { userId } });
    if (!profile) throw new NotFoundException('Сначала заполните профиль (POST /solo/profile)');

    return this.prisma.soloProfile.update({
      where: { userId },
      data: { agreedToTermsAt: new Date() },
    });
  }

  private async getMonthlyTokensUsed(userId: string): Promise<number> {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const result = await this.prisma.aiUsageLog.aggregate({
      where: { trainerId: userId, createdAt: { gte: startOfMonth } },
      _sum: { totalTokens: true },
    });

    return result._sum.totalTokens ?? 0;
  }

  public async generateInitialProgram(userId: string) {
    const profile = await this.prisma.soloProfile.findUnique({ where: { userId } });
    if (!profile) throw new NotFoundException('Профиль не заполнен');
    if (!profile.agreedToTermsAt) throw new ForbiddenException('Необходимо принять условия использования');

    const settings = await this.prisma.trainerSettings.upsert({
      where: { trainerId: userId },
      create: { trainerId: userId },
      update: {},
    });
    const limit = PLAN_TOKEN_LIMITS[settings.plan];
    const used = await this.getMonthlyTokensUsed(userId);
    if (used >= limit) {
      throw new ForbiddenException(
        `Исчерпан лимит токенов для тарифа ${settings.plan} (${limit.toLocaleString()} токенов/месяц).`,
      );
    }

    const equipmentFilter = EQUIPMENT_FILTER[profile.equipment] ?? null;
    const exercises = await this.prisma.globalExercise.findMany({
      where: equipmentFilter ? { equipment: { in: equipmentFilter } } : {},
      select: { id: true, name: true, nameRus: true, equipment: true },
      take: 150,
    });
    if (exercises.length === 0) {
      throw new BadRequestException('Не удалось подобрать упражнения под выбранное оборудование');
    }
    const exerciseById = new Map(exercises.map((e) => [e.id, e]));

    const exerciseList = exercises
      .map((e) => `- ${e.nameRus ?? e.name} (id: ${e.id})`)
      .join('\n');

    const systemPrompt = `Ты опытный персональный тренер составляющий программы тренировок.
Ты должен использовать ТОЛЬКО упражнения из предоставленного списка — не придумывай новые и не меняй id.
Отвечай строго в JSON формате без лишнего текста, markdown или пояснений.
Формат ответа:
{
  "workouts": [
    {
      "dayNumber": 1,
      "notes": "описание занятия",
      "exercises": [
        {
          "globalExerciseId": "id из списка",
          "exerciseName": "название",
          "sets": 3,
          "reps": 10,
          "weight": null,
          "order": 0
        }
      ]
    }
  ],
  "recommendations": "общие рекомендации"
}`;

    const userMessage = `Составь программу тренировок для самостоятельных занятий.

Параметры:
- Цель: ${profile.goal}
- Уровень подготовки: ${profile.level}
- Занятий в неделю: ${profile.daysPerWeek}
- Оборудование: ${profile.equipment}
- Дополнительные пожелания: ${profile.notes ?? 'нет'}

Доступные упражнения (используй ТОЛЬКО эти):
${exerciseList}

Создай программу на ${profile.daysPerWeek} занятий.`;

    const { text, usage } = await this.gateway.complete(systemPrompt, userMessage);

    const totalTokens = usage.inputTokens + usage.outputTokens;
    const costUsd =
      usage.inputTokens * COST_PER_INPUT_TOKEN + usage.outputTokens * COST_PER_OUTPUT_TOKEN;

    await this.prisma.aiUsageLog.create({
      data: {
        trainerId: userId,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        totalTokens,
        costUsd,
        operation: 'generate_program_solo',
      },
    });

    let parsed: any;
    try {
      const clean = text.replace(/```json/g, '').replace(/```/g, '').trim();
      parsed = JSON.parse(clean);
    } catch {
      throw new BadRequestException('AI вернул некорректный формат. Попробуйте ещё раз.');
    }
    if (!Array.isArray(parsed.workouts)) {
      throw new BadRequestException('AI вернул некорректный формат. Попробуйте ещё раз.');
    }

    // Материализуем упражнения из глобального справочника как TrainerExercise,
    // принадлежащие самому пользователю — так работает прогресс/история веса
    // и обычный сериализатор WorkoutExercise.exercise без изменений схемы.
    const trainerExerciseIdByGlobalId = new Map<string, string>();
    const resolveTrainerExerciseId = async (globalExerciseId: string) => {
      if (trainerExerciseIdByGlobalId.has(globalExerciseId)) {
        return trainerExerciseIdByGlobalId.get(globalExerciseId)!;
      }
      const globalExercise = exerciseById.get(globalExerciseId);
      if (!globalExercise) return null;

      const existing = await this.prisma.trainerExercise.findUnique({
        where: { name_trainerId: { name: globalExercise.name, trainerId: userId } },
      });
      const trainerExercise =
        existing ??
        (await this.prisma.trainerExercise.create({
          data: {
            name: globalExercise.name,
            trainerId: userId,
            equipment: globalExercise.equipment,
            globalExerciseId: globalExercise.id,
          },
        }));

      trainerExerciseIdByGlobalId.set(globalExerciseId, trainerExercise.id);
      return trainerExercise.id;
    };

    const relationId = await this.getSelfRelationId(userId);
    const seasonCount = await this.prisma.season.count({ where: { trainerClientId: relationId } });

    const season = await this.prisma.season.create({
      data: {
        trainerClientId: relationId,
        name: `AI Программа ${seasonCount + 1}`,
        startDate: new Date(),
        isActive: true,
      },
    });

    const startDate = new Date();
    const gapDays = Math.max(1, Math.floor(7 / profile.daysPerWeek));
    let workoutsCreated = 0;

    for (let i = 0; i < parsed.workouts.length; i++) {
      const w = parsed.workouts[i];
      if (!Array.isArray(w.exercises)) continue;

      const exerciseCreates: { exerciseId: string; sets: number; reps: number; weight: number | null; order: number }[] = [];
      for (const e of w.exercises) {
        const trainerExerciseId = await resolveTrainerExerciseId(e.globalExerciseId);
        if (!trainerExerciseId) continue;
        exerciseCreates.push({
          exerciseId: trainerExerciseId,
          sets: e.sets ?? 3,
          reps: e.reps ?? 10,
          weight: e.weight ?? null,
          order: e.order ?? exerciseCreates.length,
        });
      }
      if (exerciseCreates.length === 0) continue;

      const workoutDate = new Date(startDate);
      workoutDate.setDate(startDate.getDate() + i * gapDays);

      await this.prisma.workout.create({
        data: {
          seasonId: season.id,
          date: workoutDate,
          notes: w.notes ?? null,
          isCompleted: false,
          workoutExercises: { create: exerciseCreates },
        },
      });
      workoutsCreated++;
    }

    if (workoutsCreated === 0) {
      throw new BadRequestException('AI не вернул ни одного распознанного упражнения. Попробуйте ещё раз.');
    }

    await this.prisma.soloProfile.update({
      where: { userId },
      data: { currentSeasonId: season.id },
    });

    return {
      season,
      workoutsCreated,
      recommendations: parsed.recommendations ?? null,
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

  public async getCurrentSeason(userId: string) {
    const profile = await this.prisma.soloProfile.findUnique({ where: { userId } });
    if (!profile?.currentSeasonId) return null;

    return this.prisma.season.findUnique({
      where: { id: profile.currentSeasonId },
      include: {
        workouts: {
          include: {
            workoutExercises: {
              include: { exercise: { include: { globalExercise: { select: { imageUrl: true } } } } },
              orderBy: { order: 'asc' },
            },
            completion: true,
          },
          orderBy: { date: 'asc' },
        },
      },
    });
  }

  public async getSeasons(userId: string) {
    const relationId = await this.getSelfRelationId(userId);

    return this.prisma.season.findMany({
      where: { trainerClientId: relationId },
      include: {
        workouts: {
          select: {
            id: true,
            date: true,
            isCompleted: true,
            _count: { select: { workoutExercises: true } },
          },
        },
      },
      orderBy: { startDate: 'desc' },
    });
  }
}
