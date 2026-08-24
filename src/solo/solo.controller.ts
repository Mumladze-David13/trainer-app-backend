// src/solo/solo.controller.ts
import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles, CurrentUser } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { SoloService } from './solo.service';
import { CreateSoloProfileDto } from './dto/create-solo-profile.dto';

@ApiTags('Solo')
@ApiBearerAuth('JWT')
@Controller('solo')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SOLO)
export class SoloController {
  constructor(private readonly soloService: SoloService) {}

  @Post('profile')
  @ApiOperation({ summary: 'Создать/обновить профиль SOLO (онбординг)' })
  @ApiResponse({ status: 201, description: 'Профиль сохранён' })
  createProfile(@CurrentUser() user: any, @Body() dto: CreateSoloProfileDto) {
    return this.soloService.createProfile(user.id, dto);
  }

  @Get('profile')
  @ApiOperation({ summary: 'Получить профиль SOLO' })
  @ApiResponse({ status: 200, description: 'Профиль (или null, если ещё не заполнен)' })
  getProfile(@CurrentUser() user: any) {
    return this.soloService.getProfile(user.id);
  }

  @Post('agree-terms')
  @ApiOperation({ summary: 'Принять условия ответственности перед началом тренировок' })
  @ApiResponse({ status: 201, description: 'Условия приняты' })
  agreeToTerms(@CurrentUser() user: any) {
    return this.soloService.agreeToTerms(user.id);
  }

  @Post('generate-program')
  @ApiOperation({ summary: 'AI генерирует начальную программу тренировок' })
  @ApiResponse({ status: 201, description: 'Программа создана' })
  @ApiResponse({ status: 403, description: 'Профиль не заполнен или условия не приняты' })
  generateProgram(@CurrentUser() user: any) {
    return this.soloService.generateInitialProgram(user.id);
  }

  @Get('current-season')
  @ApiOperation({ summary: 'Текущий активный сезон с тренировками' })
  @ApiResponse({ status: 200, description: 'Сезон или null' })
  getCurrentSeason(@CurrentUser() user: any) {
    return this.soloService.getCurrentSeason(user.id);
  }

  @Get('seasons')
  @ApiOperation({ summary: 'История всех SOLO-сезонов' })
  @ApiResponse({ status: 200, description: 'Список сезонов' })
  getSeasons(@CurrentUser() user: any) {
    return this.soloService.getSeasons(user.id);
  }
}
