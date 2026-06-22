import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
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
  @ApiResponse({ status: 200, description: 'Список упражнений' })
  public findAll(@CurrentUser() user: any) {
    return this.exercisesService.findAll(user.id);
  }

  @Post()
  @Roles(Role.TRAINER, Role.TRAINER_CLIENT)
  @ApiOperation({ summary: 'Создать новое упражнение' })
  @ApiResponse({ status: 201, description: 'Упражнение создано' })
  @ApiResponse({ status: 409, description: 'Упражнение с таким именем уже существует' })
  public create(@CurrentUser() user: any, @Body() dto: CreateExerciseDto) {
    return this.exercisesService.create(user.id, dto);
  }

  @Put(':id')
  @Roles(Role.TRAINER, Role.TRAINER_CLIENT)
  @ApiOperation({ summary: 'Обновить упражнение' })
  @ApiParam({ name: 'id', description: 'ID упражнения' })
  @ApiResponse({ status: 200, description: 'Упражнение обновлено' })
  @ApiResponse({ status: 404, description: 'Упражнение не найдено' })
  public update(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: UpdateExerciseDto) {
    return this.exercisesService.update(id, user.id, dto);
  }

  @Delete(':id')
  @Roles(Role.TRAINER, Role.TRAINER_CLIENT)
  @ApiOperation({ summary: 'Удалить упражнение' })
  @ApiParam({ name: 'id', description: 'ID упражнения' })
  @ApiResponse({ status: 200, description: 'Упражнение удалено' })
  @ApiResponse({ status: 404, description: 'Упражнение не найдено' })
  public remove(@CurrentUser() user: any, @Param('id') id: string) {
    return this.exercisesService.remove(id, user.id);
  }
}
