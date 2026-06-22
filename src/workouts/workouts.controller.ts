import { Controller, Get, Post, Put, Delete, Patch, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/roles.decorator';
import { WorkoutsService } from './workouts.service';
import { CreateWorkoutDto, UpdateWorkoutDto, CompleteWorkoutDto } from './dto/create-workout.dto';
import { Role } from '@prisma/client';

@ApiTags('Workouts')
@ApiBearerAuth('JWT')
@Controller('workouts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class WorkoutsController {
  constructor(private readonly workoutsService: WorkoutsService) {}

  @Post()
  @Roles(Role.TRAINER, Role.TRAINER_CLIENT)
  @ApiOperation({ summary: 'Создать тренировку в сезоне' })
  @ApiResponse({ status: 201, description: 'Тренировка создана' })
  @ApiResponse({ status: 400, description: 'Превышен лимит тренировок в сезоне' })
  public createWorkout(@CurrentUser() user: any, @Body() dto: CreateWorkoutDto) {
    return this.workoutsService.createWorkout(user.id, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Получить тренировку по ID' })
  @ApiParam({ name: 'id', description: 'ID тренировки' })
  @ApiResponse({ status: 200, description: 'Тренировка с упражнениями' })
  @ApiResponse({ status: 404, description: 'Тренировка не найдена' })
  public getWorkout(@Param('id') id: string) {
    return this.workoutsService.getWorkout(id);
  }

  @Put(':id')
  @Roles(Role.TRAINER, Role.TRAINER_CLIENT)
  @ApiOperation({ summary: 'Обновить тренировку (заменяет все упражнения)' })
  @ApiParam({ name: 'id', description: 'ID тренировки' })
  @ApiResponse({ status: 200, description: 'Тренировка обновлена' })
  @ApiResponse({ status: 404, description: 'Тренировка не найдена' })
  public updateWorkout(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: UpdateWorkoutDto) {
    return this.workoutsService.updateWorkout(id, user.id, dto);
  }

  @Delete(':id')
  @Roles(Role.TRAINER, Role.TRAINER_CLIENT)
  @ApiOperation({ summary: 'Удалить тренировку' })
  @ApiParam({ name: 'id', description: 'ID тренировки' })
  @ApiResponse({ status: 200, description: 'Тренировка удалена' })
  public deleteWorkout(@CurrentUser() user: any, @Param('id') id: string) {
    return this.workoutsService.deleteWorkout(id, user.id);
  }

  @Patch(':id/progress')
  @Roles(Role.CLIENT, Role.TRAINER_CLIENT)
  @ApiOperation({ summary: 'Сохранить прогресс выполнения (без завершения)' })
  @ApiParam({ name: 'id', description: 'ID тренировки' })
  @ApiResponse({ status: 200, description: 'Прогресс сохранён' })
  public saveProgress(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: CompleteWorkoutDto) {
    return this.workoutsService.saveProgress(id, user.id, dto);
  }

  @Post(':id/complete')
  @Roles(Role.CLIENT, Role.TRAINER_CLIENT)
  @ApiOperation({ summary: 'Завершить тренировку (требует ≥50% выполненных упражнений)' })
  @ApiParam({ name: 'id', description: 'ID тренировки' })
  @ApiResponse({ status: 201, description: 'Тренировка завершена' })
  @ApiResponse({ status: 400, description: 'Выполнено менее 50% упражнений' })
  public completeWorkout(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: CompleteWorkoutDto) {
    return this.workoutsService.completeWorkout(id, user.id, dto);
  }

  @Get('client/:trainerId/seasons')
  @Roles(Role.CLIENT, Role.TRAINER_CLIENT)
  @ApiOperation({ summary: 'Клиент: получить свои сезоны от конкретного тренера' })
  @ApiParam({ name: 'trainerId', description: 'ID тренера' })
  @ApiResponse({ status: 200, description: 'Список сезонов с тренировками' })
  public getClientSeasons(@CurrentUser() user: any, @Param('trainerId') trainerId: string) {
    return this.workoutsService.getClientSeasons(user.id, trainerId);
  }
}
