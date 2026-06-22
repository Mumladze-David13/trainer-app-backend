import { Controller, Get, Put, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { SubscriptionPlan } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/roles.decorator';
import { SettingsService } from './settings.service';
import { Role } from '@prisma/client';

@ApiTags('Settings')
@ApiBearerAuth('JWT')
@Controller('settings')
@UseGuards(JwtAuthGuard)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get('trainer')
  @UseGuards(RolesGuard)
  @Roles(Role.TRAINER, Role.TRAINER_CLIENT)
  @ApiOperation({ summary: 'Получить настройки тренера (лимиты, тариф)' })
  @ApiResponse({ status: 200, description: 'Настройки тренера' })
  public getTrainerSettings(@CurrentUser() user: any) {
    return this.settingsService.getTrainerSettings(user.id);
  }

  @Put('trainer')
  @UseGuards(RolesGuard)
  @Roles(Role.TRAINER, Role.TRAINER_CLIENT)
  @ApiOperation({ summary: 'Обновить лимит тренировок в сезоне' })
  @ApiBody({ schema: { properties: { sessionsPerSeason: { type: 'number', example: 30 } } } })
  @ApiResponse({ status: 200, description: 'Настройки обновлены' })
  public updateTrainerSettings(
    @CurrentUser() user: any,
    @Body('sessionsPerSeason') sessionsPerSeason: number,
  ) {
    return this.settingsService.updateTrainerSettings(user.id, sessionsPerSeason);
  }

  @Put('trainer/plan')
  @UseGuards(RolesGuard)
  @Roles(Role.TRAINER, Role.TRAINER_CLIENT)
  @ApiOperation({ summary: 'Изменить тарифный план (FREE / BASIC / PRO / UNLIMITED)' })
  @ApiBody({ schema: { properties: { plan: { enum: ['FREE', 'BASIC', 'PRO', 'UNLIMITED'], example: 'BASIC' } } } })
  @ApiResponse({ status: 200, description: 'Тариф обновлён' })
  public updatePlan(
    @CurrentUser() user: any,
    @Body('plan') plan: SubscriptionPlan,
  ) {
    return this.settingsService.updatePlan(user.id, plan);
  }

  @Get('client')
  @ApiOperation({ summary: 'Получить настройки клиента (привязанный тренер)' })
  @ApiResponse({ status: 200, description: 'Настройки клиента' })
  public getClientSettings(@CurrentUser() user: any) {
    return this.settingsService.getClientSettings(user.id);
  }

  @Put('client/trainer')
  @ApiOperation({ summary: 'Привязать клиента к тренеру' })
  @ApiBody({ schema: { properties: { trainerId: { type: 'string', example: 'uuid-тренера', nullable: true } } } })
  @ApiResponse({ status: 200, description: 'Тренер привязан' })
  public setClientTrainer(
    @CurrentUser() user: any,
    @Body('trainerId') trainerId: string | null,
  ) {
    return this.settingsService.setClientTrainer(user.id, trainerId);
  }
}
