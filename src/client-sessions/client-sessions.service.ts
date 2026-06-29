import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateClientSessionDto, UpdateClientSessionDto } from './dto/client-session.dto';

@Injectable()
export class ClientSessionsService {
  constructor(private readonly prisma: PrismaService) {}

  // Рассчитать сожжённые калории для набора упражнений
  static calcBurnedCalories(
    exercises: Array<{ metValue?: number | null; durationMinutes?: number | null; sets?: number | null; reps?: number | null; weight?: number | null }>,
    clientWeightKg: number,
  ): number {
    let total = 0;
    for (const ex of exercises) {
      if (ex.metValue && ex.durationMinutes) {
        // MET-формула: ккал = MET × вес(кг) × время(ч)
        total += ex.metValue * clientWeightKg * (ex.durationMinutes / 60);
      } else if (ex.sets && ex.reps && ex.weight) {
        // Силовые упражнения: упрощённая формула
        total += ex.sets * ex.reps * ex.weight * 0.000175;
      } else if (ex.sets && ex.reps) {
        // Без веса (плитки, собственный вес): ~0.3 ккал/повтор
        total += ex.sets * ex.reps * 0.3;
      }
    }
    return parseFloat(total.toFixed(1));
  }

  async create(clientId: string, dto: CreateClientSessionDto) {
    return this.prisma.clientSession.create({
      data: {
        clientId,
        notes: dto.notes,
        exercises: {
          create: dto.exercises.map((ex) => ({
            exerciseId: ex.exerciseId ?? null,
            activityName: ex.activityName ?? null,
            sets: ex.sets ?? null,
            reps: ex.reps ?? null,
            weight: ex.weight ?? null,
            durationMinutes: ex.durationMinutes ?? null,
            order: ex.order,
          })),
        },
      },
      include: { exercises: { include: { exercise: true }, orderBy: { order: 'asc' } } },
    });
  }

  async findAll(clientId: string) {
    return this.prisma.clientSession.findMany({
      where: { clientId },
      include: { exercises: { include: { exercise: true }, orderBy: { order: 'asc' } } },
      orderBy: { date: 'desc' },
    });
  }

  async findOne(id: string, clientId: string) {
    const session = await this.prisma.clientSession.findUnique({
      where: { id },
      include: { exercises: { include: { exercise: true }, orderBy: { order: 'asc' } } },
    });
    if (!session) throw new NotFoundException('Занятие не найдено');
    if (session.clientId !== clientId) throw new ForbiddenException();
    return session;
  }

  async update(id: string, clientId: string, dto: UpdateClientSessionDto) {
    const session = await this.prisma.clientSession.findUnique({ where: { id }, include: { exercises: true } });
    if (!session) throw new NotFoundException('Занятие не найдено');
    if (session.clientId !== clientId) throw new ForbiddenException();

    if (dto.exercises) {
      await this.prisma.clientSessionExercise.deleteMany({ where: { sessionId: id } });
      await this.prisma.clientSessionExercise.createMany({
        data: dto.exercises.map((ex) => ({
          sessionId: id,
          exerciseId: ex.exerciseId ?? null,
          activityName: ex.activityName ?? null,
          sets: ex.sets ?? null,
          reps: ex.reps ?? null,
          weight: ex.weight ?? null,
          durationMinutes: ex.durationMinutes ?? null,
          order: ex.order,
        })),
      });
    }

    return this.prisma.clientSession.update({
      where: { id },
      data: { ...(dto.notes !== undefined && { notes: dto.notes }) },
      include: { exercises: { include: { exercise: true }, orderBy: { order: 'asc' } } },
    });
  }

  async remove(id: string, clientId: string) {
    const session = await this.prisma.clientSession.findUnique({ where: { id } });
    if (!session) throw new NotFoundException('Занятие не найдено');
    if (session.clientId !== clientId) throw new ForbiddenException();
    await this.prisma.clientSession.delete({ where: { id } });
    return { message: 'Занятие удалено' };
  }

  // Тренер смотрит занятия клиента
  async findClientSessions(clientId: string, trainerId: string) {
    const relation = await this.prisma.trainerClient.findFirst({ where: { trainerId, clientId } });
    if (!relation) throw new NotFoundException('Клиент не найден');
    return this.prisma.clientSession.findMany({
      where: { clientId },
      include: { exercises: { include: { exercise: true }, orderBy: { order: 'asc' } } },
      orderBy: { date: 'desc' },
    });
  }

  // Сожжённые калории за день (из тренерских тренировок + клиентских занятий)
  async getBurnedCaloriesForDate(clientId: string, date: string) {
    const targetDate = new Date(date);
    const nextDate = new Date(targetDate);
    nextDate.setDate(nextDate.getDate() + 1);

    const profile = await this.prisma.nutritionProfile.findUnique({ where: { clientId } });
    const clientWeight = profile?.weightKg ?? 70;

    const [trainerWorkouts, clientSessions] = await Promise.all([
      this.prisma.workout.findMany({
        where: {
          isCompleted: true,
          season: { trainerClient: { clientId } },
          updatedAt: { gte: targetDate, lt: nextDate },
        },
        include: { workoutExercises: { include: { exercise: true } } },
      }),
      this.prisma.clientSession.findMany({
        where: { clientId, date: { gte: targetDate, lt: nextDate } },
        include: { exercises: { include: { exercise: true } } },
      }),
    ]);

    let burned = 0;

    for (const workout of trainerWorkouts) {
      const exData = workout.workoutExercises
        .filter((we) => we.isDone)
        .map((we) => ({
          metValue: we.exercise.metValue,
          durationMinutes: we.durationMinutes,
          sets: we.sets,
          reps: we.reps,
          weight: we.weight,
        }));
      burned += ClientSessionsService.calcBurnedCalories(exData, clientWeight);
    }

    for (const session of clientSessions) {
      const exData = session.exercises.map((ex) => ({
        metValue: ex.exercise?.metValue ?? null,
        durationMinutes: ex.durationMinutes,
        sets: ex.sets,
        reps: ex.reps,
        weight: ex.weight,
      }));
      burned += ClientSessionsService.calcBurnedCalories(exData, clientWeight);
    }

    return { date, burnedCalories: parseFloat(burned.toFixed(1)) };
  }
}
