import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/roles.decorator';
import { ExercisesService } from './exercises.service';
import { CreateExerciseDto, UpdateExerciseDto } from './dto/create-exercise.dto';
import { Role } from '@prisma/client';

@ApiTags('Exercises')
@ApiBearerAuth('JWT')
@Controller('exercises')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ExercisesController {
  constructor(private readonly exercisesService: ExercisesService) {}

  @Get()
  @Roles(Role.TRAINER, Role.TRAINER_CLIENT)
  @ApiOperation({ summary: 'Получить список упражнений тренера' })
  public findAll(@CurrentUser() user: any) {
    return this.exercisesService.findAll(user.id);
  }

  @Post()
  @Roles(Role.TRAINER, Role.TRAINER_CLIENT)
  @ApiOperation({ summary: 'Создать новое упражнение' })
  public create(@CurrentUser() user: any, @Body() dto: CreateExerciseDto) {
    return this.exercisesService.create(user.id, dto);
  }

  @Put(':id')
  @Roles(Role.TRAINER, Role.TRAINER_CLIENT)
  @ApiOperation({ summary: 'Обновить упражнение' })
  @ApiParam({ name: 'id' })
  public update(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: UpdateExerciseDto) {
    return this.exercisesService.update(id, user.id, dto);
  }

  @Delete(':id')
  @Roles(Role.TRAINER, Role.TRAINER_CLIENT)
  @ApiOperation({ summary: 'Удалить упражнение' })
  @ApiParam({ name: 'id' })
  public remove(@CurrentUser() user: any, @Param('id') id: string) {
    return this.exercisesService.remove(id, user.id);
  }

  // === Прогрессия весов (клиент) ===

  @Get(':id/progress')
  @Roles(Role.CLIENT, Role.TRAINER_CLIENT)
  @ApiOperation({ summary: 'История весов клиента по упражнению' })
  @ApiParam({ name: 'id', description: 'ID упражнения' })
  public getProgress(@CurrentUser() user: any, @Param('id') id: string) {
    return this.exercisesService.getProgress(id, user.id);
  }

  @Get(':id/progress/analysis')
  @Roles(Role.CLIENT, Role.TRAINER_CLIENT)
  @ApiOperation({ summary: 'AI-анализ прогрессии весов (клиент)' })
  @ApiParam({ name: 'id', description: 'ID упражнения' })
  public getProgressAnalysis(@CurrentUser() user: any, @Param('id') id: string) {
    return this.exercisesService.getProgressAnalysis(id, user.id);
  }

  // === Прогрессия весов (тренер смотрит клиента) ===

  @Get(':id/progress/client/:clientId')
  @Roles(Role.TRAINER, Role.TRAINER_CLIENT)
  @ApiOperation({ summary: 'Тренер смотрит историю весов клиента по упражнению' })
  @ApiParam({ name: 'id', description: 'ID упражнения' })
  @ApiParam({ name: 'clientId', description: 'ID клиента' })
  public getClientProgress(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Param('clientId') clientId: string,
  ) {
    return this.exercisesService.getClientProgress(id, clientId, user.id);
  }

  @Get(':id/progress/client/:clientId/analysis')
  @Roles(Role.TRAINER, Role.TRAINER_CLIENT)
  @ApiOperation({ summary: 'Тренер получает AI-анализ прогрессии клиента' })
  @ApiParam({ name: 'id' })
  @ApiParam({ name: 'clientId' })
  public getClientProgressAnalysis(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Param('clientId') clientId: string,
  ) {
    return this.exercisesService.getClientProgressAnalysis(id, clientId, user.id);
  }
}
