// src/users/users.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '@prisma/client';
import { UpdateRoleDto } from './dto/update-role.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  public async findById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        createdAt: true,
        settings: true,
      },
    });
  }

  public async updateRole(userId: string, dto: UpdateRoleDto) {
    const trainerRoles: Role[] = [Role.TRAINER, Role.TRAINER_CLIENT];

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { role: dto.role },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        createdAt: true,
        settings: true,
      },
    });

    if (trainerRoles.includes(dto.role)) {
      await this.prisma.trainerSettings.upsert({
        where: { trainerId: userId },
        create: { trainerId: userId },
        update: {},
      });
    }

    return user;
  }

  public async findAllTrainers() {
    return this.prisma.user.findMany({
      where: {
        role: { in: [Role.TRAINER, Role.TRAINER_CLIENT] },
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        settings: {
          select: { sessionsPerSeason: true },
        },
      },
      orderBy: { firstName: 'asc' },
    });
  }
}
