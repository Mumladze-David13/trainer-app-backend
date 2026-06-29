import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/roles.decorator';
import { ClientSessionsService } from './client-sessions.service';
import { CreateClientSessionDto, UpdateClientSessionDto } from './dto/client-session.dto';
import { Role } from '@prisma/client';

@ApiTags('Client Sessions')
@ApiBearerAuth('JWT')
@Controller('client-sessions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ClientSessionsController {
  constructor(private readonly clientSessionsService: ClientSessionsService) {}

  @Post()
  @Roles(Role.CLIENT, Role.TRAINER_CLIENT)
  @ApiOperation({ summary: 'Клиент: добавить самостоятельное занятие' })
  @ApiResponse({ status: 201, description: 'Занятие создано' })
  create(@CurrentUser() user: any, @Body() dto: CreateClientSessionDto) {
    return this.clientSessionsService.create(user.id, dto);
  }

  @Get()
  @Roles(Role.CLIENT, Role.TRAINER_CLIENT)
  @ApiOperation({ summary: 'Клиент: список своих занятий' })
  @ApiResponse({ status: 200, description: 'Список занятий' })
  findAll(@CurrentUser() user: any) {
    return this.clientSessionsService.findAll(user.id);
  }

  @Get('burned-calories')
  @Roles(Role.CLIENT, Role.TRAINER_CLIENT)
  @ApiOperation({ summary: 'Клиент: потраченные калории за день' })
  @ApiQuery({ name: 'date', example: '2026-06-29', description: 'Дата в формате YYYY-MM-DD' })
  @ApiResponse({ status: 200, description: 'Сожжённые калории' })
  getBurnedCalories(@CurrentUser() user: any, @Query('date') date: string) {
    return this.clientSessionsService.getBurnedCaloriesForDate(user.id, date);
  }

  @Get(':id')
  @Roles(Role.CLIENT, Role.TRAINER_CLIENT)
  @ApiOperation({ summary: 'Клиент: получить занятие по ID' })
  @ApiParam({ name: 'id', description: 'ID занятия' })
  findOne(@CurrentUser() user: any, @Param('id') id: string) {
    return this.clientSessionsService.findOne(id, user.id);
  }

  @Put(':id')
  @Roles(Role.CLIENT, Role.TRAINER_CLIENT)
  @ApiOperation({ summary: 'Клиент: обновить занятие' })
  @ApiParam({ name: 'id', description: 'ID занятия' })
  update(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: UpdateClientSessionDto) {
    return this.clientSessionsService.update(id, user.id, dto);
  }

  @Delete(':id')
  @Roles(Role.CLIENT, Role.TRAINER_CLIENT)
  @ApiOperation({ summary: 'Клиент: удалить занятие' })
  @ApiParam({ name: 'id', description: 'ID занятия' })
  remove(@CurrentUser() user: any, @Param('id') id: string) {
    return this.clientSessionsService.remove(id, user.id);
  }

  // Тренер видит занятия клиента
  @Get('trainer/client/:clientId')
  @Roles(Role.TRAINER, Role.TRAINER_CLIENT)
  @ApiOperation({ summary: 'Тренер: самостоятельные занятия клиента' })
  @ApiParam({ name: 'clientId', description: 'ID клиента' })
  getClientSessions(@CurrentUser() user: any, @Param('clientId') clientId: string) {
    return this.clientSessionsService.findClientSessions(clientId, user.id);
  }

  @Get('trainer/client/:clientId/burned-calories')
  @Roles(Role.TRAINER, Role.TRAINER_CLIENT)
  @ApiOperation({ summary: 'Тренер: потраченные калории клиента за день' })
  @ApiParam({ name: 'clientId', description: 'ID клиента' })
  @ApiQuery({ name: 'date', example: '2026-06-29' })
  getClientBurnedCalories(@CurrentUser() user: any, @Param('clientId') clientId: string, @Query('date') date: string) {
    return this.clientSessionsService.getBurnedCaloriesForDate(clientId, date);
  }
}
