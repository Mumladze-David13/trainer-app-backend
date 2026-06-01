// src/seasons/seasons.controller.ts
import { Controller, Get, Post, Put, Body, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/roles.decorator';
import { SeasonsService } from './seasons.service';
import { CreateSeasonDto } from './dto/create-season.dto';
import { Role } from '@prisma/client';

@Controller('clients/:clientId/seasons')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.TRAINER, Role.TRAINER_CLIENT)
export class SeasonsController {
  constructor(private readonly seasonsService: SeasonsService) {}

  @Get()
  public getSeasons(@CurrentUser() user: any, @Param('clientId') clientId: string) {
    return this.seasonsService.getSeasons(user.id, clientId);
  }

  @Post()
  public createSeason(
    @CurrentUser() user: any,
    @Param('clientId') clientId: string,
    @Body() dto: CreateSeasonDto,
  ) {
    return this.seasonsService.createSeason(user.id, clientId, dto);
  }

  @Put(':seasonId')
  public updateSeason(
    @CurrentUser() user: any,
    @Param('seasonId') seasonId: string,
    @Body() dto: Partial<CreateSeasonDto>,
  ) {
    return this.seasonsService.updateSeason(seasonId, user.id, dto);
  }
}

// src/seasons/seasons.module.ts
import { Module } from '@nestjs/common';

@Module({
  controllers: [SeasonsController],
  providers: [SeasonsService],
})
export class SeasonsModule {}
