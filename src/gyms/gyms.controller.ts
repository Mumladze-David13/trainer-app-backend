import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { GymsService } from './gyms.service';
import { CreateGymDto } from './dto/create-gym.dto';
import { UpdateGymDto } from './dto/update-gym.dto';

@ApiTags('Gyms')
@ApiBearerAuth('JWT')
@Controller('gyms')
@UseGuards(JwtAuthGuard, RolesGuard)
export class GymsController {
  constructor(private readonly gymsService: GymsService) {}

  @Get()
  @Roles(Role.TRAINER, Role.TRAINER_CLIENT)
  @ApiOperation({ summary: 'Список залов' })
  public findAll() {
    return this.gymsService.findAll();
  }

  @Get('address/suggest')
  @Roles(Role.TRAINER, Role.TRAINER_CLIENT)
  @ApiOperation({ summary: 'Подсказки адресов через Dadata' })
  @ApiQuery({ name: 'q', description: 'Поисковый запрос' })
  public suggestAddress(@Query('q') q: string) {
    return this.gymsService.suggestAddress(q ?? '');
  }

  @Get(':id')
  @Roles(Role.TRAINER, Role.TRAINER_CLIENT)
  @ApiOperation({ summary: 'Получить зал по ID' })
  public findOne(@Param('id') id: string) {
    return this.gymsService.findOne(id);
  }

  @Post()
  @Roles(Role.TRAINER, Role.TRAINER_CLIENT)
  @ApiOperation({ summary: 'Создать зал' })
  public create(@Body() dto: CreateGymDto) {
    return this.gymsService.create(dto);
  }

  @Patch(':id')
  @Roles(Role.TRAINER, Role.TRAINER_CLIENT)
  @ApiOperation({ summary: 'Обновить зал' })
  public update(@Param('id') id: string, @Body() dto: UpdateGymDto) {
    return this.gymsService.update(id, dto);
  }

  @Delete(':id')
  @Roles(Role.TRAINER, Role.TRAINER_CLIENT)
  @ApiOperation({ summary: 'Удалить зал' })
  public remove(@Param('id') id: string) {
    return this.gymsService.remove(id);
  }
}
