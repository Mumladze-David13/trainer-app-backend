// src/workouts/workouts.controller.ts
import {
  Controller, Get, Post, Put, Delete, Patch,
  Body, Param, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/roles.decorator';
import { WorkoutsService } from './workouts.service';
import { CreateWorkoutDto, UpdateWorkoutDto, CompleteWorkoutDto } from './dto/create-workout.dto';
import { Role } from '@prisma/client';

@Controller('workouts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class WorkoutsController {
  constructor(private readonly workoutsService: WorkoutsService) {}

  // TRAINER routes
  @Post()
  @Roles(Role.TRAINER, Role.TRAINER_CLIENT)
  public createWorkout(@CurrentUser() user: any, @Body() dto: CreateWorkoutDto) {
    return this.workoutsService.createWorkout(user.id, dto);
  }

  @Get(':id')
  public getWorkout(@Param('id') id: string) {
    return this.workoutsService.getWorkout(id);
  }

  @Put(':id')
  @Roles(Role.TRAINER, Role.TRAINER_CLIENT)
  public updateWorkout(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: UpdateWorkoutDto,
  ) {
    return this.workoutsService.updateWorkout(id, user.id, dto);
  }

  @Delete(':id')
  @Roles(Role.TRAINER, Role.TRAINER_CLIENT)
  public deleteWorkout(@CurrentUser() user: any, @Param('id') id: string) {
    return this.workoutsService.deleteWorkout(id, user.id);
  }

  // CLIENT routes
  @Patch(':id/progress')
  @Roles(Role.CLIENT, Role.TRAINER_CLIENT)
  public saveProgress(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: CompleteWorkoutDto,
  ) {
    return this.workoutsService.saveProgress(id, user.id, dto);
  }

  @Post(':id/complete')
  @Roles(Role.CLIENT, Role.TRAINER_CLIENT)
  public completeWorkout(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: CompleteWorkoutDto,
  ) {
    return this.workoutsService.completeWorkout(id, user.id, dto);
  }

  // CLIENT: get seasons from trainer's perspective
  @Get('client/:trainerId/seasons')
  @Roles(Role.CLIENT, Role.TRAINER_CLIENT)
  public getClientSeasons(
    @CurrentUser() user: any,
    @Param('trainerId') trainerId: string,
  ) {
    return this.workoutsService.getClientSeasons(user.id, trainerId);
  }
}
