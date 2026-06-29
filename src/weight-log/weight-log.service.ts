import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiGateway } from '../ai/ai.gateway';
import { CreateWeightLogDto } from './dto/weight-log.dto';

@Injectable()
export class WeightLogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aiGateway: AiGateway,
  ) {}

  async addEntry(clientId: string, dto: CreateWeightLogDto) {
    return this.prisma.weightLog.create({
      data: { clientId, weightKg: dto.weightKg, notes: dto.notes },
    });
  }

  async getHistory(clientId: string) {
    return this.prisma.weightLog.findMany({
      where: { clientId },
      orderBy: { date: 'asc' },
    });
  }

  async deleteEntry(id: string, clientId: string) {
    const entry = await this.prisma.weightLog.findUnique({ where: { id } });
    if (!entry) throw new NotFoundException('Запись не найдена');
    if (entry.clientId !== clientId) throw new NotFoundException('Запись не найдена');
    await this.prisma.weightLog.delete({ where: { id } });
    return { message: 'Запись удалена' };
  }

  async getAnalysis(clientId: string) {
    const [logs, profile] = await Promise.all([
      this.prisma.weightLog.findMany({
        where: { clientId },
        orderBy: { date: 'asc' },
      }),
      this.prisma.nutritionProfile.findUnique({ where: { clientId } }),
    ]);

    if (logs.length < 2) {
      return {
        logs,
        analysis: 'Недостаточно данных для анализа. Добавьте не менее 2 записей.',
      };
    }

    const first = logs[0];
    const last = logs[logs.length - 1];
    const totalChange = last.weightKg - first.weightKg;
    const daysDiff = Math.max(
      1,
      (new Date(last.date).getTime() - new Date(first.date).getTime()) / (1000 * 60 * 60 * 24),
    );
    const weeklyRate = (totalChange / daysDiff) * 7;

    const dataForAi = logs.map((l) => ({
      date: new Date(l.date).toISOString().split('T')[0],
      weight: l.weightKg,
    }));

    const systemPrompt = `Ты персональный тренер и нутрициолог. Анализируй динамику веса клиента и давай краткие, чёткие рекомендации на русском языке. Не более 200 слов.`;
    const userMessage = `Данные о весе клиента:
${JSON.stringify(dataForAi, null, 2)}

Цель клиента: ${profile?.goal ?? 'не указана'}
Целевое изменение в неделю: ${profile?.targetWeeklyChange ?? 'не указано'} кг

Первое взвешивание: ${first.weightKg} кг (${new Date(first.date).toLocaleDateString('ru')})
Последнее взвешивание: ${last.weightKg} кг (${new Date(last.date).toLocaleDateString('ru')})
Общее изменение: ${totalChange > 0 ? '+' : ''}${totalChange.toFixed(1)} кг за ${Math.round(daysDiff)} дней
Темп: ${weeklyRate > 0 ? '+' : ''}${weeklyRate.toFixed(2)} кг/нед

Дай краткий анализ динамики и 2-3 практических рекомендации.`;

    const { text } = await this.aiGateway.complete(systemPrompt, userMessage);

    return {
      logs,
      stats: {
        firstWeight: first.weightKg,
        lastWeight: last.weightKg,
        totalChange: parseFloat(totalChange.toFixed(2)),
        weeklyRate: parseFloat(weeklyRate.toFixed(2)),
        periodDays: Math.round(daysDiff),
        entriesCount: logs.length,
      },
      analysis: text,
    };
  }

  // Тренер смотрит данные клиента
  async getClientHistory(clientId: string, trainerId: string) {
    const relation = await this.prisma.trainerClient.findFirst({
      where: { trainerId, clientId },
    });
    if (!relation) throw new NotFoundException('Клиент не найден');
    return this.getHistory(clientId);
  }

  async getClientAnalysis(clientId: string, trainerId: string) {
    const relation = await this.prisma.trainerClient.findFirst({
      where: { trainerId, clientId },
    });
    if (!relation) throw new NotFoundException('Клиент не найден');
    return this.getAnalysis(clientId);
  }
}
