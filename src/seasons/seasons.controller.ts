import { Controller, Get, Post, Put, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/roles.decorator';
import { SeasonsService } from './seasons.service';
import { CreateSeasonDto } from './dto/create-season.dto';
import { Role } from '@prisma/client';

@ApiTags('Seasons')
@ApiBearerAuth('JWT')
@Controller('clients/:clientId/seasons')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.TRAINER, Role.TRAINER_CLIENT)
export class SeasonsController {
  constructor(private readonly seasonsService: SeasonsService) {}

  @Get()
  @ApiOperation({ summary: 'Получить все сезоны клиента' })
  @ApiParam({ name: 'clientId', description: 'ID клиента' })
  @ApiResponse({ status: 200, description: 'Список сезонов с тренировками' })
  public getSeasons(@CurrentUser() user: any, @Param('clientId') clientId: string) {
    return this.seasonsService.getSeasons(user.id, clientId);
  }

  @Post()
  @ApiOperation({ summary: 'Создать новый сезон для клиента' })
  @ApiParam({ name: 'clientId', description: 'ID клиента' })
  @ApiResponse({ status: 201, description: 'Сезон создан' })
  public createSeason(
    @CurrentUser() user: any,
    @Param('clientId') clientId: string,
    @Body() dto: CreateSeasonDto,
  ) {
    return this.seasonsService.createSeason(user.id, clientId, dto);
  }

  @Put(':seasonId')
  @ApiOperation({ summary: 'Обновить сезон' })
  @ApiParam({ name: 'clientId', description: 'ID клиента' })
  @ApiParam({ name: 'seasonId', description: 'ID сезона' })
  @ApiResponse({ status: 200, description: 'Сезон обновлён' })
  @ApiResponse({ status: 404, description: 'Сезон не найден' })
  public updateSeason(
    @CurrentUser() user: any,
    @Param('seasonId') seasonId: string,
    @Body() dto: Partial<CreateSeasonDto>,
  ) {
    return this.seasonsService.updateSeason(seasonId, user.id, dto);
  }
}
