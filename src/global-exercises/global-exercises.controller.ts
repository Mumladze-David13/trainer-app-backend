import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { GlobalExercisesService } from './global-exercises.service';
import { QueryGlobalExerciseDto } from './dto/query-global-exercise.dto';
import { ImportGlobalExerciseDto } from './dto/import-global-exercise.dto';

@ApiTags('GlobalExercises')
@ApiBearerAuth('JWT')
@Controller('global-exercises')
@UseGuards(JwtAuthGuard, RolesGuard)
export class GlobalExercisesController {
  constructor(private readonly globalExercisesService: GlobalExercisesService) {}

  @Get()
  @Roles(Role.TRAINER, Role.TRAINER_CLIENT)
  @ApiOperation({ summary: 'Список упражнений из глобального справочника' })
  public findAll(@Query() query: QueryGlobalExerciseDto) {
    return this.globalExercisesService.findAll(query);
  }

  @Post('import')
  @Roles(Role.TRAINER, Role.TRAINER_CLIENT)
  @ApiOperation({ summary: 'Импортировать упражнения из справочника в свой список (выборочно по ids или весь справочник, если ids не переданы)' })
  public import(@CurrentUser() user: any, @Body() dto: ImportGlobalExerciseDto) {
    return this.globalExercisesService.import(user.id, dto);
  }
}
