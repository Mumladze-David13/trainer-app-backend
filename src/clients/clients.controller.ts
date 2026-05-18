// src/clients/clients.controller.ts
import {
  Controller, Get, Post, Delete,
  Body, Param, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/roles.decorator';
import { ClientsService } from './clients.service';
import { Role } from '@prisma/client';

@Controller('clients')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.TRAINER, Role.TRAINER_CLIENT)
export class ClientsController {
  constructor(private clientsService: ClientsService) {}

  @Get()
  getMyClients(@CurrentUser() user: any) {
    return this.clientsService.getMyClients(user.id);
  }

  @Post()
  addClient(@CurrentUser() user: any, @Body('clientId') clientId: string) {
    return this.clientsService.addClient(user.id, clientId);
  }

  @Get(':clientId')
  getClientDetail(
    @CurrentUser() user: any,
    @Param('clientId') clientId: string,
  ) {
    return this.clientsService.getClientDetail(user.id, clientId);
  }

  @Delete(':clientId')
  removeClient(
    @CurrentUser() user: any,
    @Param('clientId') clientId: string,
  ) {
    return this.clientsService.removeClient(user.id, clientId);
  }
}
