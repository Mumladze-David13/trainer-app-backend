import { Controller, Get, Post, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiBody } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/roles.decorator';
import { ClientsService } from './clients.service';
import { Role } from '@prisma/client';

@ApiTags('Clients')
@ApiBearerAuth('JWT')
@Controller('clients')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.TRAINER, Role.TRAINER_CLIENT)
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Get()
  @ApiOperation({ summary: 'Получить список клиентов тренера' })
  @ApiResponse({ status: 200, description: 'Список клиентов' })
  public getMyClients(@CurrentUser() user: any) {
    return this.clientsService.getMyClients(user.id);
  }

  @Post()
  @ApiOperation({ summary: 'Добавить клиента к тренеру' })
  @ApiBody({ schema: { properties: { clientId: { type: 'string', example: 'uuid-клиента' } } } })
  @ApiResponse({ status: 201, description: 'Клиент добавлен' })
  @ApiResponse({ status: 404, description: 'Клиент не найден' })
  public addClient(@CurrentUser() user: any, @Body('clientId') clientId: string) {
    return this.clientsService.addClient(user.id, clientId);
  }

  @Get(':clientId')
  @ApiOperation({ summary: 'Получить детальную информацию о клиенте' })
  @ApiParam({ name: 'clientId', description: 'ID клиента' })
  @ApiResponse({ status: 200, description: 'Данные клиента с сезонами и тренировками' })
  @ApiResponse({ status: 404, description: 'Клиент не найден' })
  public getClientDetail(@CurrentUser() user: any, @Param('clientId') clientId: string) {
    return this.clientsService.getClientDetail(user.id, clientId);
  }

  @Delete(':clientId')
  @ApiOperation({ summary: 'Удалить клиента из списка' })
  @ApiParam({ name: 'clientId', description: 'ID клиента' })
  @ApiResponse({ status: 200, description: 'Клиент удалён' })
  public removeClient(@CurrentUser() user: any, @Param('clientId') clientId: string) {
    return this.clientsService.removeClient(user.id, clientId);
  }
}
