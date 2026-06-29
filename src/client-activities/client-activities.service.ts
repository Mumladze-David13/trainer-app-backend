import { Injectable, NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateClientActivityDto, UpdateClientActivityDto } from './dto/client-activity.dto';

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
}
