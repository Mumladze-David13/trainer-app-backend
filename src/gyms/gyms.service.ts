import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateGymDto } from './dto/create-gym.dto';
import { UpdateGymDto } from './dto/update-gym.dto';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class GymsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  public async findAll() {
    return this.prisma.gym.findMany({ orderBy: { name: 'asc' } });
  }

  public async findOne(id: string) {
    const gym = await this.prisma.gym.findUnique({ where: { id } });
    if (!gym) throw new NotFoundException('Gym not found');
    return gym;
  }

  public async create(dto: CreateGymDto) {
    const existing = await this.prisma.gym.findUnique({ where: { name: dto.name } });
    if (existing) throw new ConflictException('Gym with this name already exists');
    return this.prisma.gym.create({ data: { name: dto.name, address: dto.address as any ?? undefined } });
  }

  public async update(id: string, dto: UpdateGymDto) {
    await this.findOne(id);
    if (dto.name) {
      const conflict = await this.prisma.gym.findFirst({ where: { name: dto.name, id: { not: id } } });
      if (conflict) throw new ConflictException('Gym with this name already exists');
    }
    return this.prisma.gym.update({
      where: { id },
      data: { name: dto.name, address: dto.address as any ?? undefined },
    });
  }

  public async remove(id: string) {
    await this.findOne(id);
    return this.prisma.gym.delete({ where: { id } });
  }

  public async suggestAddress(query: string) {
    const apiKey = this.config.get<string>('DADATA_API_KEY');
    if (!apiKey) return { suggestions: [] };
    const response = await axios.post(
      'https://suggestions.dadata.ru/suggestions/api/4_1/rs/suggest/address',
      { query, count: 10 },
      { headers: { Authorization: `Token ${apiKey}`, 'Content-Type': 'application/json' } },
    );
    return response.data;
  }
}