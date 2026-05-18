// src/exercises/exercises.service.ts
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateExerciseDto, UpdateExerciseDto } from './dto/create-exercise.dto';

@Injectable()
export class ExercisesService {
  constructor(private prisma: PrismaService) {}

  async findAll(trainerId: string) {
    return this.prisma.exercise.findMany({
      where: { trainerId },
      orderBy: { name: 'asc' },
    });
  }

  async create(trainerId: string, dto: CreateExerciseDto) {
    const existing = await this.prisma.exercise.findUnique({
      where: { name_trainerId: { name: dto.name, trainerId } },
    });
    if (existing) throw new ConflictException('Exercise with this name already exists');

    return this.prisma.exercise.create({
      data: { ...dto, trainerId },
    });
  }

  async update(id: string, trainerId: string, dto: UpdateExerciseDto) {
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

  async remove(id: string, trainerId: string) {
    const exercise = await this.prisma.exercise.findUnique({ where: { id } });
    if (!exercise) throw new NotFoundException('Exercise not found');
    if (exercise.trainerId !== trainerId) throw new ForbiddenException();

    await this.prisma.exercise.delete({ where: { id } });
    return { message: 'Exercise deleted' };
  }
}
