// src/clients/clients.service.ts
import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ClientsService {
  constructor(private prisma: PrismaService) {}

  async getMyClients(trainerId: string) {
    const relations = await this.prisma.trainerClient.findMany({
      where: { trainerId },
      include: {
        client: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        seasons: {
          orderBy: { startDate: 'desc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return relations.map((r) => ({
      relationId: r.id,
      client: r.client,
      lastSeason: r.seasons[0] || null,
    }));
  }

  async addClient(trainerId: string, clientId: string) {
    // Trainer can add themselves
    const client = await this.prisma.user.findUnique({ where: { id: clientId } });
    if (!client) throw new NotFoundException('User not found');

    const existing = await this.prisma.trainerClient.findUnique({
      where: { trainerId_clientId: { trainerId, clientId } },
    });
    if (existing) throw new ConflictException('Client already added');

    return this.prisma.trainerClient.create({
      data: { trainerId, clientId },
      include: {
        client: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
      },
    });
  }

  async removeClient(trainerId: string, clientId: string) {
    const relation = await this.prisma.trainerClient.findUnique({
      where: { trainerId_clientId: { trainerId, clientId } },
    });
    if (!relation) throw new NotFoundException('Client relation not found');

    await this.prisma.trainerClient.delete({ where: { id: relation.id } });
    return { message: 'Client removed' };
  }

  async getClientDetail(trainerId: string, clientId: string) {
    const relation = await this.prisma.trainerClient.findUnique({
      where: { trainerId_clientId: { trainerId, clientId } },
      include: {
        client: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
        seasons: {
          include: {
            workouts: {
              include: { workoutExercises: { include: { exercise: true } } },
              orderBy: { date: 'asc' },
            },
          },
          orderBy: { startDate: 'desc' },
        },
      },
    });
    if (!relation) throw new NotFoundException('Client not found for this trainer');

    const trainerSettings = await this.prisma.trainerSettings.findUnique({
      where: { trainerId },
    });

    return {
      client: relation.client,
      seasons: relation.seasons,
      sessionsPerSeason: trainerSettings?.sessionsPerSeason || 30,
    };
  }
}
