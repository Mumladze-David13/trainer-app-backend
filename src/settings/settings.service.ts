// src/settings/settings.service.ts
import { Injectable } from '@nestjs/common';
import { SubscriptionPlan } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  public async getTrainerSettings(trainerId: string) {
    let settings = await this.prisma.trainerSettings.findUnique({
      where: { trainerId },
    });
    if (!settings) {
      settings = await this.prisma.trainerSettings.create({
        data: { trainerId, sessionsPerSeason: 30 },
      });
    }
    return settings;
  }

  public async updateTrainerSettings(trainerId: string, sessionsPerSeason: number) {
    return this.prisma.trainerSettings.upsert({
      where: { trainerId },
      create: { trainerId, sessionsPerSeason },
      update: { sessionsPerSeason },
    });
  }

  public async updatePlan(trainerId: string, plan: SubscriptionPlan) {
    return this.prisma.trainerSettings.upsert({
      where: { trainerId },
      create: { trainerId, plan },
      update: { plan },
    });
  }

  public async getClientSettings(clientId: string) {
    let settings = await this.prisma.clientSettings.findUnique({
      where: { clientId },
    });
    if (!settings) return { clientId, trainerId: null };
    return settings;
  }

  public async setClientTrainer(clientId: string, trainerId: string | null) {
    // Save client settings
    const settings = await this.prisma.clientSettings.upsert({
      where: { clientId },
      create: { clientId, trainerId },
      update: { trainerId },
    });

    // Auto-create TrainerClient relation so seasons/workouts work
    if (trainerId) {
      await this.prisma.trainerClient.upsert({
        where: { trainerId_clientId: { trainerId, clientId } },
        create: { trainerId, clientId },
        update: {},
      });

      // Ensure trainer has TrainerSettings
      await this.prisma.trainerSettings.upsert({
        where: { trainerId },
        create: { trainerId, sessionsPerSeason: 30 },
        update: {},
      });
    }

    return settings;
  }
}
