import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles, CurrentUser } from '../auth/decorators/roles.decorator';
import { ClientActivitiesService } from './client-activities.service';
import {
  CreateClientActivityDto,
  UpdateClientActivityDto,
  CreateClientActivityLogDto,
} from './dto/client-activity.dto';
import { Role } from '@prisma/client';

@ApiTags('Client Activities')
@ApiBearerAuth('JWT')
@Controller('client-activities')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ClientActivitiesController {
  constructor(private readonly service: ClientActivitiesService) {}

  @Post()
  @Roles(Role.CLIENT, Role.TRAINER_CLIENT, Role.SOLO)
  @ApiOperation({ summary: 'Добавить активность в справочник' })
  create(@CurrentUser() user: any, @Body() dto: CreateClientActivityDto) {
    return this.service.create(user.id, dto);
  }

  @Get()
  @Roles(Role.CLIENT, Role.TRAINER_CLIENT, Role.SOLO)
  @ApiOperation({ summary: 'Список активностей клиента' })
  findAll(@CurrentUser() user: any) {
    return this.service.findAll(user.id);
  }

  @Put(':id')
  @Roles(Role.CLIENT, Role.TRAINER_CLIENT, Role.SOLO)
  @ApiOperation({ summary: 'Обновить активность' })
  @ApiParam({ name: 'id' })
  update(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: UpdateClientActivityDto) {
    return this.service.update(id, user.id, dto);
  }

  @Delete(':id')
  @Roles(Role.CLIENT, Role.TRAINER_CLIENT, Role.SOLO)
  @ApiOperation({ summary: 'Удалить активность' })
  @ApiParam({ name: 'id' })
  remove(@CurrentUser() user: any, @Param('id') id: string) {
    return this.service.remove(id, user.id);
  }

  @Get('trainer/client/:clientId')
  @Roles(Role.TRAINER, Role.TRAINER_CLIENT)
  @ApiOperation({ summary: 'Тренер смотрит справочник активностей клиента' })
  @ApiParam({ name: 'clientId' })
  findClientActivities(@CurrentUser() user: any, @Param('clientId') clientId: string) {
    return this.service.findClientActivities(clientId, user.id);
  }

  // === Лог фактического выполнения ===

  @Post(':id/logs')
  @Roles(Role.CLIENT, Role.TRAINER_CLIENT, Role.SOLO)
  @ApiOperation({ summary: 'Записать выполнение активности (сколько раз / сколько км)' })
  @ApiParam({ name: 'id' })
  addLog(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: CreateClientActivityLogDto,
  ) {
    return this.service.addLog(id, user.id, dto);
  }

  @Get(':id/logs')
  @Roles(Role.CLIENT, Role.TRAINER_CLIENT, Role.SOLO)
  @ApiOperation({ summary: 'История выполнения активности' })
  @ApiParam({ name: 'id' })
  getLogs(@CurrentUser() user: any, @Param('id') id: string) {
    return this.service.getLogs(id, user.id);
  }

  @Delete(':id/logs/:logId')
  @Roles(Role.CLIENT, Role.TRAINER_CLIENT, Role.SOLO)
  @ApiOperation({ summary: 'Удалить запись выполнения активности' })
  @ApiParam({ name: 'id' })
  @ApiParam({ name: 'logId' })
  removeLog(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Param('logId') logId: string,
  ) {
    return this.service.removeLog(id, logId, user.id);
  }
}
