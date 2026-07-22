import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WeightType } from '@prisma/client';
import { QueryGlobalExerciseDto } from './dto/query-global-exercise.dto';
import { ImportGlobalExerciseDto } from './dto/import-global-exercise.dto';

function weightTypeForEquipment(equipment: string | null): WeightType {
  if (equipment === 'штанга' || equipment === 'гантели') return WeightType.WEIGHT_KG;
  if (equipment === 'тренажёр') return WeightType.MACHINE;
  return WeightType.BODYWEIGHT;
}

@Injectable()
export class GlobalExercisesService {
  constructor(private readonly prisma: PrismaService) {}

  public async findAll(query: QueryGlobalExerciseDto) {
    return this.prisma.globalExercise.findMany({
      where: {
        category: query.category ?? undefined,
        equipment: query.equipment ?? undefined,
        level: query.level ?? undefined,
        name: query.search ? { contains: query.search, mode: 'insensitive' } : undefined,
      },
      orderBy: { name: 'asc' },
    });
  }

  public async import(trainerId: string, dto: ImportGlobalExerciseDto) {
    const source = await this.prisma.globalExercise.findMany({
      where: dto.ids?.length ? { id: { in: dto.ids } } : undefined,
    });

    if (dto.ids?.length && source.length !== dto.ids.length) {
      throw new NotFoundException('Некоторые упражнения из справочника не найдены');
    }

    const result = await this.prisma.trainerExercise.createMany({
      data: source.map((g) => ({
        name: g.name,
        description: g.description,
        trainerId,
        weightType: weightTypeForEquipment(g.equipment),
        equipment: g.equipment,
        globalExerciseId: g.id,
      })),
      skipDuplicates: true,
    });

    return {
      requested: source.length,
      imported: result.count,
      skipped: source.length - result.count,
    };
  }
}
