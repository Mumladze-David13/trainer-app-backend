// src/exercises/exercises.service.ts
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiGateway } from '../ai/ai.gateway';
import { CreateExerciseDto, UpdateExerciseDto } from './dto/create-exercise.dto';

@Injectable()
export class ExercisesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aiGateway: AiGateway,
  ) {}

  public async findAll(trainerId: string) {
    return this.prisma.exercise.findMany({
      where: { trainerId },
      orderBy: { name: 'asc' },
    });
  }

  public async create(trainerId: string, dto: CreateExerciseDto) {
    const existing = await this.prisma.exercise.findUnique({
      where: { name_trainerId: { name: dto.name, trainerId } },
    });
    if (existing) throw new ConflictException('Exercise with this name already exists');

    return this.prisma.exercise.create({
      data: { ...dto, trainerId },
    });
  }

  public async update(id: string, trainerId: string, dto: UpdateExerciseDto) {
    const exercise = await this.prisma.exercise.findUnique({ where: { id } });
    if (!exercise) throw new NotFoundException('Exercise not found');
    if (exercise.trainerId !== trainerId) throw new ForbiddenException();

    if (dto.name) {
      const existing = await this.prisma.exercise.findFirst({
        where: { name: dto.name, trainerId, NOT: { id } },
      });
      if (existing) throw new ConflictException('Exercise with this name already exists');
    }

    return this.prisma.exercise.update({
      where: { id },
      data: dto,
    });
  }

  public async remove(id: string, trainerId: string) {
    const exercise = await this.prisma.exercise.findUnique({ where: { id } });
    if (!exercise) throw new NotFoundException('Exercise not found');
    if (exercise.trainerId !== trainerId) throw new ForbiddenException();

    await this.prisma.exercise.delete({ where: { id } });
    return { message: 'Exercise deleted' };
  }

  // Получить историю весов для упражнения по клиенту
  private async getWeightHistory(exerciseId: string, clientId: string) {
    const exercise = await this.prisma.exercise.findUnique({ where: { id: exerciseId } });
    if (!exercise) throw new NotFoundException('Exercise not found');

    const workoutExercises = await this.prisma.workoutExercise.findMany({
      where: {
        exerciseId,
        workout: {
          season: { trainerClient: { clientId } },
        },
      },
      include: { workout: { select: { date: true, id: true } } },
      orderBy: { workout: { date: 'asc' } },
    });

    const history = workoutExercises.map((we) => {
      let maxWeight: number | null = null;

      if (we.setWeights) {
        try {
          const weights: number[] = JSON.parse(we.setWeights).filter((w: any) => typeof w === 'number' && w > 0);
          if (weights.length) maxWeight = Math.max(...weights);
        } catch {}
      }
      if (maxWeight === null && we.weight) {
        maxWeight = we.weight;
      }

      return {
        date: we.workout.date,
        workoutId: we.workout.id,
        weight: maxWeight,
        sets: we.sets,
        reps: we.reps,
        setReps: we.setReps ? JSON.parse(we.setReps) : null,
        setWeights: we.setWeights ? JSON.parse(we.setWeights) : null,
      };
    });

    return { exercise, history };
  }

  public async getProgress(exerciseId: string, clientId: string) {
    const { exercise, history } = await this.getWeightHistory(exerciseId, clientId);
    return { exercise, history };
  }

  public async getProgressAnalysis(exerciseId: string, clientId: string) {
    const { exercise, history } = await this.getWeightHistory(exerciseId, clientId);

    const weighted = history.filter((h) => h.weight !== null);

    if (weighted.length < 2) {
      return {
        exercise,
        history,
        analysis: 'Недостаточно данных для анализа. Нужно хотя бы 2 тренировки с этим упражнением и весом.',
      };
    }

    const first = weighted[0];
    const last = weighted[weighted.length - 1];
    const totalGain = (last.weight ?? 0) - (first.weight ?? 0);
    const daysDiff = Math.max(
      1,
      (new Date(last.date).getTime() - new Date(first.date).getTime()) / (1000 * 60 * 60 * 24),
    );

    const dataForAi = weighted.map((h) => ({
      date: new Date(h.date).toISOString().split('T')[0],
      weight: h.weight,
      sets: h.sets,
      reps: h.reps,
    }));

    const systemPrompt = `Ты опытный персональный тренер. Анализируй прогрессию веса в упражнении и давай чёткие рекомендации на русском языке. Не более 200 слов.`;
    const userMessage = `Упражнение: ${exercise.name}
История весов:
${JSON.stringify(dataForAi, null, 2)}

Первая тренировка: ${first.weight} кг (${new Date(first.date).toLocaleDateString('ru')})
Последняя тренировка: ${last.weight} кг (${new Date(last.date).toLocaleDateString('ru')})
Общий прирост: ${totalGain > 0 ? '+' : ''}${totalGain.toFixed(1)} кг за ${Math.round(daysDiff)} дней

Дай краткий анализ прогрессии и 2-3 практических рекомендации по дальнейшему развитию.`;

    const { text } = await this.aiGateway.complete(systemPrompt, userMessage);

    return {
      exercise,
      history,
      stats: {
        firstWeight: first.weight,
        lastWeight: last.weight,
        totalGain: parseFloat(totalGain.toFixed(1)),
        periodDays: Math.round(daysDiff),
        sessionsCount: weighted.length,
      },
      analysis: text,
    };
  }

  // Тренер смотрит прогрессию клиента
  public async getClientProgress(exerciseId: string, clientId: string, trainerId: string) {
    const relation = await this.prisma.trainerClient.findFirst({ where: { trainerId, clientId } });
    if (!relation) throw new NotFoundException('Клиент не найден');
    return this.getProgress(exerciseId, clientId);
  }

  public async getClientProgressAnalysis(exerciseId: string, clientId: string, trainerId: string) {
    const relation = await this.prisma.trainerClient.findFirst({ where: { trainerId, clientId } });
    if (!relation) throw new NotFoundException('Клиент не найден');
    return this.getProgressAnalysis(exerciseId, clientId);
  }
}
