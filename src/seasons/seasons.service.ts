// src/seasons/seasons.service.ts
import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSeasonDto } from './dto/create-season.dto';

@Injectable()
export class SeasonsService {
  constructor(private readonly prisma: PrismaService) {}

  private async getRelation(trainerId: string, clientId: string) {
    const relation = await this.prisma.trainerClient.findUnique({
      where: { trainerId_clientId: { trainerId, clientId } },
    });
    if (!relation) throw new ForbiddenException('Client not in your list');
    return relation;
  }

  public async createSeason(trainerId: string, clientId: string, dto: CreateSeasonDto) {
    const relation = await this.getRelation(trainerId, clientId);

    // Считаем сколько сезонов уже есть — номер следующего = count + 1
    const count = await this.prisma.season.count({
      where: { trainerClientId: relation.id },
    });
    const seasonNumber = count + 1;
    const autoName = `Сезон ${seasonNumber}`;

    return this.prisma.season.create({
      data: {
        name: autoName,
        startDate: new Date(dto.startDate),
        endDate: dto.endDate ? new Date(dto.endDate) : null,
        trainerClientId: relation.id,
        isActive: true,
      },
    });
  }

  public async getSeasons(trainerId: string, clientId: string) {
    const relation = await this.getRelation(trainerId, clientId);
    return this.prisma.season.findMany({
      where: { trainerClientId: relation.id },
      include: {
        workouts: {
          orderBy: { date: 'asc' },
          include: {
            workoutExercises: {
              include: { exercise: true },
              orderBy: { order: 'asc' },
            },
            completion: true,
          },
        },
      },
      orderBy: { startDate: 'desc' },
    });
  }

  public async updateSeason(seasonId: string, trainerId: string, data: Partial<CreateSeasonDto>) {
    const season = await this.prisma.season.findUnique({
      where: { id: seasonId },
      include: { trainerClient: true },
    });
    if (!season) throw new NotFoundException('Season not found');
    if (season.trainerClient.trainerId !== trainerId) throw new ForbiddenException();

    return this.prisma.season.update({
      where: { id: seasonId },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.startDate && { startDate: new Date(data.startDate) }),
        ...(data.endDate !== undefined && {
          endDate: data.endDate ? new Date(data.endDate) : null,
        }),
      },
    });
  }
}
