// src/settings/settings.controller.ts
import { Controller, Get, Put, Body, UseGuards } from '@nestjs/common';
import { SubscriptionPlan } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/roles.decorator';
import { SettingsService } from './settings.service';
import { Role } from '@prisma/client';

@Controller('settings')
@UseGuards(JwtAuthGuard)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  // Trainer settings
  @Get('trainer')
  @UseGuards(RolesGuard)
  @Roles(Role.TRAINER, Role.TRAINER_CLIENT)
  public getTrainerSettings(@CurrentUser() user: any) {
    return this.settingsService.getTrainerSettings(user.id);
  }

  @Put('trainer')
  @UseGuards(RolesGuard)
  @Roles(Role.TRAINER, Role.TRAINER_CLIENT)
  public updateTrainerSettings(
    @CurrentUser() user: any,
    @Body('sessionsPerSeason') sessionsPerSeason: number,
  ) {
    return this.settingsService.updateTrainerSettings(user.id, sessionsPerSeason);
  }

  @Put('trainer/plan')
  @UseGuards(RolesGuard)
  @Roles(Role.TRAINER, Role.TRAINER_CLIENT)
  public updatePlan(
    @CurrentUser() user: any,
    @Body('plan') plan: SubscriptionPlan,
  ) {
    return this.settingsService.updatePlan(user.id, plan);
  }

  // Client settings
  @Get('client')
  public getClientSettings(@CurrentUser() user: any) {
    return this.settingsService.getClientSettings(user.id);
  }

  @Put('client/trainer')
  public setClientTrainer(
    @CurrentUser() user: any,
    @Body('trainerId') trainerId: string | null,
  ) {
    return this.settingsService.setClientTrainer(user.id, trainerId);
  }
}
