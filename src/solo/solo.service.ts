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
import { planTokenLimit, COST_PER_INPUT_TOKEN, COST_PER_OUTPUT_TOKEN } from '../ai/ai.service';
import { AnonymizerService } from '../ai/anonymizer.service';
import {
  PROGRAM_SYSTEM_PROMPT,
  SOLO_EQUIPMENT_FILTER,
  describeClient,
  historyBlock,
  loadExerciseCatalog,
  placeWorkoutsInSeasons,
  resolveTrainerExerciseId,
} from '../ai/program-planning';
import { CreateSoloProfileDto } from './dto/create-solo-profile.dto';
import { GenerateSoloProgramDto } from './dto/generate-solo-program.dto';

@Injectable()
export class SoloService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: AiGateway,
    private readonly anonymizer: AnonymizerService,
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

  public async generateInitialProgram(userId: string, dto: GenerateSoloProgramDto = {}) {
    const profile = await this.prisma.soloProfile.findUnique({ where: { userId } });
    if (!profile) throw new NotFoundException('Профиль не заполнен');
    if (!profile.agreedToTermsAt) throw new ForbiddenException('Необходимо принять условия использования');

    const settings = await this.prisma.trainerSettings.upsert({
      where: { trainerId: userId },
      create: { trainerId: userId },
      update: {},
    });
    const limit = planTokenLimit(settings.plan);
    const used = await this.getMonthlyTokensUsed(userId);
    if (used >= limit) {
      throw new ForbiddenException(
        `Исчерпан лимит токенов для тарифа ${settings.plan} (${limit.toLocaleString()} токенов/месяц).`,
      );
    }

    const catalog = await loadExerciseCatalog(this.prisma, {
      equipment: SOLO_EQUIPMENT_FILTER[profile.equipment] ?? SOLO_EQUIPMENT_FILTER.gym,
    });
    if (catalog.entries.size === 0) {
      throw new BadRequestException('Не удалось подобрать упражнения под выбранное оборудование');
    }

    const relationId = await this.getSelfRelationId(userId);
    const history = await this.prisma.workout.findMany({
      where: { season: { trainerClientId: relationId }, isCompleted: true },
      orderBy: { date: 'desc' },
      take: 10,
      include: { workoutExercises: { include: { exercise: true } } },
    });
    const clientInfo = await describeClient(this.prisma, userId);
    const workoutsCount = dto.workoutsCount ?? profile.daysPerWeek;

    const userMessage = `Составь программу тренировок для самостоятельных занятий.

Параметры:
- Данные: ${clientInfo}
- Цель: ${profile.goal}
- Уровень подготовки: ${profile.level}
- Занятий в неделю: ${profile.daysPerWeek}
- Оборудование: ${profile.equipment}
- Ограничения и пожелания: ${profile.notes ?? 'нет'}

${historyBlock(this.anonymizer.anonymizeWorkoutHistory(history))}

Доступные упражнения (используй ТОЛЬКО эти, указывай номер):
${catalog.promptList}

Создай ровно ${workoutsCount} ${workoutsCount === 1 ? 'тренировку' : 'тренировки'}.`;

    const { text, usage } = await this.gateway.completeJson(PROGRAM_SYSTEM_PROMPT, userMessage);

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
      parsed = JSON.parse(text);
    } catch {
      throw new BadRequestException('AI вернул некорректный формат. Попробуйте ещё раз.');
    }
    if (!Array.isArray(parsed.workouts)) {
      throw new BadRequestException('AI вернул некорректный формат. Попробуйте ещё раз.');
    }

    // Материализуем упражнения из глобального справочника как TrainerExercise,
    // принадлежащие самому пользователю — так работает прогресс/история веса
    // и обычный сериализатор WorkoutExercise.exercise без изменений схемы.
    const resolved: {
      notes: string | null;
      exercises: { exerciseId: string; sets: number; reps: number; weight: number | null; order: number }[];
    }[] = [];
    for (const w of parsed.workouts.slice(0, workoutsCount)) {
      if (!Array.isArray(w.exercises)) continue;
      const exercises: (typeof resolved)[number]['exercises'] = [];
      for (const e of w.exercises) {
        const entry = catalog.entries.get(Number(e.exercise));
        if (!entry) continue;
        exercises.push({
          exerciseId: await resolveTrainerExerciseId(this.prisma, entry, userId),
          sets: e.sets ?? 3,
          reps: e.reps ?? 10,
          weight: e.weight ?? null,
          order: e.order ?? exercises.length,
        });
      }
      if (exercises.length) resolved.push({ notes: w.notes ?? null, exercises });
    }

    if (resolved.length === 0) {
      throw new BadRequestException('AI не вернул ни одного распознанного упражнения. Попробуйте ещё раз.');
    }

    // Даты: начиная с сегодня, но не раньше следующего слота после
    // последней запланированной тренировки текущего сезона.
    const gapDays = Math.max(1, Math.floor(7 / profile.daysPerWeek));
    const startDate = new Date();
    if (profile.currentSeasonId) {
      const last = await this.prisma.workout.findFirst({
        where: { seasonId: profile.currentSeasonId },
        orderBy: { date: 'desc' },
      });
      if (last) {
        const next = new Date(last.date);
        next.setDate(next.getDate() + gapDays);
        if (next > startDate) startDate.setTime(next.getTime());
      }
    }
    const dated = resolved.map((w, i) => {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i * gapDays);
      return { ...w, date };
    });

    const { placed, newSeason } = await placeWorkoutsInSeasons(
      this.prisma,
      { trainerClientId: relationId, trainerId: userId, preferredSeasonId: profile.currentSeasonId },
      dated,
    );

    for (const { workout, seasonId } of placed) {
      await this.prisma.workout.create({
        data: {
          seasonId,
          date: workout.date,
          notes: workout.notes,
          isCompleted: false,
          workoutExercises: { create: workout.exercises },
        },
      });
    }

    const seasonId = newSeason?.id ?? placed[0].seasonId;
    if (seasonId !== profile.currentSeasonId) {
      await this.prisma.soloProfile.update({
        where: { userId },
        data: { currentSeasonId: seasonId },
      });
    }
    const season = await this.prisma.season.findUnique({ where: { id: seasonId } });

    return {
      season,
      newSeason,
      workoutsCreated: placed.length,
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
