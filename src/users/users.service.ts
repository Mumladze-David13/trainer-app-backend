// src/users/users.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findById(id: string) {
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

  async findAllTrainers() {
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
