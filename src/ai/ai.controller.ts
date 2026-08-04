import { Controller, Post, Get, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/roles.decorator';
import { AiService } from './ai.service';
import { GenerateProgramDto, SaveGeneratedProgramDto } from './dto/generate-program.dto';
import {
  ParseMealDto,
  LogMealDto,
  GenerateMealPlanDto,
  SaveMealPlanDto,
} from './dto/meal-ai.dto';
import { Role } from '@prisma/client';

@ApiTags('AI')
@ApiBearerAuth('JWT')
@Controller('ai')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('generate-program')
  @Roles(Role.TRAINER, Role.TRAINER_CLIENT)
  @ApiOperation({ summary: 'Сгенерировать программу тренировок через Claude AI (предпросмотр)' })
  @ApiResponse({ status: 201, description: 'Программа сгенерирована — workouts, recommendations, usage' })
  @ApiResponse({ status: 403, description: 'Исчерпан месячный лимит токенов тарифа' })
  @ApiResponse({ status: 404, description: 'Клиент не найден' })
  generateProgram(@Body() dto: GenerateProgramDto, @CurrentUser() user: any) {
    return this.aiService.generateProgram(dto, user.id);
  }

  @Post('save-program')
  @Roles(Role.TRAINER, Role.TRAINER_CLIENT)
  @ApiOperation({ summary: 'Сохранить сгенерированную программу в сезон' })
  @ApiResponse({ status: 201, description: 'Тренировки созданы в сезоне' })
  @ApiResponse({ status: 404, description: 'Сезон не найден' })
  saveProgram(@Body() dto: SaveGeneratedProgramDto, @CurrentUser() user: any) {
    return this.aiService.saveGeneratedProgram(dto, user.id);
  }

  @Get('usage')
  @Roles(Role.TRAINER, Role.TRAINER_CLIENT)
  @ApiOperation({ summary: 'Статистика использования AI: токены, стоимость, история запросов' })
  @ApiResponse({ status: 200, description: 'Статистика текущего месяца и последние 20 запросов' })
  getUsage(@CurrentUser() user: any) {
    return this.aiService.getUsage(user.id);
  }

  @Post('parse-meal')
  @Roles(Role.TRAINER, Role.TRAINER_CLIENT)
  @ApiOperation({ summary: 'Распознать состав и граммовку еды по тексту (предпросмотр, не сохраняет в БД)' })
  @ApiResponse({ status: 201, description: 'Список позиций с КБЖУ и граммовками' })
  @ApiResponse({ status: 403, description: 'Исчерпан месячный лимит токенов тарифа' })
  parseMeal(@Body() dto: ParseMealDto, @CurrentUser() user: any) {
    return this.aiService.parseMeal(dto, user.id);
  }

  @Post('log-meal')
  @Roles(Role.TRAINER, Role.TRAINER_CLIENT)
  @ApiOperation({ summary: 'Сохранить распознанный приём пищи в дневник клиента' })
  @ApiResponse({ status: 201, description: 'Приём пищи сохранён' })
  @ApiResponse({ status: 403, description: 'Клиент не назначен тренеру' })
  @ApiResponse({ status: 404, description: 'Профиль питания не найден' })
  logMeal(@Body() dto: LogMealDto, @CurrentUser() user: any) {
    return this.aiService.logMeal(dto, user.id);
  }

  @Post('generate-meal-plan')
  @Roles(Role.TRAINER, Role.TRAINER_CLIENT)
  @ApiOperation({ summary: 'Сгенерировать меню на день под целевые КБЖУ (предпросмотр, не сохраняет в БД)' })
  @ApiResponse({ status: 201, description: 'Меню сгенерировано — meals, totals, usage' })
  @ApiResponse({ status: 403, description: 'Исчерпан месячный лимит токенов тарифа' })
  @ApiResponse({ status: 404, description: 'Клиент или профиль питания не найден' })
  generateMealPlan(@Body() dto: GenerateMealPlanDto, @CurrentUser() user: any) {
    return this.aiService.generateMealPlan(dto, user.id);
  }

  @Post('save-meal-plan')
  @Roles(Role.TRAINER, Role.TRAINER_CLIENT)
  @ApiOperation({ summary: 'Сохранить сгенерированное меню в дневник клиента' })
  @ApiResponse({ status: 201, description: 'Меню сохранено' })
  @ApiResponse({ status: 403, description: 'Клиент не назначен тренеру' })
  @ApiResponse({ status: 404, description: 'Профиль питания не найден' })
  saveMealPlan(@Body() dto: SaveMealPlanDto, @CurrentUser() user: any) {
    return this.aiService.saveMealPlan(dto, user.id);
  }
}
