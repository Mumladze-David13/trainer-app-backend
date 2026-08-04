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
import {
  ParseMealDto,
  LogMealDto,
  GenerateMealPlanDto,
  SaveMealPlanDto,
} from './dto/meal-ai.dto';
import { NutritionService } from '../nutrition/nutrition.service';

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
    private readonly nutritionService: NutritionService,
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

  private validateParsedMealItems(parsed: any): void {
    if (!Array.isArray(parsed.items)) {
      throw new BadRequestException('AI response missing "items" array');
    }

    for (const item of parsed.items) {
      if (!item.name || typeof item.name !== 'string') {
        throw new BadRequestException('AI response item missing valid "name"');
      }
      if (typeof item.amountGrams !== 'number' || item.amountGrams <= 0) {
        throw new BadRequestException('AI response item missing valid "amountGrams"');
      }
      if (typeof item.caloriesPer100g !== 'number' || item.caloriesPer100g < 0) {
        throw new BadRequestException('AI response item missing valid "caloriesPer100g"');
      }
      if (typeof item.proteinPer100g !== 'number' || item.proteinPer100g < 0) {
        throw new BadRequestException('AI response item missing valid "proteinPer100g"');
      }
      if (typeof item.carbsPer100g !== 'number' || item.carbsPer100g < 0) {
        throw new BadRequestException('AI response item missing valid "carbsPer100g"');
      }
      if (typeof item.fatPer100g !== 'number' || item.fatPer100g < 0) {
        throw new BadRequestException('AI response item missing valid "fatPer100g"');
      }
    }
  }

  private validateGeneratedMealPlan(parsed: any): void {
    if (!Array.isArray(parsed.meals)) {
      throw new BadRequestException('AI response missing "meals" array');
    }

    for (const meal of parsed.meals) {
      if (!meal.type || typeof meal.type !== 'string') {
        throw new BadRequestException('AI response meal missing valid "type"');
      }
      if (!['breakfast', 'lunch', 'dinner', 'snack'].includes(meal.type)) {
        throw new BadRequestException(`AI response meal has invalid type: ${meal.type}`);
      }
      if (!Array.isArray(meal.items)) {
        throw new BadRequestException('AI response meal missing "items" array');
      }
      for (const item of meal.items) {
        if (!item.name || typeof item.name !== 'string') {
          throw new BadRequestException('AI response meal item missing valid "name"');
        }
        if (typeof item.amountGrams !== 'number' || item.amountGrams <= 0) {
          throw new BadRequestException('AI response meal item missing valid "amountGrams"');
        }
        if (typeof item.caloriesPer100g !== 'number' || item.caloriesPer100g < 0) {
          throw new BadRequestException('AI response meal item missing valid "caloriesPer100g"');
        }
        if (typeof item.proteinPer100g !== 'number' || item.proteinPer100g < 0) {
          throw new BadRequestException('AI response meal item missing valid "proteinPer100g"');
        }
        if (typeof item.carbsPer100g !== 'number' || item.carbsPer100g < 0) {
          throw new BadRequestException('AI response meal item missing valid "carbsPer100g"');
        }
        if (typeof item.fatPer100g !== 'number' || item.fatPer100g < 0) {
          throw new BadRequestException('AI response meal item missing valid "fatPer100g"');
        }
      }
    }
  }

  async parseMeal(dto: ParseMealDto, trainerId: string) {
    const settings = await this.getOrCreateSettings(trainerId);
    const limit = PLAN_TOKEN_LIMITS[settings.plan];
    const used = await this.getMonthlyTokensUsed(trainerId);

    if (used >= limit) {
      throw new ForbiddenException(
        `Исчерпан лимит токенов для тарифа ${settings.plan} (${limit.toLocaleString()} токенов/месяц). Перейдите на более высокий тариф.`,
      );
    }

    const systemPrompt = `Ты диетолог, разбирающийся в российской кухне.
Оцени пищевую ценность блюд из текста пользователя.

Отвечай строго в JSON формате без лишнего текста, markdown или пояснений.
Формат ответа:
{
  "items": [
    {
      "name": "Название блюда",
      "amountGrams": граммы_порции_число,
      "caloriesPer100g": калории_на_100г_число,
      "proteinPer100g": белки_на_100г_число,
      "carbsPer100g": углеводы_на_100г_число,
      "fatPer100g": жиры_на_100г_число
    }
  ]
}

Правила:
- Если в тексте несколько блюд — создай несколько элементов в items.
- amountGrams — вес порции: если указан явно — используй его, если нет (например "тарелка супа", "кусок торта") — оцени по типичным российским порциям.
- caloriesPer100g/proteinPer100g/carbsPer100g/fatPer100g — пищевая ценность на 100г этого конкретного блюда.
- Ориентируйся на российские блюда и способы приготовления (борщ, гречка, творог, куриная грудка на пару, оливье и т.п.).
- Все числа должны быть положительными.`;

    const userMessage = dto.mealType
      ? `Приём пищи: ${dto.mealType}\nТекст: ${dto.text}`
      : `Текст: ${dto.text}`;

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
        operation: 'parse_meal',
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

    this.validateParsedMealItems(parsed);

    return {
      items: parsed.items,
      usage: {
        totalTokens,
        costUsd: parseFloat(costUsd.toFixed(6)),
      },
    };
  }

  async logMeal(dto: LogMealDto, trainerId: string) {
    const trainerClient = await this.prisma.trainerClient.findFirst({
      where: { clientId: dto.clientId, trainerId },
    });
    if (!trainerClient) {
      throw new ForbiddenException('Client not assigned to this trainer');
    }

    const parsedDate = new Date(dto.date);

    await this.prisma.$transaction(async (tx) => {
      const mealPlan = await this.nutritionService.findOrCreateMealPlan(
        dto.clientId,
        parsedDate,
        tx,
      );

      const meal = await this.nutritionService.findOrCreateMeal(
        mealPlan.id,
        dto.mealType,
        dto.time,
        tx,
      );

      for (const item of dto.items) {
        const foodItem = await this.nutritionService.findOrCreateFoodItem(
          {
            name: item.name,
            caloriesPer100g: item.caloriesPer100g,
            proteinPer100g: item.proteinPer100g,
            carbsPer100g: item.carbsPer100g,
            fatPer100g: item.fatPer100g,
          },
          tx,
        );

        await tx.mealItem.create({
          data: {
            mealId: meal.id,
            foodItemId: foodItem.id,
            amountGrams: item.amountGrams,
          },
        });
      }
    });

    return { ok: true };
  }

  async generateMealPlan(dto: GenerateMealPlanDto, trainerId: string) {
    const settings = await this.getOrCreateSettings(trainerId);
    const limit = PLAN_TOKEN_LIMITS[settings.plan];
    const used = await this.getMonthlyTokensUsed(trainerId);

    if (used >= limit) {
      throw new ForbiddenException(
        `Исчерпан лимит токенов для тарифа ${settings.plan} (${limit.toLocaleString()} токенов/месяц). Перейдите на более высокий тариф.`,
      );
    }

    const trainerClient = await this.prisma.trainerClient.findFirst({
      where: { clientId: dto.clientId, trainerId },
    });
    if (!trainerClient) {
      throw new NotFoundException('Client not found');
    }

    const calculations = await this.nutritionService.getCalculations(dto.clientId);

    const systemPrompt = `Ты опытный диетолог, составляющий меню на день под целевые КБЖУ клиента.
Ты должен использовать реалистичные российские блюда (гречка, курица, творог, борщ, овсянка и т.п.).

Отвечай строго в JSON формате без лишнего текста, markdown или пояснений.
Формат ответа:
{
  "meals": [
    {
      "type": "breakfast",
      "time": "08:00",
      "items": [
        {
          "name": "Название блюда",
          "amountGrams": граммы_число,
          "caloriesPer100g": калории_на_100г_число,
          "proteinPer100g": белки_на_100г_число,
          "carbsPer100g": углеводы_на_100г_число,
          "fatPer100g": жиры_на_100г_число
        }
      ]
    }
  ]
}

Правила:
- Создай meals для breakfast, lunch, dinner, и при необходимости snack.
- Сумма калорий по всем items должна быть в пределах ±5-10% от целевого значения.
- Сумма белков/углеводов/жиров должна быть близка к целевым макросам.
- Используй только реалистичные российские блюда.
- Учитывай предпочтения/ограничения клиента.
- Все числа должны быть положительными.`;

    const userMessage = `Составь меню на день для клиента.

Целевые значения:
- Калории: ${calculations.targetCalories} ккал
- Белки: ${calculations.macros.protein}г
- Жиры: ${calculations.macros.fat}г
- Углеводы: ${calculations.macros.carbs}г

${dto.preferences ? `Предпочтения: ${dto.preferences}` : 'Предпочтений нет.'}

Создай сбалансированное меню из российских блюд.`;

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
        operation: 'generate_meal_plan',
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

    this.validateGeneratedMealPlan(parsed);

    let totalCalories = 0;
    let totalProtein = 0;
    let totalCarbs = 0;
    let totalFat = 0;

    for (const meal of parsed.meals) {
      for (const item of meal.items) {
        const ratio = item.amountGrams / 100;
        totalCalories += item.caloriesPer100g * ratio;
        totalProtein += item.proteinPer100g * ratio;
        totalCarbs += item.carbsPer100g * ratio;
        totalFat += item.fatPer100g * ratio;
      }
    }

    return {
      meals: parsed.meals,
      totals: {
        calories: Math.round(totalCalories),
        protein: Math.round(totalProtein),
        carbs: Math.round(totalCarbs),
        fat: Math.round(totalFat),
      },
      usage: {
        totalTokens,
        costUsd: parseFloat(costUsd.toFixed(6)),
      },
    };
  }

  async saveMealPlan(dto: SaveMealPlanDto, trainerId: string) {
    const trainerClient = await this.prisma.trainerClient.findFirst({
      where: { clientId: dto.clientId, trainerId },
    });
    if (!trainerClient) {
      throw new ForbiddenException('Client not assigned to this trainer');
    }

    const parsedDate = new Date(dto.date);

    await this.prisma.$transaction(async (tx) => {
      const mealPlan = await this.nutritionService.findOrCreateMealPlan(
        dto.clientId,
        parsedDate,
        tx,
      );

      for (const mealDto of dto.meals) {
        const meal = await this.nutritionService.findOrCreateMeal(
          mealPlan.id,
          mealDto.type,
          mealDto.time,
          tx,
        );

        for (const item of mealDto.items) {
          const foodItem = await this.nutritionService.findOrCreateFoodItem(
            {
              name: item.name,
              caloriesPer100g: item.caloriesPer100g,
              proteinPer100g: item.proteinPer100g,
              carbsPer100g: item.carbsPer100g,
              fatPer100g: item.fatPer100g,
            },
            tx,
          );

          await tx.mealItem.create({
            data: {
              mealId: meal.id,
              foodItemId: foodItem.id,
              amountGrams: item.amountGrams,
            },
          });
        }
      }
    });

    return { ok: true };
  }
}
