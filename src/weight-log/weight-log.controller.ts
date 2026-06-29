import { Controller, Get, Post, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/roles.decorator';
import { WeightLogService } from './weight-log.service';
import { CreateWeightLogDto } from './dto/weight-log.dto';
import { Role } from '@prisma/client';

@ApiTags('Weight Log')
@ApiBearerAuth('JWT')
@Controller('weight-log')
@UseGuards(JwtAuthGuard, RolesGuard)
export class WeightLogController {
  constructor(private readonly weightLogService: WeightLogService) {}

  @Post()
  @Roles(Role.CLIENT, Role.TRAINER_CLIENT)
  @ApiOperation({ summary: 'Клиент: добавить запись веса' })
  @ApiResponse({ status: 201, description: 'Запись добавлена' })
  addEntry(@CurrentUser() user: any, @Body() dto: CreateWeightLogDto) {
    return this.weightLogService.addEntry(user.id, dto);
  }

  @Get()
  @Roles(Role.CLIENT, Role.TRAINER_CLIENT)
  @ApiOperation({ summary: 'Клиент: история веса' })
  @ApiResponse({ status: 200, description: 'Список записей' })
  getHistory(@CurrentUser() user: any) {
    return this.weightLogService.getHistory(user.id);
  }

  @Get('analysis')
  @Roles(Role.CLIENT, Role.TRAINER_CLIENT)
  @ApiOperation({ summary: 'Клиент: AI-анализ динамики веса' })
  @ApiResponse({ status: 200, description: 'Статистика и анализ от AI' })
  getAnalysis(@CurrentUser() user: any) {
    return this.weightLogService.getAnalysis(user.id);
  }

  @Delete(':id')
  @Roles(Role.CLIENT, Role.TRAINER_CLIENT)
  @ApiOperation({ summary: 'Клиент: удалить запись' })
  @ApiParam({ name: 'id', description: 'ID записи' })
  deleteEntry(@CurrentUser() user: any, @Param('id') id: string) {
    return this.weightLogService.deleteEntry(id, user.id);
  }

  // Тренер смотрит данные клиента
  @Get('client/:clientId')
  @Roles(Role.TRAINER, Role.TRAINER_CLIENT)
  @ApiOperation({ summary: 'Тренер: история веса клиента' })
  @ApiParam({ name: 'clientId', description: 'ID клиента' })
  getClientHistory(@CurrentUser() user: any, @Param('clientId') clientId: string) {
    return this.weightLogService.getClientHistory(clientId, user.id);
  }

  @Get('client/:clientId/analysis')
  @Roles(Role.TRAINER, Role.TRAINER_CLIENT)
  @ApiOperation({ summary: 'Тренер: AI-анализ динамики веса клиента' })
  @ApiParam({ name: 'clientId', description: 'ID клиента' })
  getClientAnalysis(@CurrentUser() user: any, @Param('clientId') clientId: string) {
    return this.weightLogService.getClientAnalysis(clientId, user.id);
  }
}
