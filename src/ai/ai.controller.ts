import { Controller, Post, Get, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/roles.decorator';
import { AiService } from './ai.service';
import { GenerateProgramDto, SaveGeneratedProgramDto } from './dto/generate-program.dto';
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
}
