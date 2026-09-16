import { Injectable, NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateClientActivityDto,
  UpdateClientActivityDto,
  CreateClientActivityLogDto,
} from './dto/client-activity.dto';

@Injectable()
export class ClientActivitiesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(clientId: string, dto: CreateClientActivityDto) {
    const existing = await this.prisma.clientActivity.findUnique({
      where: { name_clientId: { name: dto.name, clientId } },
    });
    if (existing) throw new ConflictException('Активность с таким названием уже существует');

    return this.prisma.clientActivity.create({
      data: { clientId, ...dto },
    });
  }

  async findAll(clientId: string) {
    return this.prisma.clientActivity.findMany({
      where: { clientId },
      orderBy: { name: 'asc' },
    });
  }

  async update(id: string, clientId: string, dto: UpdateClientActivityDto) {
    const activity = await this.prisma.clientActivity.findUnique({ where: { id } });
    if (!activity) throw new NotFoundException('Активность не найдена');
    if (activity.clientId !== clientId) throw new ForbiddenException();

    if (dto.name) {
      const conflict = await this.prisma.clientActivity.findFirst({
        where: { name: dto.name, clientId, NOT: { id } },
      });
      if (conflict) throw new ConflictException('Активность с таким названием уже существует');
    }

    return this.prisma.clientActivity.update({ where: { id }, data: dto });
  }

  async remove(id: string, clientId: string) {
    const activity = await this.prisma.clientActivity.findUnique({ where: { id } });
    if (!activity) throw new NotFoundException('Активность не найдена');
    if (activity.clientId !== clientId) throw new ForbiddenException();
    await this.prisma.clientActivity.delete({ where: { id } });
    return { message: 'Активность удалена' };
  }

  async findClientActivities(clientId: string, trainerId: string) {
    const relation = await this.prisma.trainerClient.findFirst({ where: { trainerId, clientId } });
    if (!relation) throw new NotFoundException('Клиент не найден');
    return this.findAll(clientId);
  }

  // === Лог фактического выполнения (сколько раз / сколько км) ===

  private async getOwnActivity(activityId: string, clientId: string) {
    const activity = await this.prisma.clientActivity.findUnique({ where: { id: activityId } });
    if (!activity) throw new NotFoundException('Активность не найдена');
    if (activity.clientId !== clientId) throw new ForbiddenException();
    return activity;
  }

  async addLog(activityId: string, clientId: string, dto: CreateClientActivityLogDto) {
    await this.getOwnActivity(activityId, clientId);
    return this.prisma.clientActivityLog.create({
      data: {
        clientActivityId: activityId,
        value: dto.value,
        ...(dto.date && { date: new Date(dto.date) }),
      },
    });
  }

  async getLogs(activityId: string, clientId: string) {
    await this.getOwnActivity(activityId, clientId);
    return this.prisma.clientActivityLog.findMany({
      where: { clientActivityId: activityId },
      orderBy: { date: 'desc' },
    });
  }

  async removeLog(activityId: string, logId: string, clientId: string) {
    await this.getOwnActivity(activityId, clientId);
    const log = await this.prisma.clientActivityLog.findUnique({ where: { id: logId } });
    if (!log || log.clientActivityId !== activityId) throw new NotFoundException('Запись не найдена');
    await this.prisma.clientActivityLog.delete({ where: { id: logId } });
    return { message: 'Запись удалена' };
  }
}
