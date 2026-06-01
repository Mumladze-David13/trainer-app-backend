// src/workouts/workouts.service.ts
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWorkoutDto, UpdateWorkoutDto, CompleteWorkoutDto } from './dto/create-workout.dto';

@Injectable()
export class WorkoutsService {
  constructor(private readonly prisma: PrismaService) {}

  private async getSeasonAndValidateTrainer(seasonId: string, trainerId: string) {
    const season = await this.prisma.season.findUnique({
      where: { id: seasonId },
      include: { trainerClient: true },
    });
    if (!season) throw new NotFoundException('Season not found');
    if (season.trainerClient.trainerId !== trainerId) throw new ForbiddenException();
    return season;
  }

  public async createWorkout(trainerId: string, dto: CreateWorkoutDto) {
    const season = await this.getSeasonAndValidateTrainer(dto.seasonId, trainerId);

    // Check season limit
    const trainerSettings = await this.prisma.trainerSettings.findUnique({
      where: { trainerId },
    });
    const limit = trainerSettings?.sessionsPerSeason || 30;

    const count = await this.prisma.workout.count({
      where: { seasonId: dto.seasonId },
    });

    if (count >= limit) {
      throw new BadRequestException(
        `Season workout limit reached (${limit}). Create a new season or increase the limit in settings.`,
      );
    }

    const workout = await this.prisma.workout.create({
      data: {
        seasonId: dto.seasonId,
        notes: dto.notes,
        workoutExercises: {
          create: dto.exercises.map((ex) => ({
            exerciseId: ex.exerciseId,
            sets: ex.sets,
            reps: ex.reps,
            weight: ex.weight,
            order: ex.order,
          })),
        },
      },
      include: {
        workoutExercises: { include: { exercise: true }, orderBy: { order: 'asc' } },
        completion: true,
      },
    });

    return workout;
  }

  public async getWorkout(id: string) {
    const workout = await this.prisma.workout.findUnique({
      where: { id },
      include: {
        workoutExercises: { include: { exercise: true }, orderBy: { order: 'asc' } },
        completion: true,
        season: { include: { trainerClient: true } },
      },
    });
    if (!workout) throw new NotFoundException('Workout not found');
    return workout;
  }

  public async updateWorkout(id: string, trainerId: string, dto: UpdateWorkoutDto) {
    const workout = await this.prisma.workout.findUnique({
      where: { id },
      include: { season: { include: { trainerClient: true } } },
    });
    if (!workout) throw new NotFoundException('Workout not found');
    if (workout.season.trainerClient.trainerId !== trainerId) throw new ForbiddenException();

    // Replace all exercises if provided
    if (dto.exercises) {
      await this.prisma.workoutExercise.deleteMany({ where: { workoutId: id } });
    }

    return this.prisma.workout.update({
      where: { id },
      data: {
        ...(dto.notes !== undefined && { notes: dto.notes }),
        ...(dto.exercises && {
          workoutExercises: {
            create: dto.exercises.map((ex) => ({
              exerciseId: ex.exerciseId,
              sets: ex.sets,
              reps: ex.reps,
              weight: ex.weight,
              order: ex.order,
            })),
          },
        }),
      },
      include: {
        workoutExercises: { include: { exercise: true }, orderBy: { order: 'asc' } },
        completion: true,
      },
    });
  }

  public async deleteWorkout(id: string, trainerId: string) {
    const workout = await this.prisma.workout.findUnique({
      where: { id },
      include: { season: { include: { trainerClient: true } } },
    });
    if (!workout) throw new NotFoundException('Workout not found');
    if (workout.season.trainerClient.trainerId !== trainerId) throw new ForbiddenException();

    await this.prisma.workout.delete({ where: { id } });
    return { message: 'Workout deleted' };
  }

  // CLIENT: Mark exercises done and optionally complete workout
  public async saveProgress(workoutId: string, clientId: string, dto: CompleteWorkoutDto) {
    // Validate client has access to this workout
    const workout = await this.prisma.workout.findUnique({
      where: { id: workoutId },
      include: {
        workoutExercises: true,
        season: { include: { trainerClient: true } },
      },
    });
    if (!workout) throw new NotFoundException('Workout not found');
    if (workout.season.trainerClient.clientId !== clientId) throw new ForbiddenException();

    // Update isDone flags
    await this.prisma.$transaction(
      workout.workoutExercises.map((we) =>
        this.prisma.workoutExercise.update({
          where: { id: we.id },
          data: { isDone: dto.doneExerciseIds.includes(we.id) },
        }),
      ),
    );

    return this.prisma.workout.findUnique({
      where: { id: workoutId },
      include: {
        workoutExercises: { include: { exercise: true }, orderBy: { order: 'asc' } },
        completion: true,
      },
    });
  }

  public async completeWorkout(workoutId: string, clientId: string, dto: CompleteWorkoutDto) {
    const workout = await this.prisma.workout.findUnique({
      where: { id: workoutId },
      include: {
        workoutExercises: true,
        season: { include: { trainerClient: true } },
      },
    });
    if (!workout) throw new NotFoundException('Workout not found');
    if (workout.season.trainerClient.clientId !== clientId) throw new ForbiddenException();

    const total = workout.workoutExercises.length;
    const done = dto.doneExerciseIds.length;
    if (total > 0 && done / total < 0.5) {
      throw new BadRequestException('Complete at least 50% of exercises to mark workout as done');
    }

    // Update exercise flags
    await this.prisma.$transaction(
      workout.workoutExercises.map((we) =>
        this.prisma.workoutExercise.update({
          where: { id: we.id },
          data: { isDone: dto.doneExerciseIds.includes(we.id) },
        }),
      ),
    );

    // Mark completed (upsert in case client re-completes)
    await this.prisma.workoutCompletion.upsert({
      where: { workoutId },
      create: { workoutId, clientId, completedAt: new Date() },
      update: { completedAt: new Date() },
    });

    return this.prisma.workout.update({
      where: { id: workoutId },
      data: { isCompleted: true },
      include: {
        workoutExercises: { include: { exercise: true }, orderBy: { order: 'asc' } },
        completion: true,
      },
    });
  }

  // CLIENT: Get seasons for the client view
  public async getClientSeasons(clientId: string, trainerId: string) {
    const relation = await this.prisma.trainerClient.findUnique({
      where: { trainerId_clientId: { trainerId, clientId } },
    });
    if (!relation) throw new NotFoundException('Trainer-client relation not found');

    return this.prisma.season.findMany({
      where: { trainerClientId: relation.id },
      include: {
        workouts: {
          include: {
            workoutExercises: { include: { exercise: true }, orderBy: { order: 'asc' } },
            completion: true,
          },
          orderBy: { date: 'asc' },
        },
      },
      orderBy: { startDate: 'desc' },
    });
  }
}
